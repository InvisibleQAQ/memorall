import type {
	BaseLLM,
	LLMInfo,
	ModelInfo,
	ModelsResponse,
} from "../interfaces/base-llm";
import type {
	ChatCompletionChunk,
	ChatCompletionRequest,
	ChatCompletionResponse,
} from "@/types/openai";
import type { ToolCapabilityInfo } from "../interfaces/tool-capability";
import {
	extractToolCallsFromResponse,
	preparePromptToolRequest,
	PromptToolStreamTransformer,
} from "../tools/tool-adapter";
import { getWebLLMToolCapabilities } from "../tools/tool-capability-resolver";
import {
	chunkHasFinishReason,
	extractChunkOutputText,
	extractResponseOutputText,
	normalizeTokenUsage,
	resolveTokenUsage,
} from "../utils/token-usage";
import { LLM_RUNNER_URLS } from "@/config/llm-runner";
import { waitForDOMReady } from "@/utils/dom";
import { detectSystemSpecs } from "@/main/modules/llm/utils/system-detection";
import {
	buildRunnerMemoryHint,
	type RunnerMemoryHint,
} from "../utils/runner-memory-hints";

interface ServeRequest {
	model: string;
}

interface UnloadRequest {
	model: string;
}

interface DeleteRequest {
	model: string;
}

interface ProgressEvent {
	loaded: number;
	total: number;
	percent: number;
}

interface BaseMessage {
	messageId: string;
}

interface OutgoingMessage extends BaseMessage {
	type: "init" | "serve" | "models" | "chat/completions" | "unload" | "delete";
	payload?: unknown;
}

interface IncomingMessage extends BaseMessage {
	type: "ready" | "complete" | "error" | "progress" | "chunk" | "end";
	payload?: unknown;
}

interface ErrorResponse {
	error: {
		message: string;
		type: string;
		code: string | null;
	};
}

type PendingRequest = {
	resolve: (value: unknown) => void;
	reject: (error: Error) => void;
	onProgress?: (progress: ProgressEvent) => void;
	onStreamChunk?: (chunk: ChatCompletionChunk) => void;
	signalId?: string;
};

export class WebLLMLLM implements BaseLLM {
	name = "webllm";
	private iframe: HTMLIFrameElement | null = null;
	private ready = false;
	private loading = false;
	private pending = new Map<string, PendingRequest>();
	private signalMap = new Map<string, AbortSignal>();
	private systemSpecsPromise: Promise<Awaited<
		ReturnType<typeof detectSystemSpecs>
	> | null> | null = null;
	private url: string;

	constructor(url = LLM_RUNNER_URLS.webllm) {
		this.url = url;
	}

	async initialize(): Promise<void> {
		if (this.ready) return;
		if (this.loading) {
			while (this.loading) await new Promise((r) => setTimeout(r, 50));
			return;
		}
		this.loading = true;
		try {
			await waitForDOMReady();
			this.iframe = document.createElement("iframe");
			this.iframe.src = this.url;
			this.iframe.style.display = "none";
			document.body.appendChild(this.iframe);

			window.addEventListener("message", this.onMessage);

			await new Promise<void>((resolve) => {
				const handler = (e: MessageEvent<IncomingMessage>) => {
					if (e.data?.messageId === "RUNNER_READY") {
						const isFromRunner = e.source === this.iframe?.contentWindow;
						if (isFromRunner) {
							window.removeEventListener("message", handler);
							resolve();
						}
					}
				};
				window.addEventListener("message", handler);
			});

			try {
				await this.send("init");
				this.ready = true;
			} catch (initError) {
				// Handle WebLLM iframe incompatibility
				if (
					initError instanceof Error &&
					(initError.message.includes("IFRAME_WEBLLM_INCOMPATIBLE") ||
						initError.message.includes("onmessage") ||
						initError.message.includes("worker"))
				) {
					throw new Error(
						"WebLLM is not compatible with iframe contexts due to browser security restrictions. Please use the Wllama provider for local models.",
					);
				}
				throw initError;
			}
		} finally {
			this.loading = false;
		}
	}

