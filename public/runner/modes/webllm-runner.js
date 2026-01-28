// WebLLM Runner - WebGPU-accelerated chat completions via WebLLM
import { reply, generateId, sendReady } from "../utils/common.js";
import { ModelLifecycleManager } from "../utils/model-lifecycle.js";

// Scoped state
let WebLLMEngine;
let WebLLMMod;
let prebuiltAppConfig;
const loadedModelsCache = new Map(); // Cache model metadata
const activeOperations = new Map(); // Track active operations for abort support

// Query downloaded status via WebLLM engine APIs when available
async function isDownloaded(modelId) {
	try {
		if (WebLLMMod && typeof WebLLMMod.hasModelInCache === "function") {
			return await WebLLMMod.hasModelInCache(modelId);
		}
		const engine = webllmManager.model;
		if (engine && typeof engine.hasModelInCache === "function") {
			return await engine.hasModelInCache(modelId);
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
			prebuiltAppConfig = { model_list: [] };
		}
	} catch (e) {
		console.error("WebLLM load error:", e);
		throw e;
	}
}

// Stored progress callback for current load operation
let currentProgressCallback = null;

/**
 * Load a WebLLM model
 * @param {string} modelId
 * @param {Function} [notifyProgress]
 * @returns {Promise<any>} - The WebLLM engine with model loaded
 */
async function loadWebLLMModel(modelId, notifyProgress) {
	await ensureWebLLM();

	// Validate against prebuilt config if present
	const modelEntry = (prebuiltAppConfig?.model_list || []).find((m) => {
		const id = m.model_id || m.model || m.name;
		return id === modelId;
	});

	if (!modelEntry && prebuiltAppConfig?.model_list?.length) {
		throw new Error(`Model ${modelId} not found in WebLLM prebuilt config`);
	}

	currentProgressCallback = notifyProgress;

	const engine = new WebLLMEngine({
		initProgressCallback: (progressData) => {
			const { progress, text } = progressData || {};
			if (currentProgressCallback) {
				const percent = Math.max(0, Math.min(100, Math.round(progress * 100)));
				currentProgressCallback({ loaded: progress, total: 1, percent, text });
			}
		},
	});

	if (typeof engine.reload !== "function") {
		throw new Error("MLCEngine.reload is not available");
	}

	await engine.reload(modelId);
	currentProgressCallback = null;

	return engine;
}

/**
 * Unload WebLLM engine
 * @param {any} engine
 */
async function unloadWebLLMModel(engine) {
	try {
		if (engine && typeof engine.unload === "function") {
			await engine.unload();
		}
	} catch (e) {
		console.warn("[webllm-runner] unload error:", e?.message || e);
	}
}

// Model lifecycle manager - handles caching and auto-unload after 5 min idle
const webllmManager = new ModelLifecycleManager({
	name: "webllm-runner",
	loadFn: loadWebLLMModel,
	unloadFn: unloadWebLLMModel,
});

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
				const currentModelId = webllmManager.modelId;
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
							loaded: id === currentModelId && webllmManager.isLoaded,
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
				const { model } = payload || {};
				if (!model) throw new Error("Model name is required");

				let lastPercent = 0;
				const notifyProgress = (info) => {
					const { percent, text } = info || {};
					if (typeof percent === "number" && percent !== lastPercent) {
						lastPercent = percent;
						reply(src, origin, messageId, "progress", info);
					}
				};

				try {
					await webllmManager.load(model, notifyProgress);

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
					loadedModelsCache.set(model, modelInfo);
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
				const {
					messages,
					model,
					stream = false,
					max_tokens = 512,
					temperature = 0.8,
					top_p = 0.9,
				} = payload || {};

				if (!messages) throw new Error("Messages are required");

				const targetModel = model || webllmManager.modelId;
				if (!targetModel) {
					throw new Error("No model specified and no model loaded. Call serve first.");
				}

				// Create abort controller for this operation
				const abortController = new AbortController();
				activeOperations.set(messageId, { abortController });

				try {
					await webllmManager.withModel(targetModel, async (engine) => {
						const requestOptions = {
							messages,
							model: targetModel,
							temperature,
							top_p,
							max_tokens,
							signal: abortController.signal,
						};

						if (stream) {
							const completionStream = await engine.chat.completions.create({
								...requestOptions,
								stream: true,
							});
							let lastChunk;

							for await (const chunk of completionStream) {
								lastChunk = chunk;
								if (abortController.signal.aborted) {
									throw new Error("Operation aborted");
								}
								reply(src, origin, messageId, "chunk", chunk);
							}

							lastChunk.content = await engine.getMessage();
							reply(src, origin, messageId, "end", lastChunk);
						} else {
							const completion = await engine.chat.completions.create({
								...requestOptions,
								stream: false,
							});
							reply(src, origin, messageId, "complete", completion);
						}
					});
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
				const currentModel = webllmManager.modelId;

				if (model && model !== currentModel) {
					throw new Error(`Model ${model} is not loaded`);
				}

				await webllmManager.unload();

				if (currentModel) {
					const modelInfo = loadedModelsCache.get(currentModel);
					if (modelInfo) {
						modelInfo.loaded = false;
						loadedModelsCache.set(currentModel, modelInfo);
					}
				}

				reply(src, origin, messageId, "complete", {
					status: "unloaded",
					model: model || currentModel,
				});
				break;
			}
			case "delete": {
				const { model } = payload || {};
				if (!model) throw new Error("Model name is required");

				// If this model is currently loaded, unload it first
				if (webllmManager.modelId === model) {
					await webllmManager.unload();
				}

				loadedModelsCache.delete(model);
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
