// WebLLM Runner - WebGPU-accelerated chat completions via WebLLM
import { reply, generateId, sendReady } from "../utils/common.js";

// Scoped state
let WebLLMEngine;
let WebLLMMod;
let prebuiltAppConfig;
let webllmEngine;
const loadedModels = new Map();
let loadedModel;
const activeOperations = new Map(); // Track active operations for abort support

// Query downloaded status via WebLLM engine APIs when available
async function isDownloaded(modelId) {
	try {
		if (WebLLMMod && typeof WebLLMMod.hasModelInCache === "function") {
			return await WebLLMMod.hasModelInCache(modelId);
		}
		if (webllmEngine && typeof webllmEngine.hasModelInCache === "function") {
			return await webllmEngine.hasModelInCache(modelId);
		}
	} catch (e) {
		console.warn("[downloaded] hasModelInCache error:", e?.message || e);
	}
	return false;
}

async function ensureWebLLM() {
	if (WebLLMEngine) return;
	try {
		// Help WebLLM avoid worker creation in iframe contexts
		if (typeof window !== "undefined") {
			window.__WEBLLM_NO_WORKER__ = true;
		}

		// Import bundled WebLLM
		const mod = await import("../libs/web-llm.js");
		WebLLMMod = mod;

		if (!mod.MLCEngine) {
			throw new Error("MLCEngine export not found");
		}
		WebLLMEngine = mod.MLCEngine;

		prebuiltAppConfig =
			mod.prebuiltAppConfig ||
			mod.prebuiltAppConfigV2 ||
			mod.prebuiltConfig ||
			null;
		if (!prebuiltAppConfig) {
			// Build a minimal config if not available
			prebuiltAppConfig = { model_list: [] };
		}

		// Do not create engine here; create per-serve with progress callback
	} catch (e) {
		console.error("WebLLM load error:", e);
		throw e;
	}
}