	isReady(): boolean {
		return this.ready;
	}

	async getMaxModelTokens(model?: string): Promise<number> {
		return 4096;
	}

	async getMaxResponseTokens(model?: string): Promise<number> {
		return Math.round(4096 * 0.5);
	}

	async models(): Promise<ModelsResponse> {
		if (!this.ready) await this.initialize();
		const response = (await this.send("models")) as ModelsResponse;
		response.data.forEach((model) => {
			model.provider = "webllm";
		});
		return response;
	}

	chatCompletions(
		request: ChatCompletionRequest & { stream?: false },
	): Promise<ChatCompletionResponse>;
	chatCompletions(
		request: ChatCompletionRequest & { stream: true },
	): AsyncIterableIterator<ChatCompletionChunk>;
	chatCompletions(
		request: ChatCompletionRequest,
	):
		| Promise<ChatCompletionResponse>
		| AsyncIterableIterator<ChatCompletionChunk> {
		if (request.stream) {
			return this.createStreamingCompletion(request);
		} else {
			return this.createCompletion(request);
		}
	}

	private async createCompletion(
		request: ChatCompletionRequest,
	): Promise<ChatCompletionResponse> {
		if (!this.ready) await this.initialize();

		const capability = await this.getToolCapabilities(request.model);
		const shouldNormalizePromptMessages =
			capability.mode === "prompt_injection";
		const usePromptToolParsing =
			shouldNormalizePromptMessages && !!request.tools?.length;
		const processedRequest = shouldNormalizePromptMessages
			? preparePromptToolRequest(request)
			: request;

		const { signal, ...serializableRequest } = processedRequest;
		const requestPayload =
			capability.mode === "native"
				? serializableRequest
				: (() => {
						const {
							tools,
							tool_choice,
							parallel_tool_calls,
							...promptRequestPayload
						} = serializableRequest;
						return promptRequestPayload;
					})();

		let signalId: string | undefined;
		if (signal) {
			signalId = Math.random().toString(36).slice(2);
			this.signalMap.set(signalId, signal);
		}
		const payloadWithHints = await this.withRunnerMemoryHint(requestPayload);

		try {
			let response = (await this.send("chat/completions", payloadWithHints, {
				signalId,
			})) as ChatCompletionResponse;

			response = {
				...response,
				usage: resolveTokenUsage(
					response.usage,
					processedRequest.messages,
					extractResponseOutputText(response),
				),
			};

			// Extract tool calls from text if using prompt injection
			if (usePromptToolParsing) {
				response = extractToolCallsFromResponse(response);
			}

			return response;
		} finally {
			if (signalId) {
				this.signalMap.delete(signalId);
			}
		}
	}

