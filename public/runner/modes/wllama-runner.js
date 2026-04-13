// Wllama Runner - Local LLM inference via WebAssembly
import { reply, generateId, sendReady } from "../utils/common.js";
import { ModelLifecycleManager } from "../utils/model-lifecycle.js";

const WASM_PATHS = {
	"single-thread/wllama.wasm":
		"https://cdn.jsdelivr.net/npm/@wllama/wllama@2.3.5/src/single-thread/wllama.wasm",
	"multi-thread/wllama.wasm":
		"https://cdn.jsdelivr.net/npm/@wllama/wllama@2.3.5/src/multi-thread/wllama.wasm",
};

// Scoped state
let Wllama;
const loadedModelsCache = new Map();
const activeOperations = new Map(); // Track active operations for abort support
const WLLAMA_METADATA_PREFIX = "__metadata__";
const pendingLoadMemoryHints = new Map();
const DEFAULT_WLLAMA_N_CTX = 65536;

// Stored progress callback for current load operation
let currentProgressCallback = null;

function resolveMemoryContextTokens(memoryHint) {
	if (!memoryHint || typeof memoryHint !== "object") {
		return undefined;
	}

	const { availableGB, sizeGB, kvBytesPerToken, contextLength } = memoryHint;
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
	const roundedTokens = Math.max(0, Math.floor(maxTokens / 1024) * 1024);

	if (
		typeof contextLength === "number" &&
		Number.isFinite(contextLength) &&
		contextLength > 0
	) {
		return Math.min(roundedTokens, contextLength);
	}

	return roundedTokens;
}

async function resolveWllamaPromptLength(wllama, messages) {
	const prompt = await wllama.formatChat(messages, true);
	const tokens = await wllama.tokenize(prompt, true);
	let promptLength = Array.isArray(tokens) ? tokens.length : 0;

	if (
		wllama.addBosToken &&
		typeof wllama.bosToken === "number" &&
		Array.isArray(tokens) &&
		tokens[0] !== wllama.bosToken
	) {
		promptLength += 1;
	}

	return promptLength;
}

async function ensureWllama() {
	if (Wllama) return;
	const mod = await import("../libs/wllama.js");
	Wllama = mod.Wllama || mod.default || mod;
	if (!Wllama) throw new Error("Failed to load @wllama/wllama");
}

/**
 * Parse model name and return HuggingFace URL
 * @param {string} model - Format: username/repo/filename
 * @returns {{ modelId: string, url: string }}
 */
function parseModelName(model) {
	const parts = model.split("/");
	if (parts.length < 3) {
		throw new Error("Model name must be in format: username/repo/filename");
	}
	return {
		modelId: model,
		url: `https://huggingface.co/${parts[0]}/${parts[1]}/resolve/main/${parts[2]}`,
	};
}

