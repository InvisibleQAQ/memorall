// Transformer Runner - Local LLM inference via HuggingFace Transformers.js with WebGPU
import { reply, generateId, sendReady } from "../utils/common.js";
import { ModelLifecycleManager } from "../utils/model-lifecycle.js";

// Scoped state
let AutoTokenizer;
let AutoModelForCausalLM;
let AutoProcessor;
let Gemma4ForConditionalGeneration;
let pipelineFactory;
let TextStreamer;
let transformers;
const loadedModelsCache = new Map();

// Progress callback for current load operation
let currentProgressCallback = null;

// Track current in-flight message context for unhandled rejection recovery
let currentMessageContext = null;

const DEFAULT_TRANSFORMER_DTYPE = "q4";
const DEFAULT_MAX_NEW_TOKENS = 512;
const UNKNOWN_MEMORY_AUTO_MAX_NEW_TOKENS = 1024;

const GEMMA_THINK_START = "<think>";
const GEMMA_THINK_END = "</think>";

const MODEL_RUNTIME_CONFIGS = new Map([
	[
		"onnx-community/granite-4.0-micro-ONNX-web",
		{
			runtime: "causal",
			dtype: "q4f16",
			defaultMaxNewTokens: 1024,
		},
	],
	[
		"onnx-community/gemma-4-E2B-it-ONNX",
		{
			runtime: "gemma4",
			dtype: "q4f16",
			defaultMaxNewTokens: 512,
		},
	],
	[
		"LiquidAI/LFM2.5-1.2B-Thinking-ONNX",
		{
			runtime: "pipeline",
			dtype: "q4",
			defaultMaxNewTokens: 4096,
		},
	],
	[
		"LiquidAI/LFM2-8B-A1B-ONNX",
		{
			runtime: "causal",
			dtype: "q4f16",
			defaultMaxNewTokens: 4096,
		},
	],
	[
		"LiquidAI/LFM2-24B-A2B-ONNX",
		{
			runtime: "causal",
			dtype: "q4f16",
			defaultMaxNewTokens: 4096,
		},
	],
]);

const UNSUPPORTED_BROWSER_MODELS = new Map([
	[
		"onnx-community/Phi-4-mini-instruct",
		"onnx-community/Phi-4-mini-instruct does not expose the public browser-ready ONNX tokenizer files needed by this runtime. Use onnx-community/Phi-4-mini-instruct-ONNX-GQA instead.",
	],
	[
		"onnx-community/gemma-3-1b-it-ONNX",
		"onnx-community/gemma-3-1b-it-ONNX is not currently reliable in the bundled transformers.js runtime in the browser. Use another transformer model or a Wllama GGUF Gemma model instead.",
	],
	[
		"onnx-community/gemma-3-270m-it",
		"onnx-community/gemma-3-270m-it is not currently compatible with the bundled transformers.js runtime in the browser. Use a Wllama GGUF Gemma model or another transformer model such as Qwen3 or LFM2 instead.",
	],
]);

const KNOWN_TRANSFORMER_LLM_ORGS = new Set([
	"onnx-community",
	"liquidai",
	"huggingfacetb",
	"ngxson",
	"mistralai",
	"webgpu",
]);

const KNOWN_TRANSFORMER_LLM_NAME_PATTERNS = [
	/granite/i,
	/gemma/i,
	/lfm/i,
	/minithinky/i,
	/smollm/i,
	/deepseek/i,
	/qwen/i,
	/phi/i,
	/ministral/i,
];

function isKnownTransformerLLMModelId(modelId) {
	if (!modelId || typeof modelId !== "string") {
		return false;
	}

	if (MODEL_RUNTIME_CONFIGS.has(modelId) || UNSUPPORTED_BROWSER_MODELS.has(modelId)) {
		return true;
	}

	const [org = "", repo = ""] = modelId.split("/");
	if (KNOWN_TRANSFORMER_LLM_ORGS.has(org.toLowerCase())) {
		return true;
	}

	return KNOWN_TRANSFORMER_LLM_NAME_PATTERNS.some(
		(pattern) => pattern.test(repo) || pattern.test(modelId),
	);
}

function cleanGemmaOutput(raw) {
	return raw
		.replace(/<\|?channel\|?>?\s*thought\s*/gi, GEMMA_THINK_START)
		.replace(/<\|?channell?\|?>/gi, GEMMA_THINK_END)
		.replace(/<\|?[a-z_]+\|?>/gi, "")
		.trim();
}

function getModelRuntimeConfig(modelId) {
	return (
		MODEL_RUNTIME_CONFIGS.get(modelId) ?? {
			runtime: "causal",
			dtype: DEFAULT_TRANSFORMER_DTYPE,
			defaultMaxNewTokens: DEFAULT_MAX_NEW_TOKENS,
		}
	);
}