	private async *createStreamingCompletion(
		request: ChatCompletionRequest,
	): AsyncIterableIterator<ChatCompletionChunk> {
		if (!this.ready) await this.initialize();

		const capability = await this.getToolCapabilities(request.model);
		const shouldNormalizePromptMessages =
			capability.mode === "prompt_injection";
		const usePromptToolParsing =
			shouldNormalizePromptMessages && !!request.tools?.length;
		const processedRequest = shouldNormalizePromptMessages
			? preparePromptToolRequest(request)
			: request;

		const { signal, ...serializableRequest } = processedRequest;
		const requestPayload =
			capability.mode === "native"
				? serializableRequest
				: (() => {
						const {
							tools,
							tool_choice,
							parallel_tool_calls,
							...promptRequestPayload
						} = serializableRequest;
						return promptRequestPayload;
					})();

		let signalId: string | undefined;
		if (signal) {
			signalId = Math.random().toString(36).slice(2);
			this.signalMap.set(signalId, signal);
		}
		const payloadWithHints = await this.withRunnerMemoryHint(requestPayload);

		try {
			const chunks: ChatCompletionChunk[] = [];
			let streamEnded = false;
			let streamError: Error | null = null;
			let completionOutput = "";
			let finalUsage = normalizeTokenUsage(undefined);
			const promptToolTransformer = usePromptToolParsing
				? new PromptToolStreamTransformer()
				: null;

			const chunkHandler = (incomingChunk: ChatCompletionChunk) => {
				const usage = normalizeTokenUsage(incomingChunk.usage);
				if (usage) {
					finalUsage = usage;
				}

				completionOutput += extractChunkOutputText(incomingChunk);

				const chunk =
					!usage && !finalUsage && chunkHasFinishReason(incomingChunk)
						? {
								...incomingChunk,
								usage: resolveTokenUsage(
									undefined,
									processedRequest.messages,
									completionOutput,
								),
							}
						: usage
							? { ...incomingChunk, usage }
							: incomingChunk;

				if (!promptToolTransformer) {
					chunks.push(chunk);
					return;
				}

				chunks.push(...promptToolTransformer.ingest(chunk));
			};

			const streamPromise = this.send("chat/completions", payloadWithHints, {
				onStreamChunk: chunkHandler,
				signalId,
			}).catch((error) => {
				streamError = error;
				streamEnded = true;
			});

			// Wait for chunks to arrive
			while (!streamEnded && !streamError) {
				if (chunks.length > 0) {
					const chunk = chunks.shift()!;
					yield chunk;
					if (chunk.choices[0]?.finish_reason) {
						streamEnded = true;
					}
				} else {
					await new Promise((resolve) => setTimeout(resolve, 10));
				}
			}

			// Yield any remaining chunks
			while (chunks.length > 0) {
				yield chunks.shift()!;
			}

			if (promptToolTransformer) {
				for (const chunk of promptToolTransformer.flush()) {
					yield chunk;
				}
			}

			if (streamError) {
				throw streamError;
			}

			await streamPromise;
		} finally {
			if (signalId) {
				this.signalMap.delete(signalId);
			}
		}
	}

	async unload(modelId: string): Promise<void> {
		if (!this.ready) await this.initialize();
		// WebLLM models use different validation - check against prebuiltAppConfig.model_list
		const request: UnloadRequest = { model: modelId };
		await this.send("unload", request);
	}

	async delete(modelId: string): Promise<void> {
		if (!this.ready) await this.initialize();
		// WebLLM models use different validation - check against prebuiltAppConfig.model_list
		const request: DeleteRequest = { model: modelId };
		await this.send("delete", request);
	}

	async getToolCapabilities(model?: string): Promise<ToolCapabilityInfo> {
		return getWebLLMToolCapabilities(model);
	}

	async supportsTools(model?: string): Promise<boolean> {
		const capability = await this.getToolCapabilities(model);
		return capability.supported;
	}

	getInfo(): LLMInfo {
		return {
			name: this.name,
			type: "webllm",
			ready: this.ready,
		};
	}

	async serve(
		model: string,
		onProgress?: (progress: ProgressEvent) => void,
	): Promise<ModelInfo> {
		if (!this.ready) await this.initialize();
		// WebLLM models must be validated against prebuiltAppConfig.model_list
		// No need to validate format here - runner will handle validation
		const request: ServeRequest = { model };
		const response = await this.send("serve", request, { onProgress });
		return response as ModelInfo;
	}

	async loadModelFromHF(
		model: string,
		onProgress?: (progress: ProgressEvent) => void,
	): Promise<void> {
		// For WebLLM, this is the same as serve since WebLLM handles model loading
		await this.serve(model, onProgress);
	}

	private async withRunnerMemoryHint(
		requestPayload: Omit<ChatCompletionRequest, "signal">,
	): Promise<
		Omit<ChatCompletionRequest, "signal"> & { _memoryHint?: RunnerMemoryHint }
	> {
		const memoryHint = await this.getRunnerMemoryHint(requestPayload.model);
		if (!memoryHint) {
			return requestPayload;
		}

		return {
			...requestPayload,
			_memoryHint: memoryHint,
		};
	}

