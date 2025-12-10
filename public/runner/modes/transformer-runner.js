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

	// Configure ONNX Runtime to use local bundled WASM files
	if (transformers.env?.backends?.onnx?.wasm) {
		// Get the correct URL for the bundled ONNX Runtime files
		const wasmPath =
			typeof chrome !== "undefined" && chrome.runtime?.getURL
				? chrome.runtime.getURL("vendors/transformers/")
				: "../../../vendors/transformers/";
		transformers.env.backends.onnx.wasm.wasmPaths = wasmPath;
		console.log("ONNX Runtime WASM path configured:", wasmPath);
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

				// Progress callback for model loading
				const progressCallback = (progress) => {
					if (
						progress.status === "progress" &&
						progress.file?.endsWith(".onnx_data")
					) {
						const loaded = progress.loaded || 0;
						const total = progress.total || 1;
						const percent = Math.min(100, Math.round((loaded / total) * 100));
						reply(src, origin, messageId, "progress", {
							loaded,
							total,
							percent,
							text: `Downloading model... ${percent}%`,
						});
					}
				};

				try {
					// Unload previous model if any
					if (currentModel) {
						currentModel.dispose?.();
						currentModel = null;
					}
					if (currentTokenizer) {
						currentTokenizer.dispose?.();
						currentTokenizer = null;
					}

					// Load tokenizer
					currentTokenizer = await AutoTokenizer.from_pretrained(model, {
						progress_callback: progressCallback,
					});

					// Load model with WebGPU
					currentModel = await AutoModelForCausalLM.from_pretrained(model, {
						dtype: "q4f16",
						device: "webgpu",
						progress_callback: progressCallback,
					});

					activeModelId = model;
					const modelInfo = {
						id: model,
						object: "model",
						created: Math.floor(Date.now() / 1000),
						owned_by: "transformer",
						loaded: true,
						downloaded: true,
					};

					loadedModels.set(model, modelInfo);
					reply(src, origin, messageId, "complete", modelInfo);
				} catch (error) {
					reply(src, origin, messageId, "error", {
						error: {
							message: `Failed to load model: ${error.message}`,
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
					max_tokens = 512,
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
							max_new_tokens: max_tokens,
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
							max_new_tokens: max_tokens,
							do_sample: temperature > 0,
							return_dict_in_generate: true,
							temperature,
							top_p,
							top_k,
						});

						// Decode the generated sequence
						const promptLength = input.input_ids?.dims?.[1] || 0;
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