function getPromptLength(input) {
	return input?.input_ids?.dims?.[1] || 0;
}

function resolveMaxContextTokens(tokenizer, modelConfig) {
	const tokenizerMaxRaw =
		typeof tokenizer?.model_max_length === "number"
			? tokenizer.model_max_length
			: undefined;
	const tokenizerMax =
		typeof tokenizerMaxRaw === "number" &&
		Number.isFinite(tokenizerMaxRaw) &&
		tokenizerMaxRaw > 0 &&
		tokenizerMaxRaw <= 1_000_000
			? tokenizerMaxRaw
			: undefined;

	const modelMaxRaw =
		typeof modelConfig?.max_position_embeddings === "number"
			? modelConfig.max_position_embeddings
			: typeof modelConfig?.n_positions === "number"
				? modelConfig.n_positions
				: typeof modelConfig?.context_length === "number"
					? modelConfig.context_length
					: typeof modelConfig?.max_seq_len === "number"
						? modelConfig.max_seq_len
						: typeof modelConfig?.n_ctx === "number"
							? modelConfig.n_ctx
							: typeof modelConfig?.seq_length === "number"
								? modelConfig.seq_length
								: undefined;
	const modelMax =
		typeof modelMaxRaw === "number" &&
		Number.isFinite(modelMaxRaw) &&
		modelMaxRaw > 0 &&
		modelMaxRaw <= 1_000_000
			? modelMaxRaw
			: undefined;

	return tokenizerMax ?? modelMax;
}

function resolveMemoryContextTokens(memoryHint) {
	if (!memoryHint || typeof memoryHint !== "object") {
		return undefined;
	}

	const { availableGB, sizeGB, kvBytesPerToken } = memoryHint;
	const hasValidNumbers =
		typeof availableGB === "number" &&
		Number.isFinite(availableGB) &&
		availableGB > 0 &&
		typeof sizeGB === "number" &&
		Number.isFinite(sizeGB) &&
		sizeGB >= 0 &&
		typeof kvBytesPerToken === "number" &&
		Number.isFinite(kvBytesPerToken) &&
		kvBytesPerToken > 0;

	if (!hasValidNumbers) {
		return undefined;
	}

	const availableForKV = availableGB / 1.2 - sizeGB;
	if (availableForKV <= 0) {
		return 0;
	}

	const maxTokens = Math.floor((availableForKV * 1024 ** 3) / kvBytesPerToken);
	return Math.max(0, Math.floor(maxTokens / 1024) * 1024);
}

function createProgressCallback(notifyProgress, getDtype) {
	return (progress) => {
		if (progress.status === "progress" && progress.file?.endsWith(".onnx_data")) {
			const loaded = progress.loaded || 0;
			const total = progress.total || 1;
			const percent = Math.min(100, Math.round((loaded / total) * 100));
			const currentDtype = getDtype?.();
			const dtypeInfo = currentDtype ? ` (${currentDtype})` : "";
			if (notifyProgress) {
				notifyProgress({
					loaded,
					total,
					percent,
					text: `Downloading model${dtypeInfo}... ${percent}%`,
				});
			}
		}
	};
}

async function loadWithExecutionFallback({
	modelId,
	dtype,
	preferredDevice,
	kind,
	loadAttempt,
}) {
	const devicesToTry =
		preferredDevice === "webgpu" ? ["webgpu", "wasm"] : ["wasm"];
	const threadsToTry = [4, 1];
	let lastError = null;

	for (const tryDevice of devicesToTry) {
		for (const numThreads of threadsToTry) {
			try {
				if (transformers.env?.backends?.onnx?.wasm) {
					transformers.env.backends.onnx.wasm.numThreads = numThreads;
				}

				console.log(
					`[transformer-runner] loading ${kind} model with dtype: ${dtype}, device: ${tryDevice}, threads: ${numThreads}`,
				);

				const loaded = await loadAttempt({
					device: tryDevice,
					numThreads,
				});

				console.log(
					`[transformer-runner] ${kind} model loaded successfully with dtype: ${dtype}, device: ${tryDevice}, threads: ${numThreads}`,
				);

				return { ...loaded, device: tryDevice, numThreads };
			} catch (err) {
				lastError = err;
				const errorMsg = err instanceof Error ? err.message : String(err);
				console.warn(
					`[transformer-runner] failed to load ${kind} model ${modelId} with device ${tryDevice}, threads ${numThreads}: ${errorMsg}`,
				);

				if (numThreads === 4 && threadsToTry.length > 1) {
					console.log("[transformer-runner] falling back to single-thread...");
					continue;
				}

				if (tryDevice === "webgpu" && devicesToTry.length > 1) {
					console.log("[transformer-runner] falling back to WASM...");
					break;
				}

				throw err;
			}
		}
	}

	throw lastError ?? new Error(`Failed to load model ${modelId}`);
}

