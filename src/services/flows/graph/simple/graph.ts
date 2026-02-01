import { END, START, StateGraph } from "@langchain/langgraph/web";
import { AgentAnnotation, type AgentState } from "./state";

import { GraphBase } from "@/services/flows/graph/graph.base";
import { toolRegistry, convertToolsToOpenAI } from "@/services/flows/tools";
import type { AllServices, BaseTool } from "@/services/flows/interfaces/tool";
import type { ChatCompletionResponse, ChatCompletionChunk, ChatMessage } from "@/types/openai";
import { logError, logInfo } from "@/utils/logger";
import { flowRegistry } from "@/services/flows/flow-registry";

// Tool names available to this graph
const TOOL_NAMES = ["current_time"] as const;

const ANSWER_SYSTEM_PROMPT = `
You are an intelligent assistant that can provide answers to user questions. Use your knowledge and reasoning skills to generate accurate and helpful responses.
`;
const AGENT_SYSTEM_PROMPT = `
You are an intelligent assistant that can use tools to help answer user questions. Use tools when needed to provide accurate answers.
`;

export class SimpleGraph extends GraphBase<
	"tools" | "agent" | "decision" | "answer",
	AgentState,
	AllServices
> {
	private tools: BaseTool[];
	private toolsMap: Map<string, BaseTool>;

	constructor(services: AllServices) {
		super(services);

		// Create bound tools with services
		this.tools = toolRegistry.getTools(TOOL_NAMES, services);
		this.toolsMap = new Map(this.tools.map((t) => [t.name, t]));
		this.workflow = new StateGraph(AgentAnnotation);

		// Add nodes
		this.workflow.addNode("agent", this.agentNode);
		this.workflow.addNode("tools", this.toolsNode);
		this.workflow.addNode("decision", this.decisionNode);
		this.workflow.addNode("answer", this.answerNode);

		// Add edge from start to agent
		this.workflow.addEdge(START, "decision");

		this.workflow.addConditionalEdges("decision", this.shouldAnswer);

		// Add conditional edges from agent
		this.workflow.addConditionalEdges("agent", this.shouldCallTool);

		// Add edge from tools back to agent
		this.workflow.addEdge("tools", "decision");

		this.workflow.addEdge("answer", END);

		// Use the base class compile method
		this.compile();
	}

	shouldAnswer(state: AgentState): "agent" | "answer" {
		const next = state.next;
		if (next === "agent") {
			return "agent";
		}
		return "answer";
	}

	shouldCallTool(state: AgentState): "tools" | "decision" {
		const next = state.next;
		const lastStep = state.steps[state.steps.length - 1];

		if (
			next === "tools" &&
			lastStep?.role === "assistant" &&
			lastStep.tool_calls &&
			lastStep.tool_calls.length > 0
		) {
			return "tools";
		}
		return "decision";
	}

	buildChainOfThought(state: AgentState): ChatMessage | undefined {
		let chainOfThought = "";
		if (state.steps?.length) {
			const chains: string[] = [];
			for (const step of state.steps) {
				if (step.role === "assistant" && step.tool_calls?.length) {
					chains.push(`\n---\n${step.content}\n`);
				} else if (step.role === "tool") {
					chains.push(`Result: ${step.content}\n---\n`);
				}
			}
			if (chains?.length) {
				chainOfThought = [
					"\n\n<thought>\n\n",
					"Below is the thought process:",
					...chains,
					"\n\n</thought>\n\n",
				].join("\n");
			}
		}
		return chainOfThought
			? {
					role: "assistant" as const,
					content: chainOfThought.trim(),
				}
			: undefined;
	}

	answerNode = async (state: AgentState): Promise<Partial<AgentState>> => {
		const llm = this.services.llm;

		if (!llm.isReady()) {
			throw new Error("LLM service is not ready");
		}

		const chainOfThoughtMessage = this.buildChainOfThought(state);
		// Convert to messages for LLM
		const messages: ChatMessage[] = [
			{ role: "system" as const, content: ANSWER_SYSTEM_PROMPT },
			...(chainOfThoughtMessage ? [chainOfThoughtMessage] : []),
			...state.messages,
		];

		logInfo("[ANSWER] LLM messages:", messages);

		// Use actual LLM service instead of pattern matching
		const llmResponse = await llm.chatCompletions({
			messages: messages,
			max_tokens: 4096,
			temperature: 0.1,
			stream: true,
		});

		let responseContent = "";
		if (Symbol.asyncIterator in llmResponse) {
			for await (const chunk of llmResponse) {
				responseContent += chunk.choices[0].delta.content || "";
				if (this.callbacks?.onNewChunk) {
					this.callbacks.onNewChunk(chunk);
				}
			}
		}
		logInfo("[ANSWER] LLM response:", responseContent);

		return {
			finalMessage: responseContent,
		};
	};

	decisionNode = async (state: AgentState): Promise<Partial<AgentState>> => {
		const llm = this.services.llm;

		if (!llm.isReady()) {
			throw new Error("LLM service is not ready");
		}

		// Build decision prompt dynamically from tools
		const decisionSystemPrompt = `
You are an intelligent agent that can decide whether to use tools to help answer user questions or not. Below are the available tools you can use:
${this.tools.map((tool) => `- ${tool.name}: ${tool.description}`).join("\n")}
Important: Your answer must be one of the following exactly:
- YES_USE_TOOL: if one of available tools can help answer the user's question.
- NO: if <thought> section contains enough information to answer the user's question.
`;

		const chainOfThoughtMessage = this.buildChainOfThought(state);
		// Convert to messages for LLM
		const messages: ChatMessage[] = [
			{ role: "system" as const, content: decisionSystemPrompt },
			...(chainOfThoughtMessage ? [chainOfThoughtMessage] : []),
			...state.messages,
		];

		logInfo("[DECISION] LLM messages:", messages);

		// Use actual LLM service instead of pattern matching
		const llmResponse = (await llm.chatCompletions({
			messages: messages,
			max_tokens: 4096,
			temperature: 0,
			stream: false,
		})) as ChatCompletionResponse;

		const responseContent = llmResponse.choices[0].message.content || "";
		logInfo("[DECISION] LLM response:", responseContent);

		if (responseContent.includes("YES_USE_TOOL")) {
			return {
				next: "agent",
				actions: [
					{
						id: crypto.randomUUID(),
						name: "Use tool",
						description: responseContent
							.replace("YES_USE_TOOL:", "")
							.replace("YES_USE_TOOL", "")
							.trim(),
						metadata: {},
					},
				],
			};
		} else {
			return {
				next: "answer",
				actions: [
					{
						id: crypto.randomUUID(),
						name: "No tool needed",
						description: responseContent
							.replace("NO:", "")
							.replace("NO", "")
							.trim(),
						metadata: {},
					},
				],
			};
		}
	};

	agentNode = async (state: AgentState): Promise<Partial<AgentState>> => {
		const llm = this.services.llm;

		if (!llm.isReady()) {
			throw new Error("LLM service is not ready");
		}

		try {
			const chainOfThoughtMessage = this.buildChainOfThought(state);
			const messages: ChatMessage[] = [
				{ role: "system" as const, content: AGENT_SYSTEM_PROMPT },
				...(chainOfThoughtMessage ? [chainOfThoughtMessage] : []),
				...state.messages,
			];
			const tools = convertToolsToOpenAI(this.tools);

			logInfo("[AGENT] LLM messages:", messages.length, "tools:", tools.length);

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

				if (delta?.content) {
					content += delta.content;
					if (this.callbacks?.onNewChunk) {
						this.callbacks.onNewChunk(chunk);
					}
				}

				if (delta?.tool_calls) {
					for (const tc of delta.tool_calls) {
						const existing = toolCallsMap.get(tc.index);
						if (existing) {
							if (tc.function?.arguments) {
								existing.function.arguments += tc.function.arguments;
							}
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
			logInfo("[AGENT] Stream complete - content:", content.length, "tool_calls:", toolCalls.length);

			if (toolCalls.length > 0) {
				const newStep = {
					role: "assistant" as const,
					content: content || "",
					tool_calls: toolCalls.map((tc) => ({
						id: tc.id,
						name: tc.function.name,
						arguments: tc.function.arguments,
					})),
				};

				return {
					steps: [newStep],
					next: "tools",
					actions: toolCalls.map((tc) => ({
						id: crypto.randomUUID(),
						name: `Calling "${tc.function.name}"`,
						description: `Args: ${tc.function.arguments}`,
						metadata: { tool: tc.function.name },
					})),
				};
			}

			// No tool calls - go back to decision
			const newStep = {
				role: "assistant" as const,
				content,
			};

			return {
				steps: [newStep],
				next: "decision",
				actions: [
					{
						id: crypto.randomUUID(),
						name: "Thinking next step",
						description: "",
						metadata: {},
					},
				],
			};
		} catch (error) {
			logError("Agent node error:", error);
			throw error;
		}
	};

	toolsNode = async (state: AgentState): Promise<Partial<AgentState>> => {
		const lastStep = state.steps[state.steps.length - 1];

		if (!lastStep?.tool_calls || lastStep.tool_calls.length === 0) {
			throw new Error("No tool calls found in the last step");
		}

		const toolResultSteps = [];

		// Execute each tool call
		for (const toolCall of lastStep.tool_calls) {
			const tool = this.toolsMap.get(toolCall.name);

			if (!tool) {
				toolResultSteps.push({
					role: "tool" as const,
					content: `Error: Tool '${toolCall.name}' not found`,
					tool_call_id: toolCall.id,
				});
				continue;
			}

			try {
				// Parse and validate tool arguments
				const args = JSON.parse(toolCall.arguments);
				const validatedArgs = tool.schema.parse(args);

				// Execute the tool (services already bound via factory)
				const result = await tool.execute(validatedArgs);

				// Add tool result to steps
				toolResultSteps.push({
					role: "tool" as const,
					content: result,
					tool_call_id: toolCall.id,
				});
			} catch (error) {
				const errorMessage =
					error instanceof Error ? error.message : "Unknown error";
				toolResultSteps.push({
					role: "tool" as const,
					content: `Error executing ${toolCall.name}: ${errorMessage}`,
					tool_call_id: toolCall.id,
				});
			}
		}

		return {
			steps: toolResultSteps,
			next: "decision",
			actions: [
				{
					id: crypto.randomUUID(),
					name: `Executed ${toolResultSteps.length} tool(s)`,
					description: "",
					metadata: {},
				},
			],
		};
	};
}

// Self-register the flow
flowRegistry.register({
	flowType: "simple",
	factory: (services) => new SimpleGraph(services),
});

// Extend global FlowTypeRegistry for type-safe flow creation
declare global {
	interface FlowTypeRegistry {
		simple: {
			services: AllServices;
			flow: SimpleGraph;
		};
	}
}