window.addEventListener("message", async (event) => {
	const src = event.source;
	const origin = event.origin;
	const { messageId, type, payload } = event.data || {};

	try {
		switch (type) {
			case "abort": {
				const operation = activeOperations.get(messageId);
				if (operation && operation.abortController) {
					operation.abortController.abort();
					activeOperations.delete(messageId);
				}
				return; // Don't reply for abort messages
			}
			case "init": {
				await ensureWebLLM();
				reply(src, origin, messageId, "complete", {
					status: "initialized",
					mode: "webllm",
				});
				break;
			}
			case "models": {
				await ensureWebLLM();
				const list = prebuiltAppConfig?.model_list || [];
				const models = await Promise.all(
					list.map(async (m) => {
						const id = m.model_id || m.model || m.name || "unknown";
						const downloaded = await isDownloaded(id);
						return {
							id,
							object: "model",
							created: Math.floor(Date.now() / 1000),
							owned_by: "webllm",
							permission: [],
							root: id,
							parent: null,
							loaded: loadedModels.get(id)?.loaded || false,
							downloaded,
						};
					}),
				);
				reply(src, origin, messageId, "complete", {
					object: "list",
					data: models,
				});
				break;
			}
			case "serve": {
				await ensureWebLLM();
				const { model } = payload || {};
				if (!model) throw new Error("Model name is required");

				// Validate against prebuilt config if present
				const modelEntry = (prebuiltAppConfig?.model_list || []).find((m) => {
					const id = m.model_id || m.model || m.name;
					return id === model;
				});

				if (!modelEntry && prebuiltAppConfig?.model_list?.length) {
					throw new Error(`Model ${model} not found in WebLLM prebuilt config`);
				}

				// Prepare progress reporting
				let lastPercent = 0;
				const reportProgress = (loaded, total, text) => {
					const percent = Math.max(
						0,
						Math.min(100, Math.round((loaded / (total || 1)) * 100)),
					);
					if (percent !== lastPercent) {
						lastPercent = percent;
						reply(src, origin, messageId, "progress", {
							loaded,
							total,
							percent,
							text,
						});
					}
				};

				try {
					// Clean current engine if exists
					if (webllmEngine && typeof webllmEngine.unload === "function") {
						try {
							await webllmEngine.unload();
						} catch (e) {
							console.warn(
								"[serve] unload previous engine error:",
								e?.message || e,
							);
						}
					}

					// Create a fresh engine with progress callback and load model
					webllmEngine = new WebLLMEngine({
						initProgressCallback: (progressData) => {
							const { progress, text } = progressData || {};
							reportProgress(progress, 1, text);
						},
					});
					if (typeof webllmEngine.reload !== "function") {
						const caps = {
							hasReload: typeof webllmEngine.reload,
							hasUnload: typeof webllmEngine.unload,
						};
						console.error("MLCEngine lacks reload. Capabilities:", caps);
						throw new Error("MLCEngine.reload is not available");
					}
					await webllmEngine.reload(model);

					const modelInfo = {
						id: model,
						object: "model",
						created: Math.floor(Date.now() / 1000),
						owned_by: "webllm",
						permission: [],
						root: model,
						parent: null,
						loaded: true,
						downloaded: await isDownloaded(model),
					};
					loadedModel = model;
					loadedModels.set(model, modelInfo);
					reply(src, origin, messageId, "complete", modelInfo);
				} catch (error) {
					console.error("[serve] load error:", error);
					reply(src, origin, messageId, "error", {
						error: {
							message: `Failed to load model: ${error?.message || String(error)}`,
							type: "ModelLoadError",
							code: null,
						},
					});
				}
				break;
			}
			case "chat/completions": {
				await ensureWebLLM();
				if (!webllmEngine)
					throw new Error("WebLLM engine not initialized or incompatible");

				const {
					messages,
					model,
					stream = false,
					max_tokens = 512,
					temperature = 0.8,
					top_p = 0.9,
				} = payload || {};

				if (!messages) throw new Error("Messages are required");

				// Create abort controller for this operation
				const abortController = new AbortController();
				activeOperations.set(messageId, { abortController });

				const requestOptions = {
					messages,
					model: model || loadedModel,
					temperature,
					top_p,
					max_tokens,
					signal: abortController.signal,
				};

				try {
					if (stream) {
						const completionStream = await webllmEngine.chat.completions.create({
							...requestOptions,
							stream: true,
						});
						let lastChunk;

						for await (const chunk of completionStream) {
							lastChunk = chunk
							if (abortController.signal.aborted) {
								throw new Error("Operation aborted");
							}

							reply(src, origin, messageId, "chunk", chunk);
						}

						lastChunk.content = await webllmEngine.getMessage()

						reply(src, origin, messageId, "end", lastChunk);
					} else {
						const completion = await webllmEngine.chat.completions.create({
							...requestOptions,
							stream: false,
						});
						reply(src, origin, messageId, "complete", completion);
					}
				} catch (error) {
					console.error("WebLLM error:", error);
					throw error;
				} finally {
					activeOperations.delete(messageId);
				}
				break;
			}
			case "unload": {
				const { model } = payload || {};
				if (!model) throw new Error("Model name is required");
				if (!loadedModels.has(model))
					throw new Error(`Model ${model} is not loaded`);
				try {
					webllmEngine = new WebLLMEngine();
				} catch (error) {
					console.error("Error reinitializing WebLLM engine:", error);
				}
				const modelInfo = loadedModels.get(model);
				if (modelInfo) {
					modelInfo.loaded = false;
					loadedModels.set(model, modelInfo);
				}
				loadedModel = undefined;
				reply(src, origin, messageId, "complete", {
					status: "unloaded",
					model,
				});
				break;
			}
			case "delete": {
				const { model } = payload || {};
				if (!model) throw new Error("Model name is required");
				if (loadedModels.has(model)) {
					try {
						webllmEngine = new WebLLMEngine();
					} catch (error) {
						console.error("Error reinitializing WebLLM engine:", error);
					}
				}
				loadedModels.delete(model);
				reply(src, origin, messageId, "complete", { status: "deleted", model });
				break;
			}
			default:
				throw new Error(`Unknown message type: ${type}`);
		}
	} catch (err) {
		console.error("WebLLM error:", err);
		reply(src, origin, messageId, "error", {
			error: {
				message: (err && err.message) || "Unknown error",
				type: "invalid_request_error",
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
sendReady("webllm", endpoints);
