// Embedding Runner - Text embeddings via @huggingface/transformers
import { reply, sendReady } from "../utils/common.js";

// Read model from query params if provided
const params = new URLSearchParams(self.location ? self.location.search : "");

let HF;
let hfPipeline;
let embeddingModel = params.get("model");

if (embeddingModel) {
	embeddingModel = decodeURIComponent(embeddingModel);
} else {
	embeddingModel = "nomic-ai/nomic-embed-text-v1.5";
}

console.log("[embedding-runner] startup", {
	embeddingModel,
});

function nowMs() {
	return typeof performance !== "undefined" && typeof performance.now === "function"
		? performance.now()
		: Date.now();
}

function formatMs(ms) {
	return `${Math.round(ms)}ms`;
}

function createProgressLogger(context, notify) {
	const lastPctByFile = new Map();
	return (info) => {
		try {
			const status = info?.status;
			const file = info?.file || info?.name;
			const model = info?.model || info?.id || context?.model;

			if (status === "progress") {
				const pct = typeof info?.progress === "number" ? info.progress : undefined;
				if (file && typeof pct === "number") {
					const prev = lastPctByFile.get(file);
					// Throttle to 1% increments
					if (prev === pct) return;
					if (typeof prev === "number" && Math.abs(pct - prev) < 1) return;
					lastPctByFile.set(file, pct);
				}
				try {
					notify && notify({ ...info, model, file, progress: pct });
				} catch {}

				return;
			}

			if (status === "download") {
				try {
					notify && notify({ ...info, model, file });
				} catch {}
				return;
			}

			if (status === "done") {
				try {
					notify && notify({ ...info, model, file });
				} catch {}
				console.log("[embedding-runner] download done", {
					model,
					file,
				});
				return;
			}

			if (status === "ready") {
				try {
					notify && notify(info);
				} catch {}
				console.log("[embedding-runner] model ready", {
					task: info?.task,
					model: info?.model,
				});
				return;
			}

			// Fallback for initiate/unknown shapes
			console.log("[embedding-runner] load event", info);
		} catch {}
	};
}

async function ensureTransformers(modelName, notifyProgress) {
	const startedAt = nowMs();
	console.log("[embedding-runner] ensureTransformers start", {
		modelName,
		embeddingModel,
		hasPipeline: !!hfPipeline,
		hasHF: !!HF,
	});
	if (!HF) {
		const importStartedAt = nowMs();
		console.log("[embedding-runner] ensureTransformers: importing transformers...", {
			modelName,
		});
		HF = await import("../libs/transformers.js");
		console.log("[embedding-runner] ensureTransformers: transformers imported", {
			modelName,
			duration: formatMs(nowMs() - importStartedAt),
			hasPipelineExport: !!HF?.pipeline,
		});
		if (!HF || !HF.pipeline)
			throw new Error("Failed to load @huggingface/transformers");
		try {
			if (HF.env) {
				const configStartedAt = nowMs();

				// Enable browser cache for models
				HF.env.useBrowserCache = true;
				HF.env.allowLocalModels = false;

				// Configure WASM paths
				if (HF.env.backends?.onnx?.wasm) {
					const wasmPath =
						typeof chrome !== "undefined" && chrome.runtime?.getURL
							? chrome.runtime.getURL("vendors/transformers/")
							: "../../../vendors/transformers/";
					HF.env.backends.onnx.wasm.wasmPaths = wasmPath;
					HF.env.backends.onnx.wasm.proxy = false;
					console.log("[embedding-runner] configured wasmPaths", wasmPath);
				}

				console.log("[embedding-runner] cache and env configured", {
					useBrowserCache: HF.env.useBrowserCache,
					allowLocalModels: HF.env.allowLocalModels,
					duration: formatMs(nowMs() - configStartedAt),
				});
			}
		} catch {}
	}
	if (!hfPipeline || (modelName && modelName !== embeddingModel)) {
		embeddingModel = modelName || embeddingModel;
		const hasWebGPU =
			typeof navigator !== "undefined" && typeof navigator.gpu !== "undefined";
		const pipelineStartedAt = nowMs();
		const device = hasWebGPU ? "webgpu" : "wasm";
		const progress_callback = createProgressLogger(
			{ model: embeddingModel },
			notifyProgress,
		);
		console.log("[embedding-runner] creating pipeline", {
			embeddingModel,
			device,
		});
		hfPipeline = await HF.pipeline("feature-extraction", embeddingModel, {
			device,
			// dtype: "fp32",
			progress_callback,
		});
		console.log("[embedding-runner] ensureTransformers: pipeline created", {
			embeddingModel,
			device,
			duration: formatMs(nowMs() - pipelineStartedAt),
		});
		// Warmup
		try {
			const warmupStartedAt = nowMs();
			console.log("[embedding-runner] ensureTransformers: warmup start", {
				embeddingModel,
			});
			await hfPipeline(["test"], { pooling: "mean", normalize: true });
			console.log("[embedding-runner] ensureTransformers: warmup done", {
				embeddingModel,
				duration: formatMs(nowMs() - warmupStartedAt),
			});
		} catch {}
	}
	console.log("[embedding-runner] ensureTransformers done", {
		embeddingModel,
		hasPipeline: !!hfPipeline,
		duration: formatMs(nowMs() - startedAt),
	});
}

