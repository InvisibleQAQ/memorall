import type {
	BaseLLM,
	LLMInfo,
	ModelInfo,
	ModelsResponse,
	ProgressEvent,
} from "../interfaces/base-llm";
import type {
	ChatCompletionChunk,
	ChatCompletionRequest,
	ChatCompletionResponse,
	ChatMessage,
} from "@/types/openai";
import {
	AutoModelForCausalLM,
	AutoTokenizer,
	TextStreamer,
} from "@huggingface/transformers";
import { ensureWebGPUSupported } from "@/utils/webgpu";

interface HFProgressEvent {
	status?: string;
	file?: string;
	loaded?: number;
	total?: number;
}

interface TransformerInstance {
	model: any;
	tokenizer: any;
}

interface LFM2ModelDefinition {
	id: string;
	name: string;
	filename?: string;
	size?: number;
	aliases: string[];
	created: number;
}

const DEFAULT_MAX_MODEL_TOKENS = 8192;
const DEFAULT_MAX_RESPONSE_TOKENS = 512;

const WEBGPU_TRANSFORMER_MODELS: LFM2ModelDefinition[] = [
	// === MINISTRAL 3B (December 2025, Latest from Mistral AI) ===
	{
		id: "onnx-community/Ministral-3-3B-Instruct-2512",
		name: "Ministral 3B (WebGPU)",
		filename: "model.onnx",
		size: 1_500 * 1024 * 1024,
		aliases: ["Ministral-3B", "ministral-3b"],
		created: 1_733_000_000, // Dec 2025
	},

	// LFM2 models - Liquid AI's efficient foundation models
	{
		id: "onnx-community/LFM2-350M-ONNX",
		name: "LFM2 350M (WebGPU)",
		filename: "model.onnx",
		size: 200 * 1024 * 1024,
		aliases: ["LFM2-350M", "lfm2-350m"],
		created: 1_704_720_000,
	},
	{
		id: "onnx-community/LFM2-700M-ONNX",
		name: "LFM2 700M (WebGPU)",
		filename: "model.onnx",
		size: 410 * 1024 * 1024,
		aliases: ["LFM2-700M", "lfm2-700m"],
		created: 1_704_720_000,
	},
	{
		id: "onnx-community/LFM2-1.2B-ONNX",
		name: "LFM2 1.2B (WebGPU)",
		filename: "model.onnx",
		size: 709 * 1024 * 1024,
		aliases: ["LFM2-1.2B", "lfm2-1.2b"],
		created: 1_704_720_000,
	},
	{
		id: "onnx-community/LFM2-1.2B-Tool-ONNX",
		name: "LFM2 1.2B Tool (WebGPU)",
		filename: "model.onnx",
		size: 709 * 1024 * 1024,
		aliases: ["LFM2-1.2B-Tool", "lfm2-1.2b-tool"],
		created: 1_704_720_000,
	},

	// === GEMMA 3 MODELS (March 2025, Google) ===
	{
		id: "onnx-community/gemma-3-1b-it-ONNX",
		name: "Gemma 3 1B Instruct (WebGPU)",
		filename: "model.onnx",
		size: 500 * 1024 * 1024,
		aliases: ["gemma-3-1b", "gemma-3-1b-it"],
		created: 1_741_000_000, // Mar 2025
	},
	{
		id: "onnx-community/gemma-2b-it",
		name: "Gemma 2B Instruct (WebGPU)",
		filename: "model.onnx",
		size: 1_500 * 1024 * 1024,
		aliases: ["gemma-2b", "gemma-2b-it"],
		created: 1_708_000_000,
	},

	// === QWEN 3 MODELS (April 2025) ===
	{
		id: "onnx-community/Qwen3-0.6B-ONNX",
		name: "Qwen 3 0.6B (WebGPU)",
		filename: "model.onnx",
		size: 400 * 1024 * 1024,
		aliases: ["Qwen3-0.6B", "qwen3-0.6b"],
		created: 1_743_000_000, // Apr 2025
	},

	// Qwen2.5 models - Alibaba's multilingual chat models
	{
		id: "onnx-community/Qwen2.5-0.5B-Instruct",
		name: "Qwen2.5 0.5B Instruct (WebGPU)",
		filename: "model.onnx",
		size: 320 * 1024 * 1024,
		aliases: ["qwen2.5-0.5b", "Qwen2.5-0.5B-Instruct"],
		created: 1_725_000_000,
	},
	{
		id: "onnx-community/Qwen2.5-1.5B-Instruct",
		name: "Qwen2.5 1.5B Instruct (WebGPU)",
		filename: "model.onnx",
		size: 980 * 1024 * 1024,
		aliases: ["qwen2.5-1.5b", "Qwen2.5-1.5B-Instruct"],
		created: 1_725_000_000,
	},
	{
		id: "onnx-community/Qwen2.5-3B-Instruct",
		name: "Qwen2.5 3B Instruct (WebGPU)",
		filename: "model.onnx",
		size: 1_950 * 1024 * 1024,
		aliases: ["qwen2.5-3b", "Qwen2.5-3B-Instruct"],
		created: 1_725_000_000,
	},

	// === DEEPSEEK-R1-DISTILL MODELS (January 2025) ===
	{
		id: "onnx-community/DeepSeek-R1-Distill-Qwen-1.5B-ONNX",
		name: "DeepSeek-R1 Qwen 1.5B (WebGPU)",
		filename: "model.onnx",
		size: 1_500 * 1024 * 1024,
		aliases: ["DeepSeek-R1-1.5B", "deepseek-r1-1.5b"],
		created: 1_737_000_000, // Jan 2025
	},

	// === SMOLLM3 MODELS (July 2025, HuggingFace) ===
	{
		id: "HuggingFaceTB/SmolLM3-3B-ONNX",
		name: "SmolLM3 3B (WebGPU)",
		filename: "model.onnx",
		size: 1_800 * 1024 * 1024,
		aliases: ["SmolLM3-3B", "smollm3-3b"],
		created: 1_751_000_000, // Jul 2025
	},

	// SmolLM2 models - Hugging Face's small efficient models
	{
		id: "onnx-community/SmolLM2-135M-Instruct",
		name: "SmolLM2 135M Instruct (WebGPU)",
		filename: "model.onnx",
		size: 90 * 1024 * 1024,
		aliases: ["smollm2-135m", "SmolLM2-135M-Instruct"],
		created: 1_730_000_000,
	},
	{
		id: "onnx-community/SmolLM2-360M-Instruct",
		name: "SmolLM2 360M Instruct (WebGPU)",
		filename: "model.onnx",
		size: 230 * 1024 * 1024,
		aliases: ["smollm2-360m", "SmolLM2-360M-Instruct"],
		created: 1_730_000_000,
	},
	{
		id: "onnx-community/SmolLM2-1.7B-Instruct",
		name: "SmolLM2 1.7B Instruct (WebGPU)",
		filename: "model.onnx",
		size: 1_100 * 1024 * 1024,
		aliases: ["smollm2-1.7b", "SmolLM2-1.7B-Instruct"],
		created: 1_730_000_000,
	},

	// Phi-3 models - Microsoft's efficient instruction-tuned models
	{
		id: "onnx-community/Phi-3-mini-4k-instruct",
		name: "Phi-3 Mini 4K Instruct (WebGPU)",
		filename: "model.onnx",
		size: 2_300 * 1024 * 1024,
		aliases: ["phi-3-mini", "phi3-mini", "Phi-3-mini-4k-instruct"],
		created: 1_712_000_000,
	},
	{
		id: "onnx-community/Phi-3.5-mini-instruct",
		name: "Phi-3.5 Mini Instruct (WebGPU)",
		filename: "model.onnx",
		size: 2_400 * 1024 * 1024,
		aliases: ["phi-3.5-mini", "phi35-mini", "Phi-3.5-mini-instruct"],
		created: 1_723_000_000,
	},
];

