import { END, START, StateGraph } from "@langchain/langgraph/web";
import type { LangGraphRunnableConfig } from "@langchain/langgraph/web";
import {
	AgentAnnotation,
	DEFAULT_AGENT_SYSTEM_PROMPT,
	type AgentState,
} from "./state";
import {
	buildResponseFromOutputMessages,
	createOutputMessageChunks,
	GraphBase,
	type CombinedTool,
	type GraphTool,
} from "@/services/flows/graph/graph.base";
import type { CombinedServices } from "@/services/flows/interfaces/tool";
import {
	extractToolResult,
	parseToolInput,
} from "@/services/flows/interfaces/tool";
import type { ChatCompletionChunk } from "@/types/openai";
import { logError, logInfo } from "@/utils/logger";
import { formatYAML } from "@/utils/yaml";
import { flowRegistry, FEATURE_SLOT } from "@/services/flows/flow-registry";
import type { BaseFlow } from "@/services/flows/flow-registry";
import { chatFlowRegistry } from "@/services/flows/chat-flow-registry";
import { findEnabledStepByName } from "@/services/flows/interfaces/flow-config";

// Tool names available to the agent
const DEFAULT_TOOL_NAMES = ["current_time"] as const;

// Derive services from tools + graph's own needs (llm for calling the model)
type AgentServices = CombinedServices<typeof DEFAULT_TOOL_NAMES, "llm">;

type AgentGraphConfig = {
	systemPrompt?: string;
	tools?: GraphTool[];
};

const isObject = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null;

const parseStructuredActionPayload = (
	content: string,
): Record<string, unknown> | null => {
	try {
		const parsed = JSON.parse(content);
		return isObject(parsed) ? parsed : null;
	} catch {
		return null;
	}
};

const ACTION_OUTPUT_MAX_LENGTH = 1000;

/** Truncate tool output to `ACTION_OUTPUT_MAX_LENGTH` characters. */
const truncateOutput = (content: string): string => {
	if (content.length <= ACTION_OUTPUT_MAX_LENGTH) return content;
	return (
		content.slice(0, ACTION_OUTPUT_MAX_LENGTH) +
		`\n… (truncated, ${content.length - ACTION_OUTPUT_MAX_LENGTH} more characters)`
	);
};

/**
 * Simple Agent Graph with 2 nodes:
 * - initial: update system prompt
 * - agent: Calls LLM to decide whether to use tools or respond
 * - tools: Executes tool calls and returns results
 *
 * Flow:
 * START -> initial -> agent -> (tool_calls?) -> tools -> agent (loop)
 *                -> (no tool_calls) -> END
 */
export class AgentGraph extends GraphBase<
	"initial" | "agent" | "tool_executor",
	AgentState,
	AgentServices