async function loadCausalModelBundle(modelId, notifyProgress, config, preferredDevice) {
	const progressCallback = createProgressCallback(
		notifyProgress,
		() => config.dtype,
	);

	console.log("[transformer-runner] loading tokenizer for", modelId);
	let tokenizer;
	try {
		tokenizer = await AutoTokenizer.from_pretrained(modelId, {
			progress_callback: progressCallback,
		});
	} catch (error) {
		const errorMessage =
			error instanceof Error ? error.message : String(error);
		if (errorMessage.includes("tokenizer_class")) {
			throw new Error(
				`Failed to load tokenizer metadata for ${modelId}. This model is not currently compatible with the bundled transformers.js runtime in the browser.`,
			);
		}
		throw error;
	}
	console.log("[transformer-runner] tokenizer loaded successfully");

	try {
		const { model, device } = await loadWithExecutionFallback({
			modelId,
			dtype: config.dtype,
			preferredDevice,
			kind: "causal",
			loadAttempt: async ({ device }) => ({
				model: await AutoModelForCausalLM.from_pretrained(modelId, {
					dtype: config.dtype,
					device,
					progress_callback: progressCallback,
				}),
			}),
		});

		return {
			runtime: "causal",
			model,
			tokenizer,
			dtype: config.dtype,
			device,
			defaultMaxNewTokens: config.defaultMaxNewTokens,
		};
	} catch (error) {
		try {
			tokenizer.dispose?.();
		} catch {}
		throw error;
	}
}

async function loadPipelineModelBundle(modelId, notifyProgress, config, preferredDevice) {
	const progressCallback = createProgressCallback(
		notifyProgress,
		() => config.dtype,
	);

	const { generator, device } = await loadWithExecutionFallback({
		modelId,
		dtype: config.dtype,
		preferredDevice,
		kind: "pipeline",
		loadAttempt: async ({ device }) => ({
			generator: await pipelineFactory("text-generation", modelId, {
				dtype: config.dtype,
				device,
				progress_callback: progressCallback,
			}),
		}),
	});

	return {
		runtime: "pipeline",
		generator,
		model: generator.model,
		tokenizer: generator.tokenizer,
		dtype: config.dtype,
		device,
		defaultMaxNewTokens: config.defaultMaxNewTokens,
	};
}

async function loadGemma4ModelBundle(modelId, notifyProgress, config, preferredDevice) {
	if (!AutoProcessor || !Gemma4ForConditionalGeneration) {
		throw new Error(
			"Gemma 4 browser support is unavailable in the bundled transformers.js runtime.",
		);
	}

	const progressCallback = createProgressCallback(
		notifyProgress,
		() => config.dtype,
	);

	const processor = await AutoProcessor.from_pretrained(modelId, {
		progress_callback: progressCallback,
	});

	try {
		const { model, device } = await loadWithExecutionFallback({
			modelId,
			dtype: config.dtype,
			preferredDevice,
			kind: "gemma4",
			loadAttempt: async ({ device }) => ({
				model: await Gemma4ForConditionalGeneration.from_pretrained(modelId, {
					dtype: config.dtype,
					device,
					progress_callback: progressCallback,
				}),
			}),
		});

		return {
			runtime: "gemma4",
			model,
			processor,
			tokenizer: processor.tokenizer,
			dtype: config.dtype,
			device,
			defaultMaxNewTokens: config.defaultMaxNewTokens,
		};
	} catch (error) {
		try {
			processor.dispose?.();
		} catch {}
		throw error;
	}
}

function createStreamChunk(modelId, token) {
	return {
		id: `chatcmpl-${generateId()}`,
		object: "chat.completion.chunk",
		created: Math.floor(Date.now() / 1000),
		model: modelId,
		choices: [
			{
				index: 0,
				delta: token ? { content: token } : {},
				finish_reason: null,
			},
		],
	};
}

function createStreamEndChunk(modelId) {
	return {
		id: `chatcmpl-${generateId()}`,
		object: "chat.completion.chunk",
		created: Math.floor(Date.now() / 1000),
		model: modelId,
		choices: [
			{
				index: 0,
				delta: {},
				finish_reason: "stop",
			},
		],
	};
}

