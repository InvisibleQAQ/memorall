// Transformer Runner - Local LLM inference via HuggingFace Transformers.js with WebGPU
import { reply, generateId, sendReady } from "../utils/common.js";

// Scoped state
let AutoTokenizer;
let AutoModelForCausalLM;
let transformers;
let currentModel = null;
let currentTokenizer = null;
let activeModelId = null;
const loadedModels = new Map();

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

					const downloadedModels = Array.from(modelIds).map((modelId) => {
						const isLoaded = activeModelId === modelId;
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
				if (!transformers)
					throw new Error("Transformers not initialized. Call init first.");

				const { model } = payload || {};
				if (!model) throw new Error("Model ID is required");
				const hasWebGPU =
					typeof navigator !== "undefined" && typeof navigator.gpu !== "undefined";

				// Try WebGPU first, but will fallback to WASM if it fails
				let device = hasWebGPU ? "webgpu" : "wasm";
				console.log("[transformer-runner] device selection", {
					hasWebGPU,
					initialDevice: device,
					model,
				});

				// Progress callback for model loading
				let currentDtype = null;
				const progressCallback = (progress) => {
					if (
						progress.status === "progress" &&
						progress.file?.endsWith(".onnx_data")
					) {
						const loaded = progress.loaded || 0;
						const total = progress.total || 1;
						const percent = Math.min(100, Math.round((loaded / total) * 100));
						const dtypeInfo = currentDtype ? ` (${currentDtype})` : "";
						reply(src, origin, messageId, "progress", {
							loaded,
							total,
							percent,
							text: `Downloading model${dtypeInfo}... ${percent}%`,
						});
					}
				};

				try {
					// Unload previous model if any
					if (currentModel) {
						console.log("[transformer-runner] disposing previous model");
						try {
							currentModel.dispose?.();
						} catch (e) {
							console.warn("Error disposing model:", e);
						}
						currentModel = null;
					}
					if (currentTokenizer) {
						try {
							currentTokenizer.dispose?.();
						} catch (e) {
							console.warn("Error disposing tokenizer:", e);
						}
						currentTokenizer = null;
					}

					// Load tokenizer
					console.log("[transformer-runner] loading tokenizer for", model);
					currentTokenizer = await AutoTokenizer.from_pretrained(model, {
						progress_callback: progressCallback,
					});
					console.log("[transformer-runner] tokenizer loaded successfully");

					// Use smallest quantization for browser performance (q4 = 4-bit, most aggressive)
					currentDtype = "q4";

					// Try multiple configurations: device (WebGPU → WASM) and threads (4 → 1)
					let loadError = null;
					const devicesToTry = device === "webgpu" ? ["webgpu", "wasm"] : ["wasm"];
					const threadsToTry = [4, 1]; // Try multi-thread first for performance, fallback to single-thread

					for (const tryDevice of devicesToTry) {
						for (const numThreads of threadsToTry) {
							try {
								// Set thread count for this attempt
								if (transformers.env?.backends?.onnx?.wasm) {
									transformers.env.backends.onnx.wasm.numThreads = numThreads;
								}

								console.log(
									`[transformer-runner] loading model with dtype: ${currentDtype}, device: ${tryDevice}, threads: ${numThreads}`,
								);

								currentModel = await AutoModelForCausalLM.from_pretrained(model, {
									dtype: currentDtype,
									device: tryDevice,
									progress_callback: progressCallback,
								});

								device = tryDevice; // Update to successful device
								console.log(
									`[transformer-runner] ✅ model loaded successfully with dtype: ${currentDtype}, device: ${device}, threads: ${numThreads}`,
								);
								break; // Success, exit inner loop
							} catch (err) {
								loadError = err;
								const errorMsg = err instanceof Error ? err.message : String(err);
								console.warn(
									`[transformer-runner] failed to load with device ${tryDevice}, threads ${numThreads}: ${errorMsg}`,
								);

								// If this was multi-thread and we have single-thread fallback, continue
								if (numThreads === 4 && threadsToTry.length > 1) {
									console.log("[transformer-runner] falling back to single-thread...");
									continue;
								}

								// If we've tried all thread counts for this device and this was WebGPU, try WASM
								if (tryDevice === "webgpu" && devicesToTry.length > 1) {
									console.log("[transformer-runner] falling back to WASM...");
									break; // Exit thread loop, continue to next device
								}

								// No more fallbacks, throw error
								throw err;
							}
						}

						// If model loaded successfully, exit device loop
						if (currentModel) break;
					}

					if (!currentModel) {
						// Convert error to string if it's not an Error object
						const errorMsg = loadError instanceof Error ? loadError.message : String(loadError);
						throw new Error(`Failed to load model: ${errorMsg}`);
					}

					activeModelId = model;

					// Include quantization info in model metadata
					const usedDtype = currentDtype || "unknown";
					const quantizationInfo = {
						q4: "4-bit (smallest, fastest)",
						q4f16: "4-bit weights + fp16 activations",
						fp16: "16-bit floating point",
						q8: "8-bit quantization",
					}[usedDtype] || usedDtype;

					console.log(`[transformer-runner] model serving with ${quantizationInfo}`);

					const modelInfo = {
						id: model,
						object: "model",
						created: Math.floor(Date.now() / 1000),
						owned_by: "transformer",
						loaded: true,
						downloaded: true,
						dtype: usedDtype, // Include dtype in response
					};

					loadedModels.set(model, modelInfo);
					reply(src, origin, messageId, "complete", modelInfo);
				} catch (error) {
					console.error("[transformer-runner] model loading failed:", error);

					// Clean up on error
					if (currentModel) {
						try {
							currentModel.dispose?.();
						} catch (e) {
							console.warn("Error disposing model after failure:", e);
						}
						currentModel = null;
					}
					if (currentTokenizer) {
						try {
							currentTokenizer.dispose?.();
						} catch (e) {
							console.warn("Error disposing tokenizer after failure:", e);
						}
						currentTokenizer = null;
					}
					activeModelId = null;

					// Handle both Error objects and primitive values (numbers, strings)
					const errorStr = error instanceof Error ? error.message : String(error);
					const isMemoryError =
						errorStr.includes("Aborted") ||
						errorStr.includes("abort") ||
						errorStr.includes("memory") ||
						/^\d+$/.test(errorStr); // Numeric error codes often indicate WASM/memory issues

					// Provide helpful error message
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
				if (!currentModel || !currentTokenizer)
					throw new Error("No model loaded. Call serve first.");

				const {
					messages,
					stream = false,
					max_tokens,
					temperature = 0,
					top_p = 1,
					top_k = 50,
				} = payload || {};

				if (!messages) throw new Error("Messages are required");

				try {
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

					// If caller doesn't set max_tokens, we use the maximum allowed by model context.
					// If context window is unknown, we do NOT set max_new_tokens at all.
					const requestedMaxTokens =
						typeof max_tokens === "number" && Number.isFinite(max_tokens)
							? max_tokens
							: typeof maxNewTokensLimit === "number"
								? maxNewTokensLimit
								: undefined;

					if (
						typeof max_tokens !== "number" &&
						typeof maxNewTokensLimit === "number"
					) {
						console.log("[transformer-runner] auto max_new_tokens", {
							auto: true,
							max_new_tokens: requestedMaxTokens,
							promptLength,
							maxContextTokens,
							tokenizerMaxRaw,
							modelMaxRaw,
						});
					}
					if (
						typeof max_tokens !== "number" &&
						typeof maxNewTokensLimit !== "number"
					) {
						console.log("[transformer-runner] max_new_tokens unset", {
							reason: "unknown_context_window",
							promptLength,
							tokenizerMaxRaw,
							modelMaxRaw,
							configKeys: Object.keys(cfg || {}).slice(0, 50),
						});
					}

					const effectiveMaxNewTokens =
						typeof maxNewTokensLimit === "number" &&
						typeof requestedMaxTokens === "number"
							? Math.min(requestedMaxTokens, maxNewTokensLimit)
							: requestedMaxTokens;

					if (
						typeof maxNewTokensLimit === "number" &&
						maxNewTokensLimit <= 0
					) {
						throw new Error(
							`Prompt is too long for the model context window (promptLength=${promptLength}, maxContextTokens=${maxContextTokens})`,
						);
					}

					if (stream) {
						// Streaming response
						const { TextStreamer } = transformers;
						const chunks = [];

						const streamer = new TextStreamer(currentTokenizer, {
							skip_prompt: true,
							skip_special_tokens: true,
							callback_function: (token) => {
								const chunk = {
									id: `chatcmpl-${generateId()}`,
									object: "chat.completion.chunk",
									created: Math.floor(Date.now() / 1000),
									model: activeModelId,
									choices: [
										{
											index: 0,
											delta: { content: token },
											finish_reason: null,
										},
									],
								};
								chunks.push(token);
								reply(src, origin, messageId, "stream_chunk", chunk);
							},
						});

						// Generate with streaming
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

						// Send final chunk with finish_reason
						const finalChunk = {
							id: `chatcmpl-${generateId()}`,
							object: "chat.completion.chunk",
							created: Math.floor(Date.now() / 1000),
							model: activeModelId,
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
						// Non-streaming response
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

						// Decode the generated sequence
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
							model: activeModelId,
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
				if (model === activeModelId) {
					if (currentModel) {
						currentModel.dispose?.();
						currentModel = null;
					}
					if (currentTokenizer) {
						currentTokenizer.dispose?.();
						currentTokenizer = null;
					}
					activeModelId = null;
					loadedModels.delete(model);
				}
				reply(src, origin, messageId, "complete", { status: "unloaded" });
				break;
			}

			case "delete": {
				// For transformers, delete means clearing from cache
				const { model } = payload || {};
				try {
					// Unload first if it's the active model
					if (model === activeModelId) {
						if (currentModel) {
							currentModel.dispose?.();
							currentModel = null;
						}
						if (currentTokenizer) {
							currentTokenizer.dispose?.();
							currentTokenizer = null;
						}
						activeModelId = null;
					}

					// Clear from cache
					const caches = await window.caches.open("transformers-cache");
					const keys = await caches.keys();
					for (const request of keys) {
						if (request.url.includes(model)) {
							await caches.delete(request);
						}
					}

					loadedModels.delete(model);
					reply(src, origin, messageId, "complete", { status: "deleted" });
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

// Signal that the runner is ready
sendReady();