> {
	private combinedTools: CombinedTool[];
	private executorMap: Map<string, CombinedTool>;
	private systemPrompt = DEFAULT_AGENT_SYSTEM_PROMPT;

	constructor(services: AgentServices, config: AgentGraphConfig = {}) {
		super(services);

		if (config.systemPrompt) {
			this.systemPrompt = config.systemPrompt;
		}

		// Create bound tools with services
		this.combinedTools = this.chat.combineTools(
			config.tools || [...DEFAULT_TOOL_NAMES],
			services,
		);
		this.executorMap = new Map(
			this.combinedTools.map((t) => [t.executor.name, t]),
		);

		this.workflow = new StateGraph(AgentAnnotation);

		// Add nodes
		this.addNode("initial", this.initialNode);
		this.addNode("agent", this.agentNode);
		this.addNode("tool_executor", this.toolsNode);

		this.workflow.addEdge(START, "initial");
		this.workflow.addEdge("initial", "agent");
		this.workflow.addConditionalEdges("agent", this.routeAfterAgent);
		this.workflow.addEdge("tool_executor", "agent");

		this.compile();
	}

	/**
	 * Route after agent node:
	 * - agentNode writes tool-call messages to outputMessages (working memory)
	 * - agentNode finished path commits to messages and does NOT write to outputMessages
	 * So: pending tool calls are always the last item in outputMessages.
	 */
	private routeAfterAgent = (
		state: AgentState,
	): "tool_executor" | typeof END => {
		if (state.currentIteration >= state.maxIterations) {
			logInfo(
				`[AGENT] Max iterations (${state.maxIterations}) reached, ending`,
			);
			return END;
		}

		const lastOutputMessage = this.chat.lastMessage(state.outputMessages);
		if (
			lastOutputMessage?.role === "assistant" &&
			lastOutputMessage.tool_calls?.length
		) {
			return "tool_executor";
		}

		return END;
	};

	initialNode = (state: AgentState): Partial<AgentState> => {
		return {
			messages: this.chat.systemMessage(state.messages, this.systemPrompt),
		};
	};

	/**
	 * Agent node: streams LLM response and decides on tool use or final response.
	 *
	 * LLM context = stable messages + accumulated working memory (outputMessages).
	 *
	 * Tool call path  → writes assistant message (with tool_calls) to outputMessages.
	 * Finished path   → commits all working memory + final response into messages.
	 */
	agentNode = async (
		state: AgentState,
		runConfig?: LangGraphRunnableConfig,
	): Promise<Partial<AgentState>> => {
		const llm = this.services.llm;
		if (!llm.isReady()) throw new Error("LLM service is not ready");

		// Full LLM context: stable history + working memory accumulated so far
		const llmMessages = [...state.messages, ...state.outputMessages];
		const tools = this.combinedTools.map((t) => t.tool);

		logInfo(
			"[AGENT] Calling LLM with",
			llmMessages.length,
			"messages and",
			tools.length,
			"tools",
		);

		const stream = llm.chatCompletions({
			messages: llmMessages,
			tools,
			tool_choice: "auto",
			stream: true,
		}) as AsyncIterableIterator<ChatCompletionChunk>;

		let content = "";
		const toolCallsMap = new Map<
			number,
			{
				id: string;
				type: "function";
				function: { name: string; arguments: string };
			}
		>();

		for await (const chunk of stream) {
			const delta = chunk.choices[0]?.delta;
			if (delta?.content) content += delta.content;
			runConfig?.writer?.({ type: "llm", chunk });

			if (delta?.tool_calls) {
				for (const tc of delta.tool_calls) {
					const existing = toolCallsMap.get(tc.index);
					if (existing) {
						if (tc.function?.arguments)
							existing.function.arguments += tc.function.arguments;
					} else {
						toolCallsMap.set(tc.index, {
							id: tc.id || crypto.randomUUID(),
							type: "function",
							function: {
								name: tc.function?.name || "",
								arguments: tc.function?.arguments || "",
							},
						});
					}
				}
			}
		}

		const toolCalls = Array.from(toolCallsMap.values());
		logInfo(
			"[AGENT] Stream complete - content:",
			content.length,
			"tool_calls:",
			toolCalls.length,
		);

		// Tool call path: write assistant message to working memory, defer final commit
		if (toolCalls.length > 0) {
			return {
				outputMessages: [
					{
						role: "assistant" as const,
						content: content || null,
						tool_calls: toolCalls,
					},
				],
				currentIteration: state.currentIteration + 1,
			};
		}

		// Finished path: commit working memory + final response into messages
		const finalMessage = { role: "assistant" as const, content };
		const committedMessages = [...state.outputMessages, finalMessage];

		return {
			messages: [...state.messages, ...committedMessages],
			response: buildResponseFromOutputMessages([], committedMessages),
			currentIteration: state.currentIteration + 1,
		};
	};

	/**
	 * Tools node: executes tool calls from working memory, appends results to working memory.
	 * Only updates outputMessages — messages stays intact until agentNode finishes.
	 */
	toolsNode = async (
		state: AgentState,
		runConfig?: LangGraphRunnableConfig,
	): Promise<Partial<AgentState>> => {
		// The pending tool-call message is always the last item in working memory
		const lastMessage = this.chat.lastMessage(state.outputMessages);

		if (lastMessage?.role !== "assistant" || !lastMessage.tool_calls?.length) {
			throw new Error("No tool calls found in working memory");
		}

		// Fresh working copy so tool executors can push messages via appendOutputMessagesToState
		const toolState: AgentState = { ...state, outputMessages: [] };
		let toolStateOffset = 0;
		const outputMessages: AgentState["outputMessages"] = [];
		const toolResults: Array<{
			toolName: string;
			content: ReturnType<typeof extractToolResult>["content"];
			contentText: string;
			toolCall: (typeof lastMessage.tool_calls)[number];
			toolMetadata?: Record<string, unknown>;
		}> = [];

		logInfo("[TOOL EXECUTE] Start tool calls", lastMessage.tool_calls);

		for (const toolCall of lastMessage.tool_calls) {
			const toolName = toolCall.function.name;
			const combined = this.executorMap.get(toolName);
			runConfig?.writer?.({
				type: "execute-start",
				node: "tool_executor",
				metadata: { tool: toolName, tool_call_id: toolCall.id },
			});

			if (!combined) {
				const content = `Error: Tool '${toolName}' not found`;
				outputMessages.push({
					role: "tool" as const,
					content,
					tool_call_id: toolCall.id,
				});
				toolResults.push({ toolName, content, contentText: content, toolCall });
				continue;
			}

			try {
				const args = JSON.parse(toolCall.function.arguments);
				const validatedArgs = parseToolInput(combined.executor.schema, args);
				const rawResult = await combined.executor.execute(validatedArgs, {
					state: toolState,
				});
				const { content, contentText } = extractToolResult(rawResult);

				// Collect any messages the tool executor pushed to its local working copy
				const executorMessages =
					toolState.outputMessages.slice(toolStateOffset);
				toolStateOffset = toolState.outputMessages.length;
				outputMessages.push(...executorMessages);
				for (const chunk of createOutputMessageChunks(executorMessages)) {
					runConfig?.writer?.({ type: "llm", chunk });
				}

				outputMessages.push({
					role: "tool" as const,
					content,
					tool_call_id: toolCall.id,
				});
				toolResults.push({
					toolName,
					content,
					contentText,
					toolCall,
					toolMetadata: combined.executor.metadata,
				});
				logInfo(
					"[TOOL EXECUTE] Tool result",
					toolCall.function.name,
					contentText,
				);
			} catch (error) {
				const errorMessage =
					error instanceof Error ? error.message : "Unknown error";
				logError(`[TOOLS] Error executing ${toolName}:`, error);

				const content = `Error: ${errorMessage}`;
				outputMessages.push({
					role: "tool" as const,
					content,
					tool_call_id: toolCall.id,
				});
				toolResults.push({
					toolName,
					content,
					contentText: content,
					toolCall,
					toolMetadata: combined.executor.metadata,
				});
			}
		}

		const actions = toolResults.map((result) => {
			const structured = parseStructuredActionPayload(result.contentText);
			const actionName =
				typeof structured?.actionType === "string"
					? structured.actionType
					: result.toolName;
			const actionDescription =
				typeof structured?.description === "string"
					? structured.description
					: result.contentText;
			const mcpMetadata = isObject(result.toolMetadata?.mcp)
				? result.toolMetadata.mcp
				: undefined;

			let rawArgs: Record<string, unknown> = {};
			try {
				const parsed = JSON.parse(result.toolCall.function.arguments);
				if (isObject(parsed)) rawArgs = parsed;
			} catch {
				// leave rawArgs empty
			}

			return {
				id: crypto.randomUUID(),
				name: actionName,
				description: `${formatYAML(rawArgs)}\noutput:\n${truncateOutput(actionDescription)}`,
				metadata: {
					tool: result.toolName,
					tool_call: result.toolCall,
					...(result.toolMetadata
						? { tool_metadata: result.toolMetadata }
						: {}),
					...(mcpMetadata ? { mcp: mcpMetadata } : {}),
					...(structured || {}),
				},
			};
		});

		if (actions.length) {
			runConfig?.writer?.({ type: "actions", actions });
		}

		// Only update working memory — messages stays intact until agentNode finishes
		return { outputMessages };
	};
}