function trimSequences(sequences, promptLength) {
	if (typeof sequences?.slice === "function") {
		return sequences.slice(null, [promptLength, null]);
	}
	return sequences;
}

function decodeTrimmedSequences(tokenizer, sequences) {
	return tokenizer.batch_decode(sequences, {
		skip_special_tokens: true,
	})[0] || "";
}

function emitGemmaDelta(modelId, src, origin, messageId, rawText, state) {
	state.rawText += rawText;
	const cleaned = cleanGemmaOutput(state.rawText);
	if (!cleaned.startsWith(state.cleanedText)) {
		if (cleaned) {
			reply(
				src,
				origin,
				messageId,
				"stream_chunk",
				createStreamChunk(modelId, cleaned),
			);
		}
		state.cleanedText = cleaned;
		return;
	}

	const delta = cleaned.slice(state.cleanedText.length);
	if (delta) {
		reply(
			src,
			origin,
			messageId,
			"stream_chunk",
			createStreamChunk(modelId, delta),
		);
	}
	state.cleanedText = cleaned;
}

function toRunnerErrorPayload(error, overrides = {}) {
	const message =
		error instanceof Error ? error.message : String(error || "Unknown error");
	const type =
		typeof overrides.type === "string"
			? overrides.type
			: error instanceof Error && error.name
				? error.name
				: "Error";

	return {
		error: {
			message,
			type,
			code: overrides.code ?? null,
			modelId: overrides.modelId ?? null,
			serviceName: "transformer",
		},
	};
}

async function ensureTransformers() {
	if (transformers) return;
	// Dynamically import transformers from local bundle
	transformers = await import("../libs/transformers.js");
	AutoTokenizer = transformers.AutoTokenizer;
	AutoModelForCausalLM = transformers.AutoModelForCausalLM;
	AutoProcessor = transformers.AutoProcessor;
	Gemma4ForConditionalGeneration = transformers.Gemma4ForConditionalGeneration;
	pipelineFactory = transformers.pipeline;
	TextStreamer = transformers.TextStreamer;

	if (!AutoTokenizer || !AutoModelForCausalLM || !pipelineFactory || !TextStreamer) {
		throw new Error("Failed to load @huggingface/transformers");
	}

	// Request high-performance GPU adapter if available
	if (typeof navigator !== "undefined" && navigator.gpu) {
		try {
			const adapter = await navigator.gpu.requestAdapter({
				powerPreference: "high-performance",
			});
			if (adapter) {
				console.log("[transformer-runner] WebGPU adapter obtained:", {
					features: Array.from(adapter.features || []),
					limits: adapter.limits,
				});
			}
		} catch (err) {
			console.warn("[transformer-runner] could not get WebGPU adapter:", err);
		}
	}

	// Configure cache and ONNX Runtime
	if (transformers.env) {
		// Enable browser cache for models
		transformers.env.useBrowserCache = true;
		transformers.env.allowLocalModels = false;

		// Configure ONNX Runtime to use local bundled WASM files
		if (transformers.env.backends?.onnx?.wasm) {
			const wasmPath =
				typeof chrome !== "undefined" && chrome.runtime?.getURL
					? chrome.runtime.getURL("vendors/transformers/")
					: "../../../vendors/transformers/";
			transformers.env.backends.onnx.wasm.wasmPaths = wasmPath;
			transformers.env.backends.onnx.wasm.wasmBinary = null; // Let it load automatically

			console.log("ONNX Runtime WASM path configured:", wasmPath);
		}

		console.log("[transformer-runner] cache and env configured", {
			useBrowserCache: transformers.env.useBrowserCache,
			allowLocalModels: transformers.env.allowLocalModels,
		});
	}
}

/**
 * @typedef {Object} TransformerModelBundle
 * @property {any} model - The loaded model
 * @property {any} tokenizer - The loaded tokenizer
 * @property {string} dtype - The quantization type used
 */

/**
 * Load a transformer model and tokenizer
 * @param {string} modelId
 * @param {Function} [notifyProgress]
 * @returns {Promise<TransformerModelBundle>}
 */
async function loadTransformerModel(modelId, notifyProgress) {
	await ensureTransformers();

	const unsupportedMessage = UNSUPPORTED_BROWSER_MODELS.get(modelId);
	if (unsupportedMessage) {
		throw new Error(unsupportedMessage);
	}

	const hasWebGPU =
		typeof navigator !== "undefined" && typeof navigator.gpu !== "undefined";
	const preferredDevice = hasWebGPU ? "webgpu" : "wasm";
	const config = getModelRuntimeConfig(modelId);

	console.log("[transformer-runner] device selection", {
		hasWebGPU,
		initialDevice: preferredDevice,
		model: modelId,
		runtime: config.runtime,
		dtype: config.dtype,
	});

	if (config.runtime === "pipeline") {
		return loadPipelineModelBundle(
			modelId,
			notifyProgress,
			config,
			preferredDevice,
		);
	}

	if (config.runtime === "gemma4") {
		return loadGemma4ModelBundle(
			modelId,
			notifyProgress,
			config,
			preferredDevice,
		);
	}

	return loadCausalModelBundle(modelId, notifyProgress, config, preferredDevice);
}