function normalizeWllamaCacheURL(url) {
	return url.replace(/-\d{5}-of-\d{5}(?=\.gguf(?:[?#].*)?$)/i, "");
}

async function deleteWllamaModelFromCache(modelId) {
	const { url } = parseModelName(modelId);
	const targetURL = normalizeWllamaCacheURL(url);
	const targetFilename = modelId.split("/").pop() || "";
	const root = await navigator.storage.getDirectory();

	let cacheDir;
	try {
		cacheDir = await root.getDirectoryHandle("cache");
	} catch (error) {
		return;
	}

	const entriesToDelete = new Set();

	for await (const [name, handle] of cacheDir.entries()) {
		if (handle.kind !== "file" || !name.startsWith(WLLAMA_METADATA_PREFIX)) {
			continue;
		}

		const file = await handle.getFile();
		const metadata = await new Response(file.stream()).json().catch(() => null);
		const originalURL =
			typeof metadata?.originalURL === "string" ? metadata.originalURL : "";

		if (!originalURL) {
			if (!targetFilename || !name.endsWith(`_${targetFilename}`)) {
				continue;
			}
			entriesToDelete.add(name);
			entriesToDelete.add(name.replace(WLLAMA_METADATA_PREFIX, ""));
			continue;
		}

		if (normalizeWllamaCacheURL(originalURL) !== targetURL) {
			continue;
		}

		entriesToDelete.add(name);
		entriesToDelete.add(name.replace(WLLAMA_METADATA_PREFIX, ""));
	}

	await Promise.all(
		Array.from(entriesToDelete).map(async (name) => {
			try {
				await cacheDir.removeEntry(name);
			} catch (_) {}
		}),
	);
}

/**
 * Load a Wllama model
 * @param {string} modelId - Model identifier (username/repo/filename)
 * @param {Function} [notifyProgress]
 * @returns {Promise<any>} - The Wllama instance with model loaded
 */
async function loadWllamaModel(modelId, notifyProgress) {
	await ensureWllama();

	const { url } = parseModelName(modelId);
	const wllama = new Wllama(WASM_PATHS);
	const memoryHint = pendingLoadMemoryHints.get(modelId);
	const memoryContextTokens = resolveMemoryContextTokens(memoryHint);

	if (typeof memoryContextTokens === "number" && memoryContextTokens <= 0) {
		throw new Error(
			`Model does not fit available device memory (availableGB=${memoryHint?.availableGB ?? "unknown"})`,
		);
	}

	const nCtx =
		typeof memoryContextTokens === "number"
			? Math.min(DEFAULT_WLLAMA_N_CTX, memoryContextTokens)
			: DEFAULT_WLLAMA_N_CTX;

	const progressCallback = (progress) => {
		if (notifyProgress) {
			const { loaded, total } = progress;
			const percent = Math.max(0, Math.min(100, Math.round((loaded / (total || 1)) * 100)));
			notifyProgress({ loaded, total, percent, text: "" });
		}
	};

	try {
		await wllama.loadModelFromUrl(url, {
			progressCallback,
			n_ctx: nCtx,
		});
	} finally {
		pendingLoadMemoryHints.delete(modelId);
	}

	return wllama;
}

/**
 * Unload Wllama instance
 * @param {any} wllama
 */
async function unloadWllamaModel(wllama) {
	try {
		if (wllama && typeof wllama.exit === "function") {
			await wllama.exit();
		}
	} catch (e) {
		console.warn("[wllama-runner] unload error:", e?.message || e);
	}
}

// Model lifecycle manager - handles caching and auto-unload after 5 min idle
const wllamaManager = new ModelLifecycleManager({
	name: "wllama-runner",
	loadFn: loadWllamaModel,
	unloadFn: unloadWllamaModel,
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
				await ensureWllama();
				reply(src, origin, messageId, "complete", {
					status: "initialized",
					mode: "wllama",
				});
				break;
			}

			case "models": {
				await ensureWllama();
				let downloadedModels = [];
				const wllama = wllamaManager.model;
				const currentModelId = wllamaManager.modelId;

				if (wllama && wllama.cacheManager) {
					try {
						const cacheEntries = await wllama.cacheManager.list();
						downloadedModels = cacheEntries
							.filter((entry) => entry.name.endsWith(".gguf"))
							.map((entry) => {
								const originURL = entry.metadata?.originalURL || "";
								const match = originURL.match(
									/^https:\/\/huggingface\.co\/([^\/]+\/[^\/]+)\/resolve\/main\/(.+)$/,
								);
								const name = match ? match[1] : "";
								const filename = match ? match[2] : entry.name;
								const fullModelId =
									name && filename ? `${name}/${filename}` : entry.name;
								const isLoaded =
									currentModelId &&
									fullModelId.toLowerCase() === currentModelId.toLowerCase();
								return {
									id: fullModelId,
									name: fullModelId,
									filename,
									loaded: !!isLoaded,
									downloaded: true,
									object: "model",
									created: Date.now(),
									owned_by: "local",
									size: entry.size || 0,
								};
							});
					} catch (error) {
						console.error("Failed to get cached models:", error);
					}
				}

				if (downloadedModels.length === 0 && wllama && wllama.currentModel && wllama.isModelLoaded) {
					const currentModelName = wllama.currentModel.name || "unknown";
					const modelId = currentModelName.replace(".gguf", "").replace(/_/g, "/");
					downloadedModels = [
						{
							id: modelId,
							name: modelId,
							loaded: true,
							downloaded: true,
							object: "model",
							created: Date.now(),
							owned_by: "local",
						},
					];
				}

				reply(src, origin, messageId, "complete", {
					object: "list",
					data: downloadedModels,
				});
				break;
			}

			case "serve": {
				const { model, _memoryHint } = payload || {};
				if (!model) throw new Error("Model name is required");

				// Validate format
				parseModelName(model);
				if (_memoryHint) {
					pendingLoadMemoryHints.set(model, _memoryHint);
				}

				const notifyProgress = (info) => {
					reply(src, origin, messageId, "progress", info);
				};

				try {
					await wllamaManager.load(model, notifyProgress);

					const modelInfo = {
						id: model,
						object: "model",
						created: Math.floor(Date.now() / 1000),
						owned_by: "wllama",
						permission: [],
						root: model,
						parent: null,
						loaded: true,
						downloaded: true,
					};

					loadedModelsCache.set(model, modelInfo);
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
				const {
					messages,
					model,
					stream = false,
					max_tokens = 512,
					temperature = 0.8,
					top_p = 0.9,
					top_k = 40,
					stop,
					_memoryHint,
				} = payload || {};

				if (!messages) throw new Error("Messages are required");

				const targetModel = model || wllamaManager.modelId;
				if (!targetModel) {
					throw new Error("No model specified and no model loaded. Call serve first.");
				}

				// Validate format
				parseModelName(targetModel);

				// Create abort controller for this operation
				const abortController = new AbortController();
				activeOperations.set(messageId, { abortController });
				if (_memoryHint) {
					pendingLoadMemoryHints.set(targetModel, _memoryHint);
				}

				// Convert OpenAI format to wllama format
				const wllamaMessages = messages.map((msg) => ({
					role: msg.role,
					content: msg.content,
				}));

				try {
					await wllamaManager.withModel(targetModel, async (wllama) => {
						const promptLength = await resolveWllamaPromptLength(
							wllama,
							wllamaMessages,
						);
						const loadedContextInfo = wllama.getLoadedContextInfo?.();
						const maxContextTokens =
							typeof loadedContextInfo?.n_ctx === "number"
								? loadedContextInfo.n_ctx
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
						const requestedMaxTokens =
							typeof max_tokens === "number" && Number.isFinite(max_tokens)
								? max_tokens
								: 256;
						const effectiveMaxTokens =
							typeof maxNewTokensLimit === "number"
								? Math.min(requestedMaxTokens, maxNewTokensLimit)
								: requestedMaxTokens;

						if (
							typeof maxNewTokensLimit === "number" &&
							maxNewTokensLimit <= 0
						) {
							throw new Error(
								typeof memoryContextTokens === "number" &&
								(typeof maxContextTokens !== "number" ||
									memoryContextTokens <= maxContextTokens)
									? `Prompt is too long for available device memory (promptLength=${promptLength}, memoryContextTokens=${memoryContextTokens}, availableGB=${_memoryHint?.availableGB ?? "unknown"})`
									: `Prompt is too long for the model context window (promptLength=${promptLength}, maxContextTokens=${maxContextTokens})`,
							);
						}

						if (effectiveMaxTokens < requestedMaxTokens) {
							console.log("[wllama-runner] clamped nPredict", {
								requested: requestedMaxTokens,
								effective: effectiveMaxTokens,
								promptLength,
								maxContextTokens,
								memoryContextTokens,
								availableGB: _memoryHint?.availableGB,
							});
						}

						const wllamaOptions = {
							nPredict: effectiveMaxTokens,
							sampling: {
								temp: typeof temperature === "number" ? temperature : 0.7,
								top_p: typeof top_p === "number" ? top_p : 0.9,
								top_k: typeof top_k === "number" ? top_k : 40,
							},
						};
						if (stop) {
							wllamaOptions.stopSequence = Array.isArray(stop) ? stop : [stop];
						}

						if (stream) {
							const responseId = `chatcmpl-${generateId()}`;
							let content = "";

							await wllama.createChatCompletion(wllamaMessages, {
								...wllamaOptions,
								onNewToken: (_token, piece, currentText) => {
									if (abortController.signal.aborted) {
										throw new Error("Operation aborted");
									}

									const deltaText =
										typeof currentText === "string"
											? currentText.slice(content.length)
											: typeof piece === "string"
												? piece
												: String(piece ?? "");
									if (!deltaText) return;
									content += deltaText;
									const chunk = {
										id: responseId,
										object: "chat.completion.chunk",
										created: Math.floor(Date.now() / 1000),
										model: targetModel,
										choices: [
											{
												index: 0,
												delta: { content: deltaText },
												finish_reason: null,
											},
										],
									};
									reply(src, origin, messageId, "stream_chunk", chunk);
								},
							});

							const finalChunk = {
								id: responseId,
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
							const text = await wllama.createChatCompletion(wllamaMessages, wllamaOptions);
							const response = {
								id: `chatcmpl-${generateId()}`,
								object: "chat.completion",
								created: Math.floor(Date.now() / 1000),
								model: targetModel,
								choices: [
									{
										index: 0,
										message: { role: "assistant", content: text || "" },
										finish_reason: "stop",
									},
								],
								usage: {
									prompt_tokens: -1,
									completion_tokens: -1,
									total_tokens: -1,
								},
							};
							reply(src, origin, messageId, "complete", response);
						}
					});
				} catch (error) {
					console.error("Wllama error:", error);
					throw error;
				} finally {
					activeOperations.delete(messageId);
				}
				break;
			}

			case "unload": {
				const { model } = payload || {};
				const currentModel = wllamaManager.modelId;

				if (model) {
					parseModelName(model);
					if (model !== currentModel) {
						throw new Error(`Model ${model} is not loaded`);
					}
				}

				await wllamaManager.unload();

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

				parseModelName(model);

				// If this model is currently loaded, unload it first
				if (wllamaManager.modelId === model) {
					await wllamaManager.unload();
				}

				await deleteWllamaModelFromCache(model);

				loadedModelsCache.delete(model);
				reply(src, origin, messageId, "complete", {
					status: "deleted",
					model,
				});
				break;
			}

			default:
				throw new Error(`Unknown message type: ${type}`);
		}
	} catch (error) {
		console.error("Wllama error:", error);
		reply(src, origin, messageId, "error", {
			error: {
				message: error.message || "Unknown error",
				type: error.constructor.name || "Error",
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
sendReady("wllama", endpoints);

console.log("Wllama runner initialized");
