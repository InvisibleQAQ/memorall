import { BaseProcessHandler } from "./base-process-handler";
import type { ProcessDependencies, BaseJob, ItemHandlerResult } from "./types";
import { serviceManager } from "@/services";
import type {
	ChatCompletionRequest,
	ChatMessage,
	ChatCompletionChunk,
} from "@/types/openai";
import {
	isCustomChunkPayload,
	normalizeLangGraphStreamChunk,
	type FlowAction,
} from "@/services/flows/utils/langgraph-stream";
import { handlerRegistry } from "./handler-registry";
import type {
	KnowledgeRAGState,
	KnowledgeRAGPredefinedConfig,
} from "@/services/flows/graph/knowledge-rag/state";
import { DEFAULT_KNOWLEDGE_RAG_PREDEFINED_CONFIG as DEFAULT_AGENT_CONFIG } from "@/services/flows/graph/knowledge-rag/state";
import { chatFlowRegistry } from "@/services/flows/chat-flow-registry";
import { sql } from "drizzle-orm";
import { documentFileSystemService } from "@/services/filesystem/document-filesystem";

export interface ChatStreamConfig {
	/** Minimum number of words to buffer before streaming (default: 5) */
	minWordsToStream?: number;
	/** Whether to stream tool calls immediately (default: true) */
	streamToolCallsImmediately?: boolean;
}

export interface ChatPayload {
	messages: ChatMessage[];
	model: string;
	mode: "normal" | "agent" | "knowledge";
	topicId?: string; // For topic filtering in knowledge mode
	agentFlowId?: string;
	streamConfig?: ChatStreamConfig;
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

type KnowledgeStreamDeps = {
	jobId: string;
	model: string;
	config: Required<ChatStreamConfig>;
	dependencies: ProcessDependencies;
	streamBuffer: StreamBuffer;
	getProgress: () => number;
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

	private static createHandleChunk(deps: KnowledgeStreamDeps) {
		return async (chunk: ChatCompletionChunk) => {
			const choice = chunk.choices?.[0];
			if (!choice) {
				return;
			}

			const delta = choice.delta;

			if (
				deps.config.streamToolCallsImmediately &&
				ChatHandler.hasToolCalls(delta)
			) {
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

	private static createKnowledgeHandleActions(
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
		const { messages, model, mode, topicId, agentFlowId, streamConfig } =
			job.payload;

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

			if (mode === "knowledge") {
				// Load agent config from predefined flow (fall back to defaults on failure)
				let agentConfig: KnowledgeRAGPredefinedConfig | null = null;
				try {
					const config = agentFlowId
						? await serviceManager.flowBuilderService.getFlowConfig({
								flowId: agentFlowId,
							})
						: await serviceManager.flowBuilderService.getFlowConfig({
								predefinedFlow: "knowledge-rag",
							});
					agentConfig = config as KnowledgeRAGPredefinedConfig;
				} catch (err) {
					await dependencies.logger.warn(
						"Failed to load agent config, using defaults",
						`${err}`,
						"offscreen",
					);
				}

				// Load feature flags to pass to graph (features add tools + system prompts)
				let featureFlags: Record<string, boolean> = {};
				try {
					featureFlags = agentFlowId
						? await serviceManager.flowBuilderService.getFlowFeatureFlags({
								flowId: agentFlowId,
							})
						: await serviceManager.flowBuilderService.getFlowFeatureFlags({
								predefinedFlow: "knowledge-rag",
							});
				} catch (err) {
					await dependencies.logger.warn(
						"Failed to load feature flags, using defaults",
						`${err}`,
						"offscreen",
					);
				}

				// Resolve the chat flow via registry — no graph-type branching here.
				// Each graph module self-registers its adapter in chat-flow-registry.ts.
				const resolvedConfig = agentConfig ?? DEFAULT_AGENT_CONFIG;
				const graphType = resolvedConfig.graphType ?? "knowledge-rag";
				const allServices = {
					llm: serviceManager.llmService,
					embedding: serviceManager.embeddingService,
					database: serviceManager.databaseService,
					sandboxContainer: serviceManager.getSandboxContainerService(),
					documentFileSystem: documentFileSystemService,
				};
				const { graph, getInitialState } = chatFlowRegistry.create(
					graphType,
					allServices,
					resolvedConfig,
					featureFlags,
				);

				await dependencies.updateJobProgress(jobId, {
					stage: "Searching knowledge base...",
					progress: 20,
				});

				// Fetch topic info for retrieval context queries if topicId exists
				const contextQueries: string[] = [];
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
									return desc ? `${name}: ${desc}` : name;
								}
								return undefined;
							},
						);
						if (topicInfo) {
							contextQueries.push(topicInfo);
						}
					} catch (error) {
						await dependencies.logger.warn(
							`Failed to fetch topic info for ${topicId}:`,
							`${error}`,
							"offscreen",
						);
					}
				}

				let finalState: KnowledgeRAGState | null = null;

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
				});
				const handleActions = ChatHandler.createKnowledgeHandleActions(
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
						finalState = payload as KnowledgeRAGState;
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
				metadata: { actions },
			};
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			await dependencies.logger.error(
				`❌ Chat job ${jobId} failed`,
				error,
				"offscreen",
			);

			await dependencies.updateJobProgress(jobId, {
				stage: "Chat failed",
				progress: 100,
				error: errorMessage,
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