/**
 * Unload transformer model and tokenizer
 * @param {TransformerModelBundle} bundle
 */
async function unloadTransformerModel(bundle) {
	if (bundle.generator) {
		try {
			bundle.generator.dispose?.();
		} catch (e) {
			console.warn("[transformer-runner] error disposing pipeline:", e);
		}
	}
	if (bundle.model) {
		try {
			bundle.model.dispose?.();
		} catch (e) {
			console.warn("[transformer-runner] error disposing model:", e);
		}
	}
	if (bundle.tokenizer) {
		try {
			bundle.tokenizer.dispose?.();
		} catch (e) {
			console.warn("[transformer-runner] error disposing tokenizer:", e);
		}
	}
	if (bundle.processor) {
		try {
			bundle.processor.dispose?.();
		} catch (e) {
			console.warn("[transformer-runner] error disposing processor:", e);
		}
	}
}

// Model lifecycle manager - handles caching and auto-unload after 5 min idle
const transformerManager = new ModelLifecycleManager({
	name: "transformer-runner",
	loadFn: loadTransformerModel,
	unloadFn: unloadTransformerModel,
});

window.addEventListener("message", async (event) => {
	const src = event.source;
	const origin = event.origin;
	const { messageId, type, payload } = event.data || {};

	currentMessageContext = { src, origin, messageId };

	try {
		switch (type) {
			case "init": {
				await ensureTransformers();
				reply(src, origin, messageId, "complete", {
					status: "initialized",
					mode: "transformer",
				});
				break;
			}

			case "models": {
				// Check browser cache for transformer models
				try {
					const caches = await window.caches.open("transformers-cache");
					const keys = await caches.keys();

					// Group cached files by model ID
					const modelIds = new Set();
					keys.forEach((request) => {
						const url = request.url;
						// Extract model ID from HuggingFace URL pattern
						const match = url.match(/huggingface\.co\/([^\/]+\/[^\/]+)/);
						if (match && isKnownTransformerLLMModelId(match[1])) {
							modelIds.add(match[1]);
						}
					});

					const currentModelId = transformerManager.modelId;
					if (currentModelId) {
						modelIds.add(currentModelId);
					}
					for (const cachedModelId of loadedModelsCache.keys()) {
						modelIds.add(cachedModelId);
					}
					const downloadedModels = Array.from(modelIds).map((modelId) => {
						const isLoaded = currentModelId === modelId && transformerManager.isLoaded;
						return {
							id: modelId,
							name: modelId,
							object: "model",
							created: Date.now(),
							owned_by: "transformer",
							loaded: isLoaded,
							downloaded: true,
						};
					});

					reply(src, origin, messageId, "complete", {
						object: "list",
						data: downloadedModels,
					});
				} catch (error) {
					console.error("Failed to get cached models:", error);
					reply(src, origin, messageId, "complete", {
						object: "list",
						data: [],
					});
				}
				break;
			}

			case "serve": {
				const { model } = payload || {};
				if (!model) throw new Error("Model ID is required");

				const notifyProgress = (info) => {
					reply(src, origin, messageId, "progress", info);
				};

				try {
					const bundle = await transformerManager.load(model, notifyProgress);

					// Include quantization info in model metadata
					const quantizationInfo = {
						q4: "4-bit (smallest, fastest)",
						q4f16: "4-bit weights + fp16 activations",
						fp16: "16-bit floating point",
						q8: "8-bit quantization",
					}[bundle.dtype] || bundle.dtype;

					console.log(`[transformer-runner] model serving with ${quantizationInfo}`);

					const modelInfo = {
						id: model,
						object: "model",
						created: Math.floor(Date.now() / 1000),
						owned_by: "transformer",
						loaded: true,
						downloaded: true,
						dtype: bundle.dtype,
					};

					loadedModelsCache.set(model, modelInfo);
					reply(src, origin, messageId, "complete", modelInfo);
				} catch (error) {
					console.error("[transformer-runner] model loading failed:", error);

					const errorStr = error instanceof Error ? error.message : String(error);
					const isMemoryError =
						errorStr.includes("Aborted") ||
						errorStr.includes("abort") ||
						errorStr.includes("memory") ||
						/^\d+$/.test(errorStr);

					let errorMessage = `Failed to load model: ${errorStr || "Unknown error"}`;
					if (isMemoryError) {
						const requestedModel = typeof model === "string" ? model : "This model";
						errorMessage +=
							"\n\nThis is likely due to insufficient memory or WebGPU issues. " +
							`${requestedModel} may require more available RAM or a different execution backend than your browser can provide. ` +
							"Try:\n1. Closing other browser tabs\n2. Restarting your browser\n3. Using a smaller model";
					}

					reply(
						src,
						origin,
						messageId,
						"error",
						toRunnerErrorPayload(errorMessage, {
							type: "ModelLoadError",
							code: "TRANSFORMER_MODEL_LOAD_FAILED",
							modelId: typeof model === "string" ? model : null,
						}),
					);
				}
				break;
			}

			case "chat/completions": {
				const {
					messages,
					model,
					stream = false,
					max_tokens,
					temperature = 0,
					top_p = 1,
					top_k = 50,
					_memoryHint,
				} = payload || {};

				if (!messages) throw new Error("Messages are required");

				const targetModel = model || transformerManager.modelId;
				if (!targetModel) {
					throw new Error("No model specified and no model loaded. Call serve first.");
				}

				try {
					await transformerManager.withModel(targetModel, async (bundle) => {
						const {
							model: currentModel,
							tokenizer: currentTokenizer,
							runtime,
							generator,
							processor,
							defaultMaxNewTokens = DEFAULT_MAX_NEW_TOKENS,
						} = bundle;

						let input = null;
						if (runtime === "causal") {
							input = currentTokenizer.apply_chat_template(messages, {
								add_generation_prompt: true,
								return_dict: true,
							});
						} else if (runtime === "gemma4") {
							const prompt = processor.apply_chat_template(messages, {
								add_generation_prompt: true,
							});
							input = await processor(prompt, null, null, {
								add_special_tokens: false,
							});
						} else if (
							typeof currentTokenizer?.apply_chat_template === "function"
						) {
							input = currentTokenizer.apply_chat_template(messages, {
								add_generation_prompt: true,
								return_dict: true,
							});
						}

						const promptLength = getPromptLength(input);
						const detectedMaxContextTokens = resolveMaxContextTokens(
							currentTokenizer,
							currentModel?.config,
						);
						const maxContextTokens =
							typeof detectedMaxContextTokens === "number"
								? detectedMaxContextTokens
								: typeof _memoryHint?.contextLength === "number"
									? _memoryHint.contextLength
									: undefined;
						const memoryContextTokens = resolveMemoryContextTokens(_memoryHint);
						const maxTotalContextTokens =
							typeof maxContextTokens === "number" &&
							typeof memoryContextTokens === "number"
								? Math.min(maxContextTokens, memoryContextTokens)
								: typeof maxContextTokens === "number"
									? maxContextTokens
									: memoryContextTokens;
						const maxNewTokensLimit =
							typeof maxTotalContextTokens === "number"
								? Math.max(0, maxTotalContextTokens - promptLength)
								: undefined;

						const defaultAutoMaxTokens = _memoryHint
							? defaultMaxNewTokens
							: Math.min(defaultMaxNewTokens, UNKNOWN_MEMORY_AUTO_MAX_NEW_TOKENS);
						const requestedMaxTokens =
							typeof max_tokens === "number" && Number.isFinite(max_tokens)
								? max_tokens
								: typeof maxNewTokensLimit === "number"
									? Math.min(defaultAutoMaxTokens, maxNewTokensLimit)
									: defaultAutoMaxTokens;

						if (typeof max_tokens !== "number" && typeof maxNewTokensLimit === "number") {
							console.log("[transformer-runner] auto max_new_tokens", {
								auto: true,
								max_new_tokens: requestedMaxTokens,
								promptLength,
								maxContextTokens,
								memoryContextTokens,
								availableGB: _memoryHint?.availableGB,
								hasMemoryHint: Boolean(_memoryHint),
							});
						}

						const effectiveMaxNewTokens =
							typeof maxNewTokensLimit === "number" && typeof requestedMaxTokens === "number"
								? Math.min(requestedMaxTokens, maxNewTokensLimit)
								: requestedMaxTokens;

						if (
							typeof requestedMaxTokens === "number" &&
							typeof effectiveMaxNewTokens === "number" &&
							effectiveMaxNewTokens < requestedMaxTokens
						) {
							console.log("[transformer-runner] clamped max_new_tokens", {
								requested: requestedMaxTokens,
								effective: effectiveMaxNewTokens,
								promptLength,
								maxContextTokens,
								memoryContextTokens,
								availableGB: _memoryHint?.availableGB,
								hasMemoryHint: Boolean(_memoryHint),
							});
						}

						if (typeof maxNewTokensLimit === "number" && maxNewTokensLimit <= 0) {
							if (
								typeof memoryContextTokens === "number" &&
								(typeof maxContextTokens !== "number" ||
									memoryContextTokens <= maxContextTokens)
							) {
								throw new Error(
									`Prompt is too long for available device memory (promptLength=${promptLength}, memoryContextTokens=${memoryContextTokens}, availableGB=${_memoryHint?.availableGB ?? "unknown"})`,
								);
							}

							throw new Error(
								`Prompt is too long for the model context window (promptLength=${promptLength}, maxContextTokens=${maxContextTokens})`,
							);
						}

						if (stream) {
							if (runtime === "pipeline") {
								const streamer = new TextStreamer(currentTokenizer, {
									skip_prompt: true,
									skip_special_tokens: true,
									callback_function: (token) => {
										reply(
											src,
											origin,
											messageId,
											"stream_chunk",
											createStreamChunk(targetModel, token),
										);
									},
								});

								await generator(messages, {
									...(typeof effectiveMaxNewTokens === "number"
										? { max_new_tokens: effectiveMaxNewTokens }
										: {}),
									do_sample: temperature > 0,
									streamer,
									temperature,
									top_p,
									top_k,
								});
							} else if (runtime === "gemma4") {
								const gemmaState = {
									rawText: "",
									cleanedText: "",
								};
								const streamer = new TextStreamer(currentTokenizer, {
									skip_prompt: true,
									skip_special_tokens: false,
									callback_function: (token) => {
										emitGemmaDelta(
											targetModel,
											src,
											origin,
											messageId,
											token,
											gemmaState,
										);
									},
								});

								await currentModel.generate({
									...input,
									...(typeof effectiveMaxNewTokens === "number"
										? { max_new_tokens: effectiveMaxNewTokens }
										: {}),
									do_sample: temperature > 0,
									streamer,
									temperature,
									top_p,
									top_k,
								});
							} else {
								const streamer = new TextStreamer(currentTokenizer, {
									skip_prompt: true,
									skip_special_tokens: true,
									callback_function: (token) => {
										reply(
											src,
											origin,
											messageId,
											"stream_chunk",
											createStreamChunk(targetModel, token),
										);
									},
								});

								await currentModel.generate({
									...input,
									...(typeof effectiveMaxNewTokens === "number"
										? { max_new_tokens: effectiveMaxNewTokens }
										: {}),
									do_sample: temperature > 0,
									streamer,
									return_dict_in_generate: true,
									temperature,
									top_p,
									top_k,
								});
							}

							reply(
								src,
								origin,
								messageId,
								"stream_end",
								createStreamEndChunk(targetModel),
							);
						} else {
							let decoded = "";
							let usage = {
								prompt_tokens: promptLength,
								completion_tokens: 0,
								total_tokens: promptLength,
							};

							if (runtime === "pipeline") {
								let outputText = "";
								const streamer = new TextStreamer(currentTokenizer, {
									skip_prompt: true,
									skip_special_tokens: true,
									callback_function: (token) => {
										outputText += token;
									},
								});

								await generator(messages, {
									...(typeof effectiveMaxNewTokens === "number"
										? { max_new_tokens: effectiveMaxNewTokens }
										: {}),
									do_sample: temperature > 0,
									streamer,
									temperature,
									top_p,
									top_k,
								});

								decoded = outputText;
							} else if (runtime === "gemma4") {
								const gemmaState = {
									rawText: "",
									cleanedText: "",
								};
								const streamer = new TextStreamer(currentTokenizer, {
									skip_prompt: true,
									skip_special_tokens: false,
									callback_function: (token) => {
										gemmaState.rawText += token;
										gemmaState.cleanedText = cleanGemmaOutput(
											gemmaState.rawText,
										);
									},
								});

								await currentModel.generate({
									...input,
									...(typeof effectiveMaxNewTokens === "number"
										? { max_new_tokens: effectiveMaxNewTokens }
										: {}),
									do_sample: temperature > 0,
									streamer,
									temperature,
									top_p,
									top_k,
								});

								decoded = gemmaState.cleanedText;
							} else {
								const generationResult = await currentModel.generate({
									...input,
									...(typeof effectiveMaxNewTokens === "number"
										? { max_new_tokens: effectiveMaxNewTokens }
										: {}),
									do_sample: temperature > 0,
									return_dict_in_generate: true,
									temperature,
									top_p,
									top_k,
								});

								const trimmedSeq = trimSequences(
									generationResult.sequences,
									promptLength,
								);
								decoded = decodeTrimmedSequences(currentTokenizer, trimmedSeq);

								const totalTokens =
									generationResult.sequences?.dims?.[1] || promptLength;
								usage = {
									prompt_tokens: promptLength,
									completion_tokens: totalTokens - promptLength,
									total_tokens: totalTokens,
								};
							}

							const response = {
								id: `chatcmpl-${generateId()}`,
								object: "chat.completion",
								created: Math.floor(Date.now() / 1000),
								model: targetModel,
								choices: [
									{
										index: 0,
										message: {
											role: "assistant",
											content: decoded,
										},
										finish_reason: "stop",
									},
								],
								usage,
							};

							reply(src, origin, messageId, "complete", response);
						}
					});
				} catch (error) {
					reply(src, origin, messageId, "error", {
						error: {
							message: `Chat completion failed: ${error.message}`,
							type: "CompletionError",
							code: null,
						},
					});
				}
				break;
			}

			case "unload": {
				const { model } = payload || {};
				const currentModel = transformerManager.modelId;

				if (model && model !== currentModel) {
					throw new Error(`Model ${model} is not loaded`);
				}

				await transformerManager.unload();

				if (currentModel) {
					const modelInfo = loadedModelsCache.get(currentModel);
					if (modelInfo) {
						modelInfo.loaded = false;
						loadedModelsCache.set(currentModel, modelInfo);
					}
				}

				reply(src, origin, messageId, "complete", { status: "unloaded", model: model || currentModel });
				break;
			}

			case "delete": {
				const { model } = payload || {};
				if (!model) throw new Error("Model name is required");

				try {
					// Unload first if it's the active model
					if (transformerManager.modelId === model) {
						await transformerManager.unload();
					}

					// Clear from cache
					const caches = await window.caches.open("transformers-cache");
					const keys = await caches.keys();
					for (const request of keys) {
						if (request.url.includes(model)) {
							await caches.delete(request);
						}
					}

					loadedModelsCache.delete(model);
					reply(src, origin, messageId, "complete", { status: "deleted", model });
				} catch (error) {
					reply(src, origin, messageId, "error", {
						error: {
							message: `Delete failed: ${error.message}`,
							type: "DeleteError",
							code: null,
						},
					});
				}
				break;
			}

			default:
				reply(src, origin, messageId, "error", {
					error: {
						message: `Unknown message type: ${type}`,
						type: "UnknownMessageType",
						code: null,
					},
				});
		}
	} catch (error) {
		console.error("Transformer runner error:", error);
		reply(src, origin, messageId, "error", toRunnerErrorPayload(error));
	} finally {
		currentMessageContext = null;
	}
});

