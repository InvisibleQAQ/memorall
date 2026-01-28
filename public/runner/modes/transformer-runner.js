// Transformer Runner - Local LLM inference via HuggingFace Transformers.js with WebGPU
import { reply, generateId, sendReady } from "../utils/common.js";
import { ModelLifecycleManager } from "../utils/model-lifecycle.js";

// Scoped state
let AutoTokenizer;
let AutoModelForCausalLM;
let transformers;
const loadedModelsCache = new Map();

// Progress callback for current load operation
let currentProgressCallback = null;

async function ensureTransformers() {
	if (transformers) return;
	// Dynamically import transformers from local bundle
	transformers = await import("../libs/transformers.js");
	AutoTokenizer = transformers.AutoTokenizer;
	AutoModelForCausalLM = transformers.AutoModelForCausalLM;

	if (!AutoTokenizer || !AutoModelForCausalLM) {
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

	const hasWebGPU =
		typeof navigator !== "undefined" && typeof navigator.gpu !== "undefined";
	let device = hasWebGPU ? "webgpu" : "wasm";

	console.log("[transformer-runner] device selection", {
		hasWebGPU,
		initialDevice: device,
		model: modelId,
	});

	let currentDtype = "q4";

	const progressCallback = (progress) => {
		if (progress.status === "progress" && progress.file?.endsWith(".onnx_data")) {
			const loaded = progress.loaded || 0;
			const total = progress.total || 1;
			const percent = Math.min(100, Math.round((loaded / total) * 100));
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

	// Load tokenizer
	console.log("[transformer-runner] loading tokenizer for", modelId);
	const tokenizer = await AutoTokenizer.from_pretrained(modelId, {
		progress_callback: progressCallback,
	});
	console.log("[transformer-runner] tokenizer loaded successfully");

	// Try multiple configurations: device (WebGPU → WASM) and threads (4 → 1)
	let model = null;
	let loadError = null;
	const devicesToTry = device === "webgpu" ? ["webgpu", "wasm"] : ["wasm"];
	const threadsToTry = [4, 1];

	for (const tryDevice of devicesToTry) {
		for (const numThreads of threadsToTry) {
			try {
				if (transformers.env?.backends?.onnx?.wasm) {
					transformers.env.backends.onnx.wasm.numThreads = numThreads;
				}

				console.log(
					`[transformer-runner] loading model with dtype: ${currentDtype}, device: ${tryDevice}, threads: ${numThreads}`,
				);

				model = await AutoModelForCausalLM.from_pretrained(modelId, {
					dtype: currentDtype,
					device: tryDevice,
					progress_callback: progressCallback,
				});

				device = tryDevice;
				console.log(
					`[transformer-runner] model loaded successfully with dtype: ${currentDtype}, device: ${device}, threads: ${numThreads}`,
				);
				break;
			} catch (err) {
				loadError = err;
				const errorMsg = err instanceof Error ? err.message : String(err);
				console.warn(
					`[transformer-runner] failed to load with device ${tryDevice}, threads ${numThreads}: ${errorMsg}`,
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

		if (model) break;
	}

	if (!model) {
		// Dispose tokenizer on failure
		try {
			tokenizer.dispose?.();
		} catch {}
		const errorMsg = loadError instanceof Error ? loadError.message : String(loadError);
		throw new Error(`Failed to load model: ${errorMsg}`);
	}

	return { model, tokenizer, dtype: currentDtype };
}

/**
 * Unload transformer model and tokenizer
 * @param {TransformerModelBundle} bundle
 */
async function unloadTransformerModel(bundle) {
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
						if (match) {
							modelIds.add(match[1]);
						}
					});

					const currentModelId = transformerManager.modelId;
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
						errorMessage +=
							"\n\nThis is likely due to insufficient memory or WebGPU issues. " +
							"Gemma 3 1B requires at least 2-3GB of available RAM in q4 format. " +
							"Try:\n1. Closing other browser tabs\n2. Restarting your browser\n3. Using a smaller model";
					}

					reply(src, origin, messageId, "error", {
						error: {
							message: errorMessage,
							type: "ModelLoadError",
							code: null,
						},
					});
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
				} = payload || {};

				if (!messages) throw new Error("Messages are required");

				const targetModel = model || transformerManager.modelId;
				if (!targetModel) {
					throw new Error("No model specified and no model loaded. Call serve first.");
				}

				try {
					await transformerManager.withModel(targetModel, async (bundle) => {
						const { model: currentModel, tokenizer: currentTokenizer } = bundle;

						// Apply chat template
						const input = currentTokenizer.apply_chat_template(messages, {
							add_generation_prompt: true,
							return_dict: true,
						});

						const promptLength = input.input_ids?.dims?.[1] || 0;
						const tokenizerMaxRaw =
							typeof currentTokenizer?.model_max_length === "number"
								? currentTokenizer.model_max_length
								: undefined;
						const tokenizerMax =
							typeof tokenizerMaxRaw === "number" &&
								Number.isFinite(tokenizerMaxRaw) &&
								tokenizerMaxRaw > 0 &&
								tokenizerMaxRaw <= 1_000_000
								? tokenizerMaxRaw
								: undefined;

						const cfg = currentModel?.config || {};
						const modelMaxRaw =
							typeof cfg.max_position_embeddings === "number"
								? cfg.max_position_embeddings
								: typeof cfg.n_positions === "number"
									? cfg.n_positions
									: typeof cfg.context_length === "number"
										? cfg.context_length
										: typeof cfg.max_seq_len === "number"
											? cfg.max_seq_len
											: typeof cfg.n_ctx === "number"
												? cfg.n_ctx
												: typeof cfg.seq_length === "number"
													? cfg.seq_length
													: undefined;
						const modelMax =
							typeof modelMaxRaw === "number" &&
								Number.isFinite(modelMaxRaw) &&
								modelMaxRaw > 0 &&
								modelMaxRaw <= 1_000_000
								? modelMaxRaw
								: undefined;

						const maxContextTokens =
							typeof tokenizerMax === "number"
								? tokenizerMax
								: typeof modelMax === "number"
									? modelMax
									: undefined;
						const maxNewTokensLimit =
							typeof maxContextTokens === "number"
								? Math.max(0, maxContextTokens - promptLength)
								: undefined;

						const requestedMaxTokens =
							typeof max_tokens === "number" && Number.isFinite(max_tokens)
								? max_tokens
								: typeof maxNewTokensLimit === "number"
									? maxNewTokensLimit
									: undefined;

						if (typeof max_tokens !== "number" && typeof maxNewTokensLimit === "number") {
							console.log("[transformer-runner] auto max_new_tokens", {
								auto: true,
								max_new_tokens: requestedMaxTokens,
								promptLength,
								maxContextTokens,
							});
						}

						const effectiveMaxNewTokens =
							typeof maxNewTokensLimit === "number" && typeof requestedMaxTokens === "number"
								? Math.min(requestedMaxTokens, maxNewTokensLimit)
								: requestedMaxTokens;

						if (typeof maxNewTokensLimit === "number" && maxNewTokensLimit <= 0) {
							throw new Error(
								`Prompt is too long for the model context window (promptLength=${promptLength}, maxContextTokens=${maxContextTokens})`,
							);
						}

						if (stream) {
							const { TextStreamer } = transformers;

							const streamer = new TextStreamer(currentTokenizer, {
								skip_prompt: true,
								skip_special_tokens: true,
								callback_function: (token) => {
									const chunk = {
										id: `chatcmpl-${generateId()}`,
										object: "chat.completion.chunk",
										created: Math.floor(Date.now() / 1000),
										model: targetModel,
										choices: [
											{
												index: 0,
												delta: { content: token },
												finish_reason: null,
											},
										],
									};
									reply(src, origin, messageId, "stream_chunk", chunk);
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

							const finalChunk = {
								id: `chatcmpl-${generateId()}`,
								object: "chat.completion.chunk",
								created: Math.floor(Date.now() / 1000),
								model: targetModel,
								choices: [
									{
										index: 0,
										delta: {},
										finish_reason: "stop",
									},
								],
							};
							reply(src, origin, messageId, "stream_end", finalChunk);
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

							let trimmedSeq = generationResult.sequences;
							if (typeof generationResult.sequences?.slice === "function") {
								trimmedSeq = generationResult.sequences.slice(null, [promptLength, null]);
							}

							const decoded = currentTokenizer.batch_decode(trimmedSeq, {
								skip_special_tokens: true,
							})[0] || "";

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
								usage: {
									prompt_tokens: promptLength,
									completion_tokens: (generationResult.sequences?.dims?.[1] || promptLength) - promptLength,
									total_tokens: generationResult.sequences?.dims?.[1] || promptLength,
								},
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
		reply(src, origin, messageId, "error", {
			error: {
				message: error.message || "Unknown error",
				type: error.name || "Error",
				code: null,
			},
		});
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