window.addEventListener("message", async (event) => {
	const src = event.source;
	const origin = event.origin;
	const { messageId, type, payload } = event.data || {};
	const fromParent = src === window.parent;
	const fromOpener = typeof window.opener !== "undefined" && src === window.opener;

	console.log("[embedding-runner] received message", {
		messageId,
		type,
		origin,
		hasSource: !!src,
		fromParent,
		fromOpener,
		payloadType: payload ? typeof payload : "undefined",
	});

	if (type === "init") {
		console.log("[embedding-runner] received init", {
			messageId,
			origin,
			payload,
			hasSource: !!src,
		});
	}

	try {
		switch (type) {
			case "init": {
				const requestedModel = payload?.modelName || embeddingModel;
				const notifyProgress = (info) => {
					try {
						reply(src, origin, messageId, "progress", info);
					} catch {}
				};
				await ensureTransformers(requestedModel, notifyProgress);
				console.log("[embedding-runner] init complete, replying", {
					messageId,
					origin,
					model: requestedModel,
				});
				console.log("[embedding-runner] reply(init) ->", {
					messageId,
					targetOrigin: origin,
					hasSource: !!src,
				});
				reply(src, origin, messageId, "complete", {
					status: "initialized",
					mode: "embedding",
					model: requestedModel,
				});
				break;
			}
			case "models": {
				const modelInfo = {
					object: "list",
					data: [
						{
							id: embeddingModel,
							name: embeddingModel,
							loaded: !!hfPipeline,
							object: "model",
							created: Date.now(),
							owned_by: "local",
						},
					],
				};
				console.log("[embedding-runner] reply(models) ->", {
					messageId,
					targetOrigin: origin,
					hasSource: !!src,
				});
				reply(src, origin, messageId, "complete", modelInfo);
				break;
			}
			case "embeddings": {
				const { input, model } = payload || {};
				if (!input) throw new Error("input is required");
				await ensureTransformers(model || embeddingModel);
				const texts = Array.isArray(input) ? input : [input];
				const processed = texts.map((t) =>
					typeof t === "string" ? t.replace(/\n/g, " ") : String(t),
				);
				const result = await hfPipeline(processed, {
					pooling: "mean",
					normalize: true,
				});
				const list =
					typeof result.tolist === "function" ? result.tolist() : result;
				const response = {
					object: "list",
					data: list.map((vec, idx) => ({
						object: "embedding",
						embedding: vec,
						index: idx,
					})),
					model: model || embeddingModel,
					usage: { prompt_tokens: -1, total_tokens: -1 },
				};
				console.log("[embedding-runner] reply(embeddings) ->", {
					messageId,
					targetOrigin: origin,
					hasSource: !!src,
					count: Array.isArray(processed) ? processed.length : 1,
				});
				reply(src, origin, messageId, "complete", response);
				break;
			}
			default:
				throw new Error(`Unknown message type: ${type}`);
		}
	} catch (err) {
		console.error("[embedding-runner] error handling message", {
			messageId,
			type,
			origin,
			err,
		});
		reply(src, origin, messageId, "error", {
			error: {
				message: (err && err.message) || "Unknown error",
				type: "invalid_request_error",
				code: null,
			},
		});
	}
});

const endpoints = ["init", "models", "embeddings"];
sendReady("embedding", endpoints);