// Global safety net: catch unhandled promise rejections (e.g. OOM inside transformers.js)
window.addEventListener("unhandledrejection", (event) => {
	event.preventDefault();
	const error = event.reason;
	console.error("[transformer-runner] Unhandled promise rejection caught:", error);

	if (currentMessageContext) {
		const { src, origin, messageId } = currentMessageContext;
		currentMessageContext = null;

		const errorMsg = error instanceof Error ? error.message : String(error || "Unknown error");
		const isOOM =
			error instanceof RangeError ||
			errorMsg.includes("Array buffer allocation failed") ||
			errorMsg.includes("memory") ||
			errorMsg.includes("Aborted") ||
			/^\d+$/.test(errorMsg);

		let message = `Operation failed: ${errorMsg}`;
		if (isOOM) {
			message =
				"Model loading failed: out of memory (Array buffer allocation failed). " +
				"Try closing other browser tabs, restarting your browser, or using a smaller model.";
		}

		reply(src, origin, messageId, "error", {
			error: {
				message,
				type: isOOM ? "OutOfMemoryError" : (error?.name || "Error"),
				code: isOOM ? "TRANSFORMER_OOM" : "TRANSFORMER_UNHANDLED_ERROR",
				modelId: null,
				serviceName: "transformer",
			},
		});
	}
});

// Global safety net: catch synchronous errors in the iframe
window.addEventListener("error", (event) => {
	console.error("[transformer-runner] Uncaught error in iframe:", event.error || event.message);

	if (currentMessageContext) {
		const { src, origin, messageId } = currentMessageContext;
		currentMessageContext = null;

		reply(src, origin, messageId, "error", toRunnerErrorPayload(event.error || new Error(event.message || "Unknown error")));
	}
});

const endpoints = [
	"init",
	"serve",
	"models",
	"chat/completions",
	"unload",
	"delete",
];
sendReady("transformer", endpoints);