function normalizeContent(content: ChatMessage["content"]): string {
	if (typeof content === "string") {
		return content;
	}

	return content
		.map((part) => {
			if (part.type === "text") return part.text;
			if (part.type === "image_url") {
				return `[Image: ${part.image_url?.url || ""}]`;
			}
			return "";
		})
		.join("\n");
}

/**
 * @deprecated This is the old direct implementation that runs transformers in the calling thread.
 * Use TransformerLLM (iframe-based) instead for better memory isolation.
 * This is kept for reference only.
 */
export class TransformerDirectLLM implements BaseLLM {
	name = "transformer-direct";
	private ready = false;
	private activeModelId: string | null = null;

	// Single model instance (only ONE model loaded at a time)
	private currentInstance: TransformerInstance | null = null;
	private loadingPromise: Promise<TransformerInstance> | null = null;
	private abortController: AbortController | null = null;
	private progressListeners = new Set<(progress: ProgressEvent) => void>();
	private lastProgress?: ProgressEvent;

	async initialize(): Promise<void> {
		if (this.ready) return;
		ensureWebGPUSupported();
		this.ready = true;
	}

	isReady(): boolean {
		return this.ready;
	}

	async getMaxModelTokens(): Promise<number> {
		return DEFAULT_MAX_MODEL_TOKENS;
	}