flowRegistry.register({
	flowType: "agent",
	stepDefaults: {
		"add-system": { content: DEFAULT_AGENT_SYSTEM_PROMPT },
	},
	stepOrder: ["add-system", FEATURE_SLOT, "agent-completion"],
	factory: (services, config) =>
		new AgentGraph(services, config as AgentGraphConfig),
});

// Register as a chat-capable flow — pure agent with no RAG retrieval.
//
// The agent graph has its own internal topology (initial → agent ⇄ tool_executor)
// and does not use the step-registry node builder.  We extract the relevant
// values from UnifiedFlowConfig by inspecting the known step slots.
//
// The `as unknown as BaseFlow` cast is required because TypeScript's invariant
// generic checks on the compiled workflow's internal types are incompatible with
// the BaseFlow alias (which uses `string` nodes and `AllServices`), even though
// the runtime behaviour is fully correct.
chatFlowRegistry.register("agent", (services, config) => {
	const addSystemStep = findEnabledStepByName(config, "add-system");
	const agentCompletionStep = findEnabledStepByName(config, "agent-completion");

	const systemPrompt =
		(addSystemStep?.config?.content as string | undefined) || undefined;
	const tools =
		(agentCompletionStep?.config?.tools as GraphTool[] | undefined) ?? [];

	const graph = new AgentGraph(services, {
		systemPrompt,
		tools: tools.length > 0 ? tools : undefined,
	});

	return {
		graph: graph as unknown as BaseFlow,
		// Agent state only needs messages; extra fields (graphId, contextQueries)
		// are part of FoundationState and are absent from AgentAnnotation.
		getInitialState: (ctx) => ({
			messages: ctx.messages,
		}),
	};
});

// Extend global FlowTypeRegistry for type-safe flow creation
declare global {
	interface FlowTypeRegistry {
		agent: {
			services: AgentServices;
			config: AgentGraphConfig;
			flow: AgentGraph;
		};
	}
}
