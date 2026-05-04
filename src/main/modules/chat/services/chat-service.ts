import { backgroundJob } from "@/services/background-jobs/background-job";
import type {
	ChatResult,
	ChatStreamConfig,
} from "@/services/background-jobs/handlers/process-chat";
import type {
	ChatCompletionChunkToolCall,
	ChatCompletionMessageToolCall,
	ChatCompletionTool,
	ChatCompletionToolChoiceOption,
	ChatMessage,
} from "@/types/openai";
import type { UnifiedFlowConfig } from "@/services/flows/interfaces/flow-config";

export type ChatMode = "normal" | "custom" | "agent";

export interface ChatServiceOptions {
	messages: ChatMessage[];
	model: string;
	mode: ChatMode;
	topicId?: string;
	agentFlowId?: string;
	flowConfig?: UnifiedFlowConfig;
	streamConfig?: ChatStreamConfig;
	tools?: ChatCompletionTool[];
	tool_choice?: ChatCompletionToolChoiceOption;
	parallel_tool_calls?: boolean;
}

export interface ChatAction {
	id: string;
	name: string;
	description: string;
	metadata: Record<string, unknown>;
}

export interface ChatStreamCallbacks {
	onContent?: (content: string) => void;
	onAction?: (actions: ChatAction[]) => void;
	onExecuteStart?: (event: {
		node: string;
		metadata?: Record<string, unknown>;
	}) => void;
	onError?: (error: string) => void;
}

export interface ChatStreamResult {
	content: string;
	actions: ChatAction[];
	toolCalls?: ChatCompletionMessageToolCall[];
	failed: boolean;
	error?: string;
	usage?: {
		prompt_tokens: number;
		completion_tokens: number;
		total_tokens: number;
	};
}

type ToolCallAccumulator = Map<
	number,
	{
		id: string;
		type: "function";
		function: {
			name: string;
			arguments: string;
		};
	}
>;

const accumulateChunkToolCalls = (
	accumulator: ToolCallAccumulator,
	toolCalls: ChatCompletionChunkToolCall[] | undefined,
): void => {
	if (!toolCalls?.length) {
		return;
	}

	for (const toolCall of toolCalls) {
		const existing = accumulator.get(toolCall.index);
		if (existing) {
			if (toolCall.id) {
				existing.id = toolCall.id;
			}
			if (toolCall.function?.name) {
				existing.function.name = toolCall.function.name;
			}
			if (toolCall.function?.arguments) {
				existing.function.arguments += toolCall.function.arguments;
			}
			continue;
		}

		accumulator.set(toolCall.index, {
			id: toolCall.id || `call_${toolCall.index}_${Date.now()}`,
			type: "function",
			function: {
				name: toolCall.function?.name || "",
				arguments: toolCall.function?.arguments || "",
			},
		});
	}
};

const getAccumulatedToolCalls = (
	accumulator: ToolCallAccumulator,
): ChatCompletionMessageToolCall[] => Array.from(accumulator.values());

const mergeActions = (
	current: ChatAction[],
	incoming: ChatAction[],
): ChatAction[] => {
	if (incoming.length === 0) {
		return current;
	}

	const merged = [...current];

	for (const action of incoming) {
		const existingIndex = merged.findIndex((item) => item.id === action.id);
		if (existingIndex === -1) {
			merged.push(action);
			continue;
		}

		merged[existingIndex] = action;
	}

	return merged;
};

export class ChatService {
	private static instance: ChatService;
	private activeJobs = new Map<string, AbortController>();

	private constructor() {}

	static getInstance(): ChatService {
		if (!ChatService.instance) {
			ChatService.instance = new ChatService();
		}
		return ChatService.instance;
	}

