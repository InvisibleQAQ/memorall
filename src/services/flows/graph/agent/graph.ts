import { END, START, StateGraph } from "@langchain/langgraph/web";
import type { LangGraphRunnableConfig } from "@langchain/langgraph/web";
import { AgentAnnotation, type AgentState, type AgentStep } from "./state";
import { GraphBase } from "@/services/flows/graph/graph.base";
import { toolRegistry, convertToolsToOpenAI } from "@/services/flows/tool-registry";
import type { BaseTool, CombinedServices } from "@/services/flows/interfaces/tool";
import type { ChatCompletionChunk, ChatCompletionMessageParam } from "@/types/openai";
import { logError, logInfo } from "@/utils/logger";
import { flowRegistry } from "@/services/flows/flow-registry";

// Tool names available to the agent
const TOOL_NAMES = ["calculator", "current_time", "memory_search"] as const;

// Derive services from tools + graph's own needs (llm for calling the model)
type AgentServices = CombinedServices<typeof TOOL_NAMES, "llm">;

const AGENT_SYSTEM_PROMPT = `You are an intelligent assistant that can use tools to help answer user questions. Use tools when needed to provide accurate answers.`;

/**
 * Simple Agent Graph with 2 nodes:
 * - agent: Calls LLM to decide whether to use tools or respond
 * - tools: Executes tool calls and returns results
 *
 * Flow:
 * START -> agent -> (tool_calls?) -> tools -> agent (loop)
 *                -> (no tool_calls) -> END
 */
export class AgentGraph extends GraphBase<
	"agent" | "tools",
	AgentState,
	AgentServices
> {
	private tools: BaseTool[];
	private toolsMap: Map<string, BaseTool>;

	constructor(services: AgentServices) {
		super(services);

		// Create bound tools with services
		this.tools = toolRegistry.getTools(TOOL_NAMES, services);
		this.toolsMap = new Map(this.tools.map((t) => [t.name, t]));

		this.workflow = new StateGraph(AgentAnnotation);

		// Add nodes
		this.workflow.addNode("agent", this.agentNode);
		this.workflow.addNode("tools", this.toolsNode);

		// START -> agent
		this.workflow.addEdge(START, "agent");

		// agent -> tools (if tool_calls) OR END (if no tool_calls)
		this.workflow.addConditionalEdges("agent", this.routeAfterAgent);

		// tools -> agent (loop back)
		this.workflow.addEdge("tools", "agent");

		this.compile();
	}

	/**
	 * Route after agent node: go to tools if there are tool calls, otherwise end
	 */
	private routeAfterAgent = (state: AgentState): "tools" | typeof END => {
		const lastStep = state.steps[state.steps.length - 1];

		// Check for max iterations
		if (state.currentIteration >= state.maxIterations) {
			logInfo(
				`[AGENT] Max iterations (${state.maxIterations}) reached, ending`,
			);
			return END;
		}

		// If last step has tool calls, route to tools node
		if (
			lastStep?.role === "assistant" &&
			lastStep.tool_calls &&
			lastStep.tool_calls.length > 0
		) {
			return "tools";
		}

		// No tool calls means we have a final response
		return END;
	};

	/**
	 * Build conversation history from messages and steps for LLM
	 */
	private buildConversation(state: AgentState): ChatCompletionMessageParam[] {
		const messages: ChatCompletionMessageParam[] = [
			{ role: "system", content: AGENT_SYSTEM_PROMPT },
			...state.messages,
		];

		// Add steps (tool calls and results) to conversation
		for (const step of state.steps) {
			if (step.role === "assistant") {
				messages.push({
					role: "assistant",
					content: step.content,
					tool_calls: step.tool_calls,
				});
			} else if (step.role === "tool" && step.tool_call_id) {
				messages.push({
					role: "tool",
					content: step.content || "",
					tool_call_id: step.tool_call_id,
				});
			}
		}

		return messages;
	}

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
			const messages = this.buildConversation(state);
			const tools = convertToolsToOpenAI(this.tools);

			logInfo("[AGENT] Calling LLM with", messages.length, "messages and", tools.length, "tools");

			// Use native OpenAI tool calling with streaming
			const stream = llm.chatCompletions({
				messages,
				tools,
				tool_choice: "auto",
				stream: true,
			}) as AsyncIterableIterator<ChatCompletionChunk>;

			// Accumulate response from stream
			let content = "";
			const toolCallsMap = new Map<number, {
				id: string;
				type: "function";
				function: { name: string; arguments: string };
			}>();
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

			logInfo("[AGENT] Stream complete - content length:", content.length, "tool_calls:", toolCalls.length);

			// Check if LLM wants to call tools
			if (toolCalls.length > 0) {
				const actions = toolCalls.map((tc) => ({
					id: crypto.randomUUID(),
					name: `Calling "${tc.function.name}"`,
					description: `Args: ${tc.function.arguments}`,
					metadata: { tool: tc.function.name },
				}));
				runConfig?.writer?.({ type: "actions", actions });

				const newStep: AgentStep = {
					role: "assistant",
					content: content || null,
					tool_calls: toolCalls,
				};

				return {
					steps: [newStep],
					currentIteration: state.currentIteration + 1,
				};
			}

			// No tool calls - this is the final response
			const newStep: AgentStep = {
				role: "assistant",
				content,
			};

			const actions = [
				{
					id: crypto.randomUUID(),
					name: "Final response",
					description: "Agent completed with final answer",
					metadata: {},
				},
			];
			runConfig?.writer?.({ type: "actions", actions });

			return {
				steps: [newStep],
				finalMessage: content,
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
		const lastStep = state.steps[state.steps.length - 1];

		if (!lastStep?.tool_calls || lastStep.tool_calls.length === 0) {
			throw new Error("No tool calls found in the last step");
		}

		const toolResultSteps: AgentStep[] = [];

		for (const toolCall of lastStep.tool_calls) {
			const toolName = toolCall.function.name;
			const tool = this.toolsMap.get(toolName);
			runConfig?.writer?.({
				type: "execute-start",
				node: "tools",
				metadata: {
					tool: toolName,
					tool_call_id: toolCall.id,
				},
			});

			if (!tool) {
				toolResultSteps.push({
					role: "tool",
					content: `Error: Tool '${toolName}' not found`,
					tool_call_id: toolCall.id,
				});
				continue;
			}

			try {
				const args = JSON.parse(toolCall.function.arguments);
				logInfo(`[TOOLS] Executing ${toolName} with args:`, args);

				// Validate and execute the tool (services already bound via factory)
				const validatedArgs = tool.schema.parse(args);
				const result = await tool.execute(validatedArgs);
				logInfo(`[TOOLS] Result from ${toolName}:`, result);

				toolResultSteps.push({
					role: "tool",
					content: result,
					tool_call_id: toolCall.id,
				});
			} catch (error) {
				const errorMessage =
					error instanceof Error ? error.message : "Unknown error";
				logError(`[TOOLS] Error executing ${toolName}:`, error);

				toolResultSteps.push({
					role: "tool",
					content: `Error: ${errorMessage}`,
					tool_call_id: toolCall.id,
				});
			}
		}

		const actions = [
			{
				id: crypto.randomUUID(),
				name: `Executed ${toolResultSteps.length} tool(s)`,
				description: toolResultSteps
					.map((s) => s.content?.substring(0, 100))
					.join("; "),
				metadata: {},
			},
		];
		runConfig?.writer?.({ type: "actions", actions });
		return {
			steps: toolResultSteps,
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
			flow: AgentGraph;
		};
	}
}