	private async getRunnerMemoryHint(
		modelId?: string,
	): Promise<RunnerMemoryHint | undefined> {
		const specs = await this.getSystemSpecs();
		return buildRunnerMemoryHint(modelId, "webllm", specs);
	}

	private async getSystemSpecs(): Promise<Awaited<
		ReturnType<typeof detectSystemSpecs>
	> | null> {
		if (!this.systemSpecsPromise) {
			this.systemSpecsPromise = detectSystemSpecs().catch(() => null);
		}

		return this.systemSpecsPromise;
	}

	destroy(): void {
		this.iframe?.remove();
		this.iframe = null;
		window.removeEventListener("message", this.onMessage);
		this.pending.forEach(({ reject }) =>
			reject(new Error("Service destroyed")),
		);
		this.pending.clear();
		this.ready = false;
		this.systemSpecsPromise = null;
	}

	private onMessage = (ev: MessageEvent<IncomingMessage>) => {
		const { messageId, type, payload } = ev.data || {};

		// CRITICAL: Only process messages from our own iframe to prevent cross-contamination
		const fromRunner = ev.source === this.iframe?.contentWindow;
		if (!fromRunner) {
			// Silently ignore messages from other iframes
			return;
		}

		if (type === "progress") {
			const progressData = payload as ProgressEvent;
			window.dispatchEvent(
				new CustomEvent("webllm:progress", { detail: progressData }),
			);

			for (const [, request] of this.pending.entries()) {
				if (request.onProgress) {
					request.onProgress(progressData);
				}
			}
			return;
		}

		if (type === "chunk") {
			const chunk = payload as ChatCompletionChunk;
			for (const [, request] of this.pending.entries()) {
				if (request.onStreamChunk) {
					request.onStreamChunk(chunk);
				}
			}
			return;
		}

		if (type === "end") {
			const chunk = payload as ChatCompletionChunk;
			for (const [, request] of this.pending.entries()) {
				if (request.onStreamChunk) {
					request.onStreamChunk(chunk);
					request.resolve(undefined);
				}
			}
			return;
		}

		if (!messageId) return;

		const pendingRequest = this.pending.get(messageId);
		if (!pendingRequest) return;

		this.pending.delete(messageId);

		if (type === "complete") {
			pendingRequest.resolve(payload);
		} else if (type === "error") {
			const errorData = payload as ErrorResponse;
			const error = new Error(errorData.error?.message || "Unknown error");
			pendingRequest.reject(error);
		}
	};

	private send(
		type: OutgoingMessage["type"],
		payload?: unknown,
		options?: {
			onProgress?: (progress: ProgressEvent) => void;
			onStreamChunk?: (chunk: ChatCompletionChunk) => void;
			signalId?: string;
		},
	): Promise<unknown> {
		return new Promise((resolve, reject) => {
			const target = this.iframe?.contentWindow;
			if (!target) return reject(new Error("Runner iframe not ready"));

			const id = Math.random().toString(36).slice(2);
			this.pending.set(id, {
				resolve,
				reject,
				onProgress: options?.onProgress,
				onStreamChunk: options?.onStreamChunk,
				signalId: options?.signalId,
			});

			// Set up abort signal listener if signalId provided
			if (options?.signalId) {
				const signal = this.signalMap.get(options.signalId);
				if (signal) {
					const abortHandler = () => {
						this.pending.delete(id);
						reject(new Error("Operation aborted"));
						// Send abort message to worker with the original messageId
						target.postMessage({ messageId: id, type: "abort" }, "*");
					};

					if (signal.aborted) {
						abortHandler();
						return;
					}

					signal.addEventListener("abort", abortHandler, { once: true });
				}
			}

			try {
				const message: OutgoingMessage = { messageId: id, type, payload };
				target.postMessage(message, "*");
			} catch (e) {
				this.pending.delete(id);
				reject(e);
			}
		});
	}
}
