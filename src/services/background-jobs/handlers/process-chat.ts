import { BaseProcessHandler } from "./base-process-handler";
import type { ProcessDependencies, BaseJob, ItemHandlerResult } from "./types";
import { serviceManager } from "@/services";
import type {
	ChatCompletionRequest,
	ChatMessage,
	ChatCompletionChunk,
	ChatCompletionChunkToolCall,
	ChatCompletionMessageToolCall,
	ChatCompletionTool,
	ChatCompletionToolChoiceOption,
} from "@/types/openai";
import {
	isCustomChunkPayload,
	normalizeLangGraphStreamChunk,
	type FlowAction,
} from "@/services/flows/utils/langgraph-stream";
import { handlerRegistry } from "./handler-registry";
import type { FoundationState } from "@/services/flows/graph/foundation/state";
import { chatFlowRegistry } from "@/services/flows/chat-flow-registry";
import type { UnifiedFlowConfig } from "@/services/flows/interfaces/flow-config";
import { buildDefaultFlowConfig } from "@/services/flows/build-flow-config";
import { mergeWithDefaultConfig } from "@/services/flows/build-flow-config";
import { sql } from "drizzle-orm";
import { documentFileSystemService } from "@/services/filesystem/document-filesystem";
import {
	getValidRecallTypes,
	isRecallTypeValidForGrow,
	type RecallType,
} from "@/services/database/entities/topic-types";
import { createJobErrorMetadata, getErrorMessage } from "./error-metadata";

export interface ChatStreamConfig {
	/** Minimum number of words to buffer before streaming (default: 5) */
	minWordsToStream?: number;
	/** Whether to stream tool calls immediately (default: true) */
	streamToolCallsImmediately?: boolean;
}

export interface ChatPayload {
	messages: ChatMessage[];
	model: string;
	mode: "normal" | "agent" | "custom";
	topicId?: string; // For topic filtering in custom mode
	agentFlowId?: string;
	flowConfig?: UnifiedFlowConfig;
	streamConfig?: ChatStreamConfig;
	tools?: ChatCompletionTool[];
	tool_choice?: ChatCompletionToolChoiceOption;
	parallel_tool_calls?: boolean;
}

export type ChatResult =
	| {
			type: "chunk";
			chunk?: ChatCompletionChunk;
	  }
	| {
			type: "execute-start";
			node: string;
			metadata?: Record<string, unknown>;
	  }
	| {
			type: "final";
			content: string;
			metadata?: {
				actions?: Array<{
					id: string;
					name: string;
					description: string;
					metadata: Record<string, unknown>;
				}>;
				tool_calls?: ChatCompletionMessageToolCall[];
				usage?: {
					prompt_tokens: number;
					completion_tokens: number;
					total_tokens: number;
				};
			};
	  }
	| {
			type: "action";
			actions?: Array<{
				id: string;
				name: string;
				description: string;
				metadata: Record<string, unknown>;
			}>;
	  };

const JOB_NAMES = {
	chat: "chat",
} as const;

export type ChatJob = BaseJob & {
	jobType: typeof JOB_NAMES.chat;
	payload: ChatPayload;
};

/**
 * Helper class to buffer streaming content and emit when threshold is reached
 */
class StreamBuffer {
	private buffer: string = "";
	private wordCount: number = 0;
	private readonly minWords: number;
	private onEmit: (content: string) => void;

	constructor(minWords: number, onEmit: (content: string) => void) {
		this.minWords = minWords;
		this.onEmit = onEmit;
	}

	/**
	 * Add content to buffer and emit if word threshold reached
	 */
	add(content: string): void {
		this.buffer += content;

		// Count words by splitting on whitespace
		const words = this.buffer.trim().split(/\s+/);
		this.wordCount = words.length;

		// Emit if we've reached the minimum word count
		if (this.wordCount >= this.minWords) {
			this.flush();
		}
	}

	/**
	 * Force emit all buffered content
	 */
	flush(): void {
		if (this.buffer) {
			this.onEmit(this.buffer);
			this.buffer = "";
			this.wordCount = 0;
		}
	}

	/**
	 * Get current buffer without flushing
	 */
	peek(): string {
		return this.buffer;
	}
}

type TokenUsage = {
	prompt_tokens: number;
	completion_tokens: number;
	total_tokens: number;
};

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