	/**
	 * Execute a chat request with streaming
	 */
	async chatStream(
		options: ChatServiceOptions,
		callbacks?: ChatStreamCallbacks,
		signal?: AbortSignal,
	): Promise<ChatStreamResult> {
		const {
			messages,
			model,
			mode,
			topicId,
			agentFlowId,
			flowConfig,
			streamConfig,
			tools,
			tool_choice,
			parallel_tool_calls,
		} = options;

		const abortController = new AbortController();
		const jobId = `chat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

		// Store abort controller for cleanup
		this.activeJobs.set(jobId, abortController);

		try {
			// Handle external abort signal
			if (signal) {
				signal.addEventListener("abort", () => {
					abortController.abort();
					this.activeJobs.delete(jobId);
				});
			}

			// Execute chat job with streaming
			const result = await backgroundJob.execute(
				"chat",
				{
					messages,
					model,
					mode,
					topicId,
					agentFlowId,
					flowConfig,
					tools,
					tool_choice,
					parallel_tool_calls,
					streamConfig: streamConfig || {
						minWordsToStream: 5,
						streamToolCallsImmediately: true,
					},
				},
				{ stream: true },
			);

			let currentContent = "";
			const actions: ChatAction[] = [];
			let streamFailed = false;
			let streamError = "";
			let usage: ChatStreamResult["usage"];
			const toolCallAccumulator: ToolCallAccumulator = new Map();

			if (!("stream" in result)) {
				return {
					content: "",
					actions,
					failed: true,
					error: "Chat request failed",
				};
			}

			// Process streaming results
			for await (const progress of result.stream) {
				if (abortController.signal.aborted) {
					break;
				}

				// Handle failure
				if (progress.status === "failed") {
					streamFailed = true;
					streamError = progress.error || "Chat request failed";
					callbacks?.onError?.(streamError);
					break;
				}

				// Handle completion - get final content
				if (progress.status === "completed" && progress.result) {
					const chatResult = progress.result as ChatResult;
					if (chatResult.type === "final") {
						// Use the final content from the job result
						currentContent = chatResult.content;
						if (chatResult.metadata?.actions) {
							actions.splice(
								0,
								actions.length,
								...mergeActions(actions, chatResult.metadata.actions),
							);
						}
						if (chatResult.metadata?.tool_calls?.length) {
							for (const [
								index,
								toolCall,
							] of chatResult.metadata.tool_calls.entries()) {
								toolCallAccumulator.set(index, toolCall);
							}
						}
						if (chatResult.metadata?.usage) {
							usage = chatResult.metadata.usage;
						}
					}
				}

				// Process streaming updates
				if (
					["processing", "pending"].includes(progress.status) &&
					progress.result
				) {
					const chatResult = progress.result as ChatResult;

					if (chatResult.type === "chunk" && chatResult.chunk) {
						accumulateChunkToolCalls(
							toolCallAccumulator,
							chatResult.chunk.choices[0]?.delta?.tool_calls,
						);
						// Handle streaming content chunks
						const content = chatResult.chunk.choices[0]?.delta?.content;
						if (content) {
							currentContent += content;
							callbacks?.onContent?.(currentContent);
						}
					} else if (chatResult.type === "action" && chatResult.actions) {
						// Handle action updates
						actions.splice(
							0,
							actions.length,
							...mergeActions(actions, chatResult.actions),
						);
						callbacks?.onAction?.([...actions]);
					} else if (chatResult.type === "execute-start") {
						callbacks?.onExecuteStart?.({
							node: chatResult.node,
							metadata: chatResult.metadata,
						});
					} else if (chatResult.type === "final") {
						// Handle final content update (e.g., after citation step)
						// This replaces the accumulated content with the final version
						currentContent = chatResult.content;
						if (chatResult.metadata?.actions) {
							actions.splice(
								0,
								actions.length,
								...mergeActions(actions, chatResult.metadata.actions),
							);
						}
						if (chatResult.metadata?.tool_calls?.length) {
							for (const [
								index,
								toolCall,
							] of chatResult.metadata.tool_calls.entries()) {
								toolCallAccumulator.set(index, toolCall);
							}
						}
						// Notify with the final cited content
						callbacks?.onContent?.(currentContent);
						callbacks?.onAction?.([...actions]);
					}
				}
			}

			// Return result
			return {
				content: currentContent,
				actions,
				toolCalls: getAccumulatedToolCalls(toolCallAccumulator),
				failed: streamFailed,
				error: streamFailed ? streamError : undefined,
				usage,
			};
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown chat error";
			callbacks?.onError?.(errorMessage);
			throw error;
		} finally {
			this.activeJobs.delete(jobId);
		}
	}

	/**
	 * Stop all active chat requests
	 */
	stopAll(): void {
		for (const [jobId, controller] of this.activeJobs) {
			controller.abort();
		}
		this.activeJobs.clear();
	}

	/**
	 * Stop a specific chat request
	 */
	stop(jobId: string): void {
		const controller = this.activeJobs.get(jobId);
		if (controller) {
			controller.abort();
			this.activeJobs.delete(jobId);
		}
	}
}

export const chatService = ChatService.getInstance();
