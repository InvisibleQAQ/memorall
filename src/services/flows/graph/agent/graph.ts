import { END, START, StateGraph } from "@langchain/langgraph/web";
import type { LangGraphRunnableConfig } from "@langchain/langgraph/web";
import { AgentAnnotation, type AgentState } from "./state";
import {
	GraphBase,
	type CombinedTool,
	type ToolName,
} from "@/services/flows/graph/graph.base";
import type { CombinedServices } from "@/services/flows/interfaces/tool";
import type { ChatCompletionChunk } from "@/types/openai";
import { logError, logInfo } from "@/utils/logger";
import { flowRegistry } from "@/services/flows/flow-registry";

// Tool names available to the agent
const DEFAULT_TOOL_NAMES = ["current_time", "js_execute"] as const;

// Derive services from tools + graph's own needs (llm for calling the model)
type AgentServices = CombinedServices<typeof DEFAULT_TOOL_NAMES, "llm">;

type AgentGraphConfig = {
	systemPrompt?: string;
	tools?: `${ToolName}`[];
};

const AGENT_SYSTEM_PROMPT = `You are an intelligent assistant that can use tools to help answer user questions. Use tools when needed to provide accurate answers.`;

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
	private systemPrompt = AGENT_SYSTEM_PROMPT;

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
		this.workflow.addNode("initial", this.initialNode);
		this.workflow.addNode("agent", this.agentNode);
		this.workflow.addNode("tool_executor", this.toolsNode);

		this.workflow.addEdge(START, "initial");
		this.workflow.addEdge("initial", "agent");
		this.workflow.addConditionalEdges("agent", this.routeAfterAgent);
		this.workflow.addEdge("tool_executor", "agent");

		this.compile();
	}

	/**
	 * Route after agent node: go to tools if there are tool calls, otherwise end
	 */
	private routeAfterAgent = (
		state: AgentState,
	): "tool_executor" | typeof END => {
		const lastMessage = this.chat.lastMessage(state.messages);

		// Check for max iterations
		if (state.currentIteration >= state.maxIterations) {
			logInfo(
				`[AGENT] Max iterations (${state.maxIterations}) reached, ending`,
			);
			return END;
		}

		// If last step has tool calls, route to tools node
		if (lastMessage?.role === "assistant" && lastMessage.tool_calls?.length) {
			return "tool_executor";
		}

		// No tool calls means we have a final response
		return END;
	};

	initialNode = (state: AgentState): Partial<AgentState> => {
		return {
			messages: this.chat.systemMessage(state.messages, this.systemPrompt),
		};
	};

	/**
	 * Agent node: Call LLM with tools (streaming) to decide on tool use or final response
	 */
	agentNode = async (
		state: AgentState,
		runConfig?: LangGraphRunnableConfig,
	): Promise<Partial<AgentState>> => {
		const llm = this.services.llm;

		if (!llm.isReady()) {
			throw new Error("LLM service is not ready");
		}

		try {
			const messages = state.messages;
			const tools = this.combinedTools.map((t) => t.tool);

			logInfo(
				"[AGENT] Calling LLM with",
				messages.length,
				"messages and",
				tools.length,
				"tools",
			);

			// Use native OpenAI tool calling with streaming
			const stream = llm.chatCompletions({
				messages,
				tools,
				tool_choice: "auto",
				stream: true,
			}) as AsyncIterableIterator<ChatCompletionChunk>;

			// Accumulate response from stream
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

				// Accumulate content
				if (delta?.content) {
					content += delta.content;
				}
				runConfig?.writer?.({ type: "llm", chunk });

				// Accumulate tool calls
				if (delta?.tool_calls) {
					for (const tc of delta.tool_calls) {
						const existing = toolCallsMap.get(tc.index);
						if (existing) {
							// Append to existing tool call
							if (tc.function?.arguments) {
								existing.function.arguments += tc.function.arguments;
							}
						} else {
							// New tool call
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
				"[AGENT] Stream complete - content length:",
				content.length,
				"tool_calls:",
				toolCalls.length,
			);

			// Check if LLM wants to call tools
			if (toolCalls.length > 0) {
				const updatedMessages = this.chat.assistantMessage(
					messages,
					content || null,
					toolCalls,
				);

				return {
					messages: updatedMessages,
					currentIteration: state.currentIteration + 1,
				};
			}

			const updatedMessages = this.chat.assistantMessage(
				messages,
				content || null,
			);

			return {
				messages: updatedMessages,
				response: content,
				currentIteration: state.currentIteration + 1,
			};
		} catch (error) {
			logError("[AGENT] Error:", error);
			throw error;
		}
	};

	/**
	 * Tools node: Execute tool calls and return results
	 */
	toolsNode = async (
		state: AgentState,
		runConfig?: LangGraphRunnableConfig,
	): Promise<Partial<AgentState>> => {
		const lastMessage = this.chat.lastMessage(state.messages);

		if (
			lastMessage?.role !== "assistant" ||
			!lastMessage.tool_calls ||
			lastMessage.tool_calls.length === 0
		) {
			throw new Error("No tool calls found in the last step");
		}

		let updatedMessages = state.messages;
		const toolResults: Array<{
			toolName: string;
			content: string;
			toolCall: (typeof lastMessage.tool_calls)[number];
		}> = [];

		logInfo("[TOOL EXECUTE] Start tool call", lastMessage.tool_calls);

		for (const toolCall of lastMessage.tool_calls) {
			const toolName = toolCall.function.name;
			const combined = this.executorMap.get(toolName);
			runConfig?.writer?.({
				type: "execute-start",
				node: "tool_executor",
				metadata: {
					tool: toolName,
					tool_call_id: toolCall.id,
				},
			});

			if (!combined) {
				const content = `Error: Tool '${toolName}' not found`;
				updatedMessages = this.chat.toolMessage(
					updatedMessages,
					toolCall.id,
					content,
				);
				toolResults.push({
					toolName,
					content,
					toolCall,
				});
				continue;
			}

			try {
				const args = JSON.parse(toolCall.function.arguments);

				// Validate and execute the tool (services already bound via factory)
				const validatedArgs = combined.executor.schema.parse(args);
				const result = await combined.executor.execute(validatedArgs);
				logInfo("[TOOL EXECUTE] Tool call result", toolCall, result);

				updatedMessages = this.chat.toolMessage(
					updatedMessages,
					toolCall.id,
					result,
				);
				toolResults.push({
					toolName,
					content: result,
					toolCall,
				});
			} catch (error) {
				const errorMessage =
					error instanceof Error ? error.message : "Unknown error";
				logError(`[TOOLS] Error executing ${toolName}:`, error);

				const content = `Error: ${errorMessage}`;
				updatedMessages = this.chat.toolMessage(
					updatedMessages,
					toolCall.id,
					content,
				);
				toolResults.push({
					toolName,
					content,
					toolCall,
				});
			}
		}

		const actions = toolResults.map((result) => ({
			id: crypto.randomUUID(),
			name: result.toolName,
			description: result.content,
			metadata: {
				tool_call: result.toolCall,
			},
		}));
		if (actions.length) {
			runConfig?.writer?.({ type: "actions", actions });
		}
		return {
			messages: updatedMessages,
		};
	};
}

// Self-register the flow
flowRegistry.register({
	flowType: "agent",
	factory: (services) => new AgentGraph(services),
});

// Extend global FlowTypeRegistry for type-safe flow creation
declare global {
	interface FlowTypeRegistry {
		agent: {
			services: AgentServices;
			config: undefined;
			flow: AgentGraph;
		};
	}
}