const RECALL_STEP_BY_TYPE: Record<RecallType, string> = {
	smart: "context-smart-retrieve",
	quick: "context-quick-retrieve",
	llm: "context-llm-retrieve",
	structmem: "structmem-retrieve",
};

const RETRIEVAL_STEP_NAMES = new Set(Object.values(RECALL_STEP_BY_TYPE));

function applyTopicRecallType(
	config: UnifiedFlowConfig,
	recallType: RecallType | undefined,
): UnifiedFlowConfig {
	if (!recallType) return config;

	const selectedStepName = RECALL_STEP_BY_TYPE[recallType];
	return {
		...config,
		steps: config.steps.map((step) =>
			RETRIEVAL_STEP_NAMES.has(step.name)
				? { ...step, enabled: step.name === selectedStepName }
				: step,
		),
	};
}

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
			if (toolCall.function?.name) {
				existing.function.name = toolCall.function.name;
			}
			if (toolCall.function?.arguments) {
				existing.function.arguments += toolCall.function.arguments;
			}
			if (toolCall.id) {
				existing.id = toolCall.id;
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

type FlowStreamDeps = {
	jobId: string;
	model: string;
	config: Required<ChatStreamConfig>;
	dependencies: ProcessDependencies;
	streamBuffer: StreamBuffer;
	getProgress: () => number;
	onUsage?: (usage: TokenUsage) => void;
	onToolCalls?: (toolCalls: ChatCompletionChunkToolCall[] | undefined) => void;
};

type StreamBufferDeps = {
	jobId: string;
	model: string;
	config: Required<ChatStreamConfig>;
	dependencies: ProcessDependencies;
	onContent: (content: string) => void;
	getProgress: () => number;
};

export class ChatHandler extends BaseProcessHandler<ChatJob> {
	constructor() {
		super();
	}

	private static createStreamBuffer(deps: StreamBufferDeps): StreamBuffer {
		return new StreamBuffer(deps.config.minWordsToStream, (bufferedContent) => {
			deps.onContent(bufferedContent);
			deps.dependencies.updateJobProgress(deps.jobId, {
				stage: "Receiving response...",
				progress: deps.getProgress(),
				result: {
					type: "chunk",
					chunk: {
						id: `chunk-${Date.now()}`,
						object: "chat.completion.chunk",
						created: Math.floor(Date.now() / 1000),
						model: deps.model,
						choices: [
							{
								index: 0,
								delta: { content: bufferedContent, role: "assistant" },
								finish_reason: null,
							},
						],
					},
				} as ChatResult,
			});
		});
	}

	private static hasToolCalls(
		delta: ChatCompletionChunk["choices"][number]["delta"] | undefined,
	): boolean {
		return Array.isArray(delta?.tool_calls) && delta.tool_calls.length > 0;
	}

	private static createHandleChunk(deps: FlowStreamDeps) {
		return async (chunk: ChatCompletionChunk) => {
			if (chunk.usage) {
				deps.onUsage?.(chunk.usage);
			}

			const choice = chunk.choices?.[0];
			if (!choice) {
				return;
			}

			const delta = choice.delta;

			if (
				deps.config.streamToolCallsImmediately &&
				ChatHandler.hasToolCalls(delta)
			) {
				deps.onToolCalls?.(delta.tool_calls);
				await deps.dependencies.updateJobProgress(deps.jobId, {
					stage: "Tool call in progress...",
					progress: deps.getProgress(),
					result: {
						type: "chunk",
						chunk,
					} as ChatResult,
				});
				return;
			}

			const content = delta?.content ?? "";
			if (content) {
				deps.streamBuffer.add(content);
			}

			if (delta?.role || choice.finish_reason) {
				const chunkToSend = content
					? {
							...chunk,
							choices: [
								{
									...choice,
									delta: {
										...delta,
										content: undefined,
									},
								},
							],
						}
					: chunk;

				await deps.dependencies.updateJobProgress(deps.jobId, {
					stage: "Receiving response...",
					progress: deps.getProgress(),
					result: {
						type: "chunk",
						chunk: chunkToSend,
					} as ChatResult,
				});
			}
		};
	}

	private static createFlowHandleActions(
		dependencies: ProcessDependencies,
		jobId: string,
		actions: FlowAction[],
	) {
		return (next: FlowAction[]) => {
			let added = false;
			for (const action of next) {
				if (!actions.find((a) => a.id === action.id)) {
					actions.push(action);
					added = true;
				}
			}
			if (added) {
				dependencies.updateJobProgress(jobId, {
					stage: "Receiving response...",
					progress: 10,
					result: {
						type: "action",
						actions,
					} as ChatResult,
				});
			}
		};
	}

	private static async streamChatCompletions(
		stream: AsyncIterableIterator<ChatCompletionChunk>,
		handleChunk: (chunk: ChatCompletionChunk) => Promise<void>,
	) {
		for await (const chunk of stream) {
			await handleChunk(chunk);
		}
	}

	async process(
		jobId: string,
		job: ChatJob,
		dependencies: ProcessDependencies,
	): Promise<ItemHandlerResult> {
		const {
			messages,
			model,
			mode,
			topicId,
			agentFlowId,
			streamConfig,
			tools,
			tool_choice,
			parallel_tool_calls,
		} = job.payload;

		// Apply default stream config
		const config: Required<ChatStreamConfig> = {
			minWordsToStream: streamConfig?.minWordsToStream ?? 5,
			streamToolCallsImmediately:
				streamConfig?.streamToolCallsImmediately ?? true,
		};

		await dependencies.logger.info(
			`🤖 Starting chat job: ${jobId}`,
			{
				messageCount: messages.length,
				model,
				mode,
				streamConfig: config,
			},
			"offscreen",
		);

		let currentContent = "";
		const actions: FlowAction[] = [];
		const toolCallAccumulator: ToolCallAccumulator = new Map();
		const accumulatedUsage: TokenUsage = {
			prompt_tokens: 0,
			completion_tokens: 0,
			total_tokens: 0,
		};
		const addUsage = (usage: TokenUsage) => {
			accumulatedUsage.prompt_tokens += usage.prompt_tokens;
			accumulatedUsage.completion_tokens += usage.completion_tokens;
			accumulatedUsage.total_tokens += usage.total_tokens;
		};

		// Create stream buffer for content
		const streamBuffer = ChatHandler.createStreamBuffer({
			jobId,
			model,
			config,
			dependencies,
			onContent: (bufferedContent) => {
				currentContent += bufferedContent;
			},
			getProgress: () => Math.min(80, 20 + currentContent.length / 10),
		});

		try {
			// Send initial progress update
			await dependencies.updateJobProgress(jobId, {
				stage: "Initializing chat processing...",
				progress: 5,
			});

			if (mode === "agent") {
				await dependencies.updateJobProgress(jobId, {
					stage: "Running Agent...",
					progress: 20,
				});

				let flowConfig: UnifiedFlowConfig | null = null;
				try {
					flowConfig = job.payload.flowConfig
						? job.payload.flowConfig
						: agentFlowId
							? await serviceManager.flowBuilderService.getUnifiedFlowConfig({
									flowId: agentFlowId,
								})
							: buildDefaultFlowConfig("agent");
				} catch (err) {
					await dependencies.logger.warn(
						"Failed to load agent flow config, using defaults",
						`${err}`,
						"offscreen",
					);
				}

				const resolvedConfig = flowConfig
					? mergeWithDefaultConfig(flowConfig, flowConfig.graphType)
					: buildDefaultFlowConfig("agent");
				const allServices = {
					llm: serviceManager.llmService,
					embedding: serviceManager.embeddingService,
					database: serviceManager.databaseService,
					sandboxContainer: serviceManager.getSandboxContainerService(),
					webBrowser: serviceManager.getWebBrowserService(),
					documentFileSystem: documentFileSystemService,
				};
				const { graph, getInitialState } = chatFlowRegistry.create(
					resolvedConfig.graphType ?? "agent",
					allServices,
					resolvedConfig,
				);
				const stream = await graph.stream(
					getInitialState({ messages, topicId, contextQueries: [] }),
					{
						streamMode: ["custom", "values"],
					},
				);

				const responseProgress = () =>
					Math.min(80, 20 + currentContent.length / 10);
				const handleChunk = ChatHandler.createHandleChunk({
					jobId,
					model,
					config,
					dependencies,
					streamBuffer,
					getProgress: responseProgress,
					onUsage: addUsage,
					onToolCalls: (toolCalls) =>
						accumulateChunkToolCalls(toolCallAccumulator, toolCalls),
				});
				const handleActions = ChatHandler.createFlowHandleActions(
					dependencies,
					jobId,
					actions,
				);

				let finalState: Record<string, unknown> | null = null;
				for await (const partial of stream) {
					const { mode, payload } = normalizeLangGraphStreamChunk(partial);

					if (mode === "custom" && isCustomChunkPayload(payload)) {
						switch (payload.type) {
							case "llm":
								if ("chunk" in payload) {
									await handleChunk(payload.chunk as ChatCompletionChunk);
								}
								break;
							case "actions":
								if ("actions" in payload) {
									handleActions(payload.actions as FlowAction[]);
								}
								break;
							case "execute-start":
								if ("node" in payload) {
									dependencies.updateJobProgress(jobId, {
										stage: "Executing agent action...",
										progress: 12,
										result: {
											type: "execute-start",
											node: payload.node,
											metadata: payload.metadata,
										} as ChatResult,
									});
								}
								break;
						}
						continue;
					}

					if (mode === "values") {
						finalState = payload as Record<string, unknown>;
					}
				}

				streamBuffer.flush();

				if (typeof finalState?.response === "string") {
					currentContent = finalState.response;
					await dependencies.updateJobProgress(jobId, {
						stage: "Agent complete",
						progress: 95,
						result: {
							type: "final",
							content: currentContent,
							metadata: { actions },
						} as ChatResult,
					});
				}
			} else if (mode === "custom") {
				// Load unified flow config — steps carry both their settings and enabled state.
				// Falls back to the canonical default on failure so the graph always runs.
				let flowConfig: UnifiedFlowConfig | null = null;
				try {
					flowConfig = job.payload.flowConfig
						? job.payload.flowConfig
						: agentFlowId
							? await serviceManager.flowBuilderService.getUnifiedFlowConfig({
									flowId: agentFlowId,
								})
							: await serviceManager.flowBuilderService.getUnifiedFlowConfig({
									predefinedFlow: "foundation",
								});
				} catch (err) {
					await dependencies.logger.warn(
						"Failed to load flow config, using defaults",
						`${err}`,
						"offscreen",
					);
				}

				let resolvedConfig = flowConfig
					? mergeWithDefaultConfig(flowConfig, flowConfig.graphType)
					: buildDefaultFlowConfig("foundation");

				await dependencies.updateJobProgress(jobId, {
					stage: "Running Custom Flow...",
					progress: 20,
				});

				// Fetch topic info for retrieval context queries if topicId exists
				const contextQueries: string[] = [];
				let topicRecallType: RecallType | undefined;
				if (topicId) {
					try {
						const topicInfo = await serviceManager.databaseService.use(
							async ({ db, schema }) => {
								const rows = await db
									.select()
									.from(schema.topics)
									.where(sql`${schema.topics.id} = ${topicId}`)
									.limit(1);

								if (rows.length > 0) {
									const row = rows[0];
									const name = row.name || "Unknown Topic";
									const desc = row.description || row.name || "";
									return {
										contextQuery: desc ? `${name}: ${desc}` : name,
										growType: row.growType,
										recallType: row.recallType,
									};
								}
								return undefined;
							},
						);
						if (topicInfo) {
							contextQueries.push(topicInfo.contextQuery);
							topicRecallType = isRecallTypeValidForGrow(
								topicInfo.growType,
								topicInfo.recallType,
							)
								? topicInfo.recallType
								: getValidRecallTypes(topicInfo.growType)[0];
						}
					} catch (error) {
						await dependencies.logger.warn(
							`Failed to fetch topic info for ${topicId}:`,
							`${error}`,
							"offscreen",
						);
					}
				}

				resolvedConfig = applyTopicRecallType(resolvedConfig, topicRecallType);
				const graphType = resolvedConfig.graphType ?? "foundation";

				// Resolve the chat flow via registry — no graph-type branching here.
				// Each graph module self-registers its adapter in chat-flow-registry.ts.
				const allServices = {
					llm: serviceManager.llmService,
					embedding: serviceManager.embeddingService,
					database: serviceManager.databaseService,
					sandboxContainer: serviceManager.getSandboxContainerService(),
					webBrowser: serviceManager.getWebBrowserService(),
					documentFileSystem: documentFileSystemService,
				};
				const { graph, getInitialState } = chatFlowRegistry.create(
					graphType,
					allServices,
					resolvedConfig,
				);

				let finalState: FoundationState | null = null;

				const stream = await graph.stream(
					getInitialState({ messages, topicId, contextQueries }),
					{
						streamMode: ["custom", "updates", "values"],
					},
				);

				const responseProgress = () =>
					Math.min(80, 20 + currentContent.length / 10);
				const handleChunk = ChatHandler.createHandleChunk({
					jobId,
					model,
					config,
					dependencies,
					streamBuffer,
					getProgress: responseProgress,
					onUsage: addUsage,
					onToolCalls: (toolCalls) =>
						accumulateChunkToolCalls(toolCallAccumulator, toolCalls),
				});
				const handleActions = ChatHandler.createFlowHandleActions(
					dependencies,
					jobId,
					actions,
				);

				for await (const partial of stream) {
					const { mode, payload } = normalizeLangGraphStreamChunk(partial);

					if (mode === "custom" && isCustomChunkPayload(payload)) {
						switch (payload.type) {
							case "llm":
								if ("chunk" in payload) {
									await handleChunk(payload.chunk as ChatCompletionChunk);
								}
								break;
							case "actions":
								if ("actions" in payload) {
									handleActions(payload.actions as FlowAction[]);
								}
								break;
							case "execute-start":
								if ("node" in payload) {
									dependencies.updateJobProgress(jobId, {
										stage: "Executing...",
										progress: 12,
										result: {
											type: "execute-start",
											node: payload.node,
											metadata: payload.metadata,
										} as ChatResult,
									});
								}
								break;
						}
						continue;
					}

					// Capture the final state for citation content
					if (mode === "values") {
						finalState = payload as FoundationState;
					}
				}

				// Flush any remaining buffered content from streaming
				streamBuffer.flush();

				if (finalState) {
					const response = finalState.response;

					// If found and different from current content, update
					if (response && response !== currentContent) {
						currentContent = response;

						// Send a final update to replace the streamed content with cited version
						await dependencies.updateJobProgress(jobId, {
							stage: "Adding citations...",
							progress: 95,
							result: {
								type: "final",
								content: response,
								metadata: { actions },
							} as ChatResult,
						});
					}
				}
			} else {
				// Normal mode - direct LLM call (following use-chat.ts pattern exactly)
				const request: ChatCompletionRequest = {
					messages: messages,
					model: model,
					temperature: 0.3,
					stream: true,
					tools,
					tool_choice,
					parallel_tool_calls,
				};

				await dependencies.updateJobProgress(jobId, {
					stage: "Sending request to LLM...",
					progress: 20,
				});

				try {
					// Use the exact same pattern from use-chat.ts lines 294-304
					if (request.stream) {
						// For streaming, the result should be an AsyncIterableIterator
						const stream = serviceManager.llmService.chatCompletions(
							request,
						) as AsyncIterableIterator<ChatCompletionChunk>;
						const handleChunk = ChatHandler.createHandleChunk({
							jobId,
							model,
							config,
							dependencies,
							streamBuffer,
							getProgress: () => Math.min(80, 20 + currentContent.length / 10),
							onUsage: addUsage,
							onToolCalls: (toolCalls) =>
								accumulateChunkToolCalls(toolCallAccumulator, toolCalls),
						});
						await ChatHandler.streamChatCompletions(stream, handleChunk);
					}
				} catch (streamError) {
					throw streamError;
				}

				// Flush any remaining buffered content
				streamBuffer.flush();
			}

			return {
				type: "final",
				content: currentContent,
				metadata: {
					actions,
					tool_calls: getAccumulatedToolCalls(toolCallAccumulator),
					usage:
						accumulatedUsage.total_tokens > 0 ? accumulatedUsage : undefined,
				},
			};
		} catch (error) {
			const errorMessage = getErrorMessage(error);
			const errorMetadata = createJobErrorMetadata(error);
			await dependencies.logger.error(
				`❌ Chat job ${jobId} failed`,
				error,
				"offscreen",
			);

			await dependencies.updateJobProgress(jobId, {
				stage: "Chat failed",
				progress: 100,
				error: errorMessage,
				metadata: { error: errorMetadata },
			});

			throw error;
		}
	}
}

// Register the handler
const chatHandler = new ChatHandler();
handlerRegistry.register({
	instance: chatHandler,
	jobs: [JOB_NAMES.chat],
});

// Extend global registry for smart type inference
declare global {
	interface JobTypeRegistry {
		chat: ChatPayload;
	}

	interface JobResultRegistry {
		chat: ChatResult;
	}
}