	async getMaxResponseTokens(): Promise<number> {
		return DEFAULT_MAX_RESPONSE_TOKENS;
	}

	async models(): Promise<ModelsResponse> {
		if (!this.ready) await this.initialize();

		// Check all models in catalog to see which are cached
		const models: ModelInfo[] = [];

		for (const definition of WEBGPU_TRANSFORMER_MODELS) {
			const isCached = await this.isModelCached(definition.id);
			if (isCached) {
				const isLoaded =
					this.activeModelId === definition.id && this.currentInstance !== null;
				models.push(this.buildModelInfo(definition.id, isLoaded, true));
			}
		}

		return {
			object: "list",
			data: models,
		};
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
		}
		return this.createCompletion(request);
	}

	async unload(modelId: string): Promise<void> {
		const resolvedId = this.normalizeModelId(modelId);
		if (this.activeModelId !== resolvedId) return;

		if (this.currentInstance) {
			this.currentInstance.model?.dispose?.();
			this.currentInstance.tokenizer?.dispose?.();
			this.currentInstance = null;
		}
		this.activeModelId = null;
		this.loadingPromise = null;
		this.lastProgress = undefined;
	}

	async delete(modelId: string): Promise<void> {
		// Local transformer models are streamed at runtime, so delete == unload
		await this.unload(modelId);
	}

	getInfo(): LLMInfo {
		return {
			name: this.name,
			type: "transformer-direct",
			ready: this.ready,
		};
	}

	async serve(
		model: string,
		onProgress?: (progress: ProgressEvent) => void,
	): Promise<ModelInfo> {
		if (!this.ready) await this.initialize();
		const resolvedId = this.normalizeModelId(model);
		await this.loadModel(resolvedId, onProgress);
		this.activeModelId = resolvedId;
		return this.buildModelInfo(resolvedId, true);
	}

	async loadModelFromHF(
		model: string,
		onProgress?: (progress: ProgressEvent) => void,
	): Promise<void> {
		await this.serve(model, onProgress);
	}

	private async createCompletion(
		request: ChatCompletionRequest,
	): Promise<ChatCompletionResponse> {
		const result = await this.generate(request);
		const modelName = result.modelId;
		const responseText = result.text;
		const promptTokens = result.promptTokens;
		const completionTokens = result.completionTokens;
		return {
			id: `chatcmpl-${Math.random().toString(36).slice(2)}`,
			object: "chat.completion",
			created: Math.floor(Date.now() / 1000),
			model: modelName,
			choices: [
				{
					index: 0,
					message: { role: "assistant", content: responseText },
					finish_reason: "stop",
				},
			],
			usage: {
				prompt_tokens: promptTokens,
				completion_tokens: completionTokens,
				total_tokens: promptTokens + completionTokens,
			},
		};
	}

	private async *createStreamingCompletion(
		request: ChatCompletionRequest,
	): AsyncIterableIterator<ChatCompletionChunk> {
		const queue: ChatCompletionChunk[] = [];
		let done = false;
		let error: Error | null = null;

		const { instance, input, modelId } = await this.prepareGeneration(request);
		const promptTokens = this.getPromptTokenLength(input);

		const streamer = new TextStreamer(instance.tokenizer, {
			skip_prompt: true,
			skip_special_tokens: true,
			callback_function: (token: string) => {
				queue.push(this.createChunk(modelId, token));
			},
		});

		const generationPromise = this.executeGeneration(
			instance,
			input,
			request,
			streamer,
		)
			.then((generationResult) => {
				const { completionTokens, text } = this.decodeGeneration(
					generationResult.sequences,
					input,
					instance.tokenizer,
				);
				return { completionTokens, text };
			})
			.catch((err) => {
				error = err instanceof Error ? err : new Error(String(err));
				throw error;
			})
			.finally(() => {
				done = true;
			});

		while (!done || queue.length > 0) {
			if (queue.length === 0) {
				await new Promise((resolve) => setTimeout(resolve, 10));
				continue;
			}
			yield queue.shift()!;
		}

		const generationOutcome = await generationPromise;
		if (error) {
			throw error;
		}

		// Emit final chunk with finish reason
		yield this.createChunk(modelId, "", "stop");

		// Update stats for the last response so usage numbers remain accurate if requested later
		this.lastPromptTokens = promptTokens;
		this.lastCompletionTokens = generationOutcome.completionTokens;
		this.lastModelId = modelId;
	}

	private async generate(request: ChatCompletionRequest) {
		const { instance, input, modelId } = await this.prepareGeneration(request);
		const generationResult = await this.executeGeneration(
			instance,
			input,
			request,
		);
		const { completionTokens, text } = this.decodeGeneration(
			generationResult.sequences,
			input,
			instance.tokenizer,
		);
		const promptTokens = this.getPromptTokenLength(input);
		this.lastPromptTokens = promptTokens;
		this.lastCompletionTokens = completionTokens;
		this.lastModelId = modelId;

		return {
			text,
			completionTokens,
			promptTokens,
			modelId,
		};
	}

	private async prepareGeneration(request: ChatCompletionRequest) {
		if (!this.ready) await this.initialize();
		const modelId = this.resolveActiveModel(request.model);
		if (!this.currentInstance) {
			throw new Error(
				`Model "${modelId}" is not loaded. Please load it first using the serve method.`,
			);
		}
		const instance = this.currentInstance;
		const normalizedMessages = request.messages.map((message) => ({
			role: message.role,
			content: normalizeContent(message.content),
		}));

		const input = instance.tokenizer.apply_chat_template(normalizedMessages, {
			add_generation_prompt: true,
			return_dict: true,
		});

		return { instance, input, modelId };
	}

	private async executeGeneration(
		instance: TransformerInstance,
		input: Record<string, unknown>,
		request: ChatCompletionRequest,
		streamer?: TextStreamer,
	) {
		const maxNewTokens = Math.min(
			request.max_tokens ?? DEFAULT_MAX_RESPONSE_TOKENS,
			DEFAULT_MAX_RESPONSE_TOKENS,
		);

		const generationOptions = {
			...input,
			max_new_tokens: maxNewTokens,
			do_sample: false,
			streamer,
			return_dict_in_generate: true,
			temperature: request.temperature ?? 0,
			top_p: request.top_p ?? 1,
			top_k: request.top_k ?? 50,
		};

		if (request.signal?.aborted) {
			throw new Error("Operation aborted");
		}

		return instance.model.generate(generationOptions);
	}

	private decodeGeneration(
		sequences: any,
		input: Record<string, unknown>,
		tokenizer: any,
	) {
		const promptTokens = this.getPromptTokenLength(input);
		let trimmedSeq = sequences;
		if (typeof sequences?.slice === "function") {
			trimmedSeq = sequences.slice(null, [promptTokens, null]);
		}

		let decoded = "";
		try {
			decoded =
				tokenizer.batch_decode(trimmedSeq, { skip_special_tokens: true })[0] ||
				"";
		} catch {
			decoded = "";
		}

		const completionTokens = Math.max(
			0,
			(sequences?.dims?.[1] ?? promptTokens) - promptTokens,
		);

		return { text: decoded, completionTokens };
	}

	private createChunk(
		modelId: string,
		token: string,
		finishReason: "stop" | "length" | null = null,
	): ChatCompletionChunk {
		return {
			id: `chatcmpl-${Math.random().toString(36).slice(2)}`,
			object: "chat.completion.chunk",
			created: Math.floor(Date.now() / 1000),
			model: modelId,
			choices: [
				{
					index: 0,
					delta: token ? { content: token } : {},
					finish_reason: finishReason,
				},
			],
		};
	}

	private getPromptTokenLength(input: Record<string, unknown>): number {
		const dims = (input as any)?.input_ids?.dims;
		if (Array.isArray(dims) && typeof dims[1] === "number") {
			return dims[1];
		}
		return 0;
	}

	private resolveActiveModel(requestedModel?: string): string {
		if (requestedModel) {
			const resolved = this.normalizeModelId(requestedModel);
			if (!this.currentInstance || this.activeModelId !== resolved) {
				throw new Error(
					`Model "${requestedModel}" is not loaded. Please load it first.`,
				);
			}
			return resolved;
		}

		if (!this.activeModelId) {
			throw new Error(
				"No transformer model is currently active. Please load a model first.",
			);
		}
		return this.activeModelId;
	}

	private normalizeModelId(modelId: string): string {
		if (modelId.includes("/")) {
			if (modelId.includes("onnx-community")) {
				return modelId;
			}
			const alias = modelId.split("/").pop() ?? modelId;
			return this.matchKnownModel(alias);
		}
		return this.matchKnownModel(modelId);
	}

	private matchKnownModel(identifier: string): string {
		const normalized = identifier
			.replace(/\.(gguf|onnx)$/i, "")
			.replace(/-GGUF$/i, "")
			.replace(/-ONNX$/i, "")
			.toLowerCase();

		const match = WEBGPU_TRANSFORMER_MODELS.find((definition) => {
			if (definition.id.toLowerCase() === identifier.toLowerCase()) {
				return true;
			}
			return definition.aliases.some(
				(alias) => alias.toLowerCase() === normalized,
			);
		});

		if (match) {
			return match.id;
		}

		// Fallback to the ONNX community repo naming convention
		return `onnx-community/${identifier}`;
	}

	private async isModelCached(modelId: string): Promise<boolean> {
		try {
			// Check if model files are in browser cache
			const caches = await window.caches.open("transformers-cache");
			const keys = await caches.keys();
			// Check if any cached files match the model ID
			const hasCachedFiles = keys.some((request) =>
				request.url.includes(modelId),
			);
			return hasCachedFiles;
		} catch {
			return false;
		}
	}

	private buildModelInfo(
		modelId: string,
		loadedOverride?: boolean,
		downloadedOverride?: boolean,
	): ModelInfo {
		const definition = WEBGPU_TRANSFORMER_MODELS.find(
			(model) => model.id === modelId,
		);

		// loaded: Only the active model is considered "loaded" (ready to use)
		const loaded =
			loadedOverride ??
			(this.activeModelId === modelId && this.currentInstance !== null);

		// downloaded: Use override or default to false (will be set async)
		const downloaded = downloadedOverride ?? false;

		return {
			id: modelId,
			name: definition?.name ?? modelId,
			filename: definition?.filename,
			object: "model",
			created: definition?.created ?? Math.floor(Date.now() / 1000),
			owned_by: "transformer",
			loaded,
			downloaded,
			size: definition?.size,
			provider: this.name,
		};
	}

	private async loadModel(
		modelId: string,
		onProgress?: (progress: ProgressEvent) => void,
	): Promise<TransformerInstance> {
		// IMPORTANT: Only ONE model can be loaded at a time
		// Unload any currently loaded model that is different from the requested one
		if (this.activeModelId && this.activeModelId !== modelId) {
			if (this.currentInstance) {
				this.currentInstance.model?.dispose?.();
				this.currentInstance.tokenizer?.dispose?.();
				this.currentInstance = null;
			}
			this.activeModelId = null;
			this.loadingPromise = null;
			this.lastProgress = undefined;
		}

		// If already loaded, return it
		if (this.currentInstance && this.activeModelId === modelId) {
			if (onProgress && this.lastProgress) {
				onProgress(this.lastProgress);
			}
			return this.currentInstance;
		}

		// Add progress listener
		if (onProgress) {
			this.progressListeners.add(onProgress);
		}

		// If already loading, wait for it
		if (this.loadingPromise) {
			const instance = await this.loadingPromise;
			if (onProgress) {
				this.progressListeners.delete(onProgress);
			}
			return instance;
		}

		// Start loading
		this.abortController = new AbortController();

		const reportProgress = (progress: ProgressEvent) => {
			this.lastProgress = progress;
			this.progressListeners.forEach((listener) => listener(progress));
		};

		const progressCallback = (progress: HFProgressEvent) => {
			if (
				progress.status === "progress" &&
				progress.file?.endsWith(".onnx_data")
			) {
				const loaded = progress.loaded ?? 0;
				const total = progress.total ?? 1;
				const percent = Math.min(100, Math.round((loaded / total) * 100));
				reportProgress({ loaded, total, percent });
			}
		};

		this.loadingPromise = (async () => {
			try {
				const tokenizer = await AutoTokenizer.from_pretrained(modelId, {
					progress_callback: progressCallback,
				});
				const model = await AutoModelForCausalLM.from_pretrained(modelId, {
					dtype: "q4f16",
					device: "webgpu",
					progress_callback: progressCallback,
				});
				const instance: TransformerInstance = { model, tokenizer };
				this.currentInstance = instance;
				reportProgress({ loaded: 1, total: 1, percent: 100 });
				return instance;
			} finally {
				this.loadingPromise = null;
				if (onProgress) {
					this.progressListeners.delete(onProgress);
				}
			}
		})();

		return this.loadingPromise;
	}

	private lastPromptTokens = 0;
	private lastCompletionTokens = 0;
	private lastModelId: string | null = null;
}
