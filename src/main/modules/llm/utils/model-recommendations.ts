import type {
	SystemSpecs,
	ModelRecommendation,
	RecommendationSet,
	ModelPreference,
} from "../types/system-specs";

/**
 * Model database with specifications
 * Updated: December 2025 with latest models
 */
interface ModelSpec {
	provider: "transformer" | "wllama" | "webllm";
	modelId: string;
	displayName: string;
	providerName: string;
	size: string;
	sizeGB: number;
	contextLength: number;
	requiresWebGPU: boolean;
	minMemoryGB: number;
	/** Release date (YYYY-MM format) */
	releaseDate: string;
	/** Base performance score (0-100) - considers size and speed */
	performanceScore: number;
	/** Quality score (0-100) - considers capabilities and model architecture */
	qualityScore: number;
	/** Context score based on context length (0-100) */
	contextScore: number;
	config: ModelRecommendation["config"];
}

/**
 * Provider metadata
 */
const PROVIDER_INFO = {
	transformer: {
		name: "Transformer (WebGPU)",
		requiresWebGPU: true,
		speedMultiplier: 1.4,
		note: "ONNX models with WebGPU acceleration",
	},
	webllm: {
		name: "WebLLM (MLC)",
		requiresWebGPU: true,
		speedMultiplier: 1.5, // Optimized MLC models
		note: "Highly optimized WebGPU models",
	},
	wllama: {
		name: "Wllama (GGUF)",
		requiresWebGPU: false,
		speedMultiplier: 1.0, // CPU-based
		note: "CPU-based, works everywhere",
	},
};

/**
 * Model database organized by release date and capabilities
 *
 * Latest models: Ministral 3B (Dec 2025) > SmolLM3 (Jul 2025) > Qwen 3 (Apr 2025) > Gemma 3 (Mar 2025)
 *
 * Provider availability verified from:
 * - WebLLM: github.com/mlc-ai/web-llm/blob/main/src/config.ts
 * - Transformers.js: huggingface.co ONNX models with WebGPU support
 * - Wllama: llama.cpp compatible GGUF models
 *
 * Performance benchmarks (Browser WebGPU - realistic):
 * - High-end GPU (RTX 4090): 15-25 tok/s for 1-3B models
 * - Mid-range GPU (RTX 4060): 8-15 tok/s for 1-3B models
 * - Integrated GPU (Iris Xe): 3-8 tok/s for 1-3B models
 * - CPU (WASM): 1-5 tok/s for 1-3B models
 * - Ministral 3B: 256K context, vision-capable
 * - SmolLM3 3B: 128K context, dual reasoning, beats Qwen2.5-3B
 * - Phi-3.5 Mini: 128K context, excellent quality
 * - Qwen 3 0.6B: Smallest, fastest (0.6B params, 32K context)
 * - DeepSeek-R1 1.5B: Reasoning model with 128K context
 */
const MODEL_DATABASE: ModelSpec[] = [
	// === MINISTRAL 3B (Released December 2025, Latest from Mistral AI) ===
	// Vision-language model, 256K context, sub-10s load

	// Transformer not yet supported
	// {
	// 	provider: "transformer",
	// 	providerName: PROVIDER_INFO.transformer.name,
	// 	modelId: "mistralai/Ministral-3-3B-Instruct-2512-ONNX",
	// 	displayName: "Ministral 3B",
	// 	size: "1.5GB",
	// 	sizeGB: 1.5,
	// 	contextLength: 256000, // 256K context!
	// 	requiresWebGPU: true,
	// 	minMemoryGB: 4,
	// 	releaseDate: "2025-12",
	// 	performanceScore: 85, // Fast, vision-capable
	// 	qualityScore: 90, // Excellent quality, latest from Mistral
	// 	contextScore: 100, // 256K context is massive
	// 	config: {
	// 		provider: "transformer",
	// 		model: "mistralai/Ministral-3-3B-Instruct-2512-ONNX",
	// 	},
	// },

	// === LFM2 MODELS (Released November 2024, Liquid AI) ===
	// 2x faster than Qwen3 on CPU, now available in Transformers.js with WebGPU!

	// Transformers.js - LFM2 350M (Smallest, fastest)
	{
		provider: "transformer",
		providerName: PROVIDER_INFO.transformer.name,
		modelId: "onnx-community/LFM2-350M-ONNX",
		displayName: "LFM2 350M",
		size: "230MB",
		sizeGB: 0.23,
		contextLength: 8192,
		requiresWebGPU: true,
		minMemoryGB: 2,
		releaseDate: "2024-11",
		performanceScore: 98, // Smallest, fastest WebGPU model
		qualityScore: 40,
		contextScore: 60,
		config: {
			provider: "transformer",
			model: "onnx-community/LFM2-350M-ONNX",
		},
	},

	// Transformers.js - LFM2 700M
	{
		provider: "transformer",
		providerName: PROVIDER_INFO.transformer.name,
		modelId: "onnx-community/LFM2-700M-ONNX",
		displayName: "LFM2 700M",
		size: "450MB",
		sizeGB: 0.45,
		contextLength: 8192,
		requiresWebGPU: true,
		minMemoryGB: 3,
		releaseDate: "2024-11",
		performanceScore: 90,
		qualityScore: 60,
		contextScore: 60,
		config: {
			provider: "transformer",
			model: "onnx-community/LFM2-700M-ONNX",
		},
	},

	// Transformers.js - LFM2 1.2B
	{
		provider: "transformer",
		providerName: PROVIDER_INFO.transformer.name,
		modelId: "onnx-community/LFM2-1.2B-ONNX",
		displayName: "LFM2 1.2B",
		size: "780MB",
		sizeGB: 0.78,
		contextLength: 8192,
		requiresWebGPU: true,
		minMemoryGB: 4,
		releaseDate: "2024-11",
		performanceScore: 80,
		qualityScore: 75,
		contextScore: 60,
		config: {
			provider: "transformer",
			model: "onnx-community/LFM2-1.2B-ONNX",
		},
	},

	// === GEMMA 3 MODELS (Released March 2025, Google) ===
	// Text-only models optimized for on-device use
	// Note: WebGPU browser support is in progress, Node.js/Deno/Bun work

	// Transformers.js - Gemma 3 1B
	{
		provider: "transformer",
		providerName: PROVIDER_INFO.transformer.name,
		modelId: "onnx-community/gemma-3-1b-it-ONNX",
		displayName: "Gemma 3 1B",
		size: "500MB",
		sizeGB: 0.5,
		contextLength: 32768, // 32K context
		requiresWebGPU: true,
		minMemoryGB: 3,
		releaseDate: "2025-03",
		performanceScore: 88, // Fast, lightweight
		qualityScore: 78, // Google's latest small model
		contextScore: 85, // 32K context
		config: {
			provider: "transformer",
			model: "onnx-community/gemma-3-1b-it-ONNX",
		},
	},

	// === QWEN 3 MODELS (Released April 2025) ===
	// MoE architecture, 40% better than Qwen 2.5

	// Transformers.js - Qwen 3 0.6B (Smallest, fastest)
	{
		provider: "transformer",
		providerName: PROVIDER_INFO.transformer.name,
		modelId: "onnx-community/Qwen3-0.6B-ONNX",
		displayName: "Qwen 3 0.6B",
		size: "400MB",
		sizeGB: 0.4,
		contextLength: 32768, // 32K context
		requiresWebGPU: true,
		minMemoryGB: 2,
		releaseDate: "2025-04",
		performanceScore: 92, // Very small and fast
		qualityScore: 70,
		contextScore: 85, // 32K context
		config: {
			provider: "transformer",
			model: "onnx-community/Qwen3-0.6B-ONNX",
		},
	},

	// WebLLM - Qwen 3 0.6B (MLC optimized, smallest Qwen 3)
	{
		provider: "webllm",
		providerName: PROVIDER_INFO.webllm.name,
		modelId: "Qwen3-0.6B-q4f16_1-MLC",
		displayName: "Qwen 3 0.6B",
		size: "400MB",
		sizeGB: 0.4,
		contextLength: 32768,
		requiresWebGPU: true,
		minMemoryGB: 2,
		releaseDate: "2025-04",
		performanceScore: 95,
		qualityScore: 70,
		contextScore: 85,
		config: {
			provider: "webllm",
			model: "Qwen3-0.6B-q4f16_1-MLC",
		},
	},

	// WebLLM - Qwen 3 (MoE architecture, 40% better than Qwen 2.5)
	{
		provider: "webllm",
		providerName: PROVIDER_INFO.webllm.name,
		modelId: "Qwen3-1.7B-q4f16_1-MLC",
		displayName: "Qwen 3 1.7B",
		size: "1.2GB",
		sizeGB: 1.2,
		contextLength: 128000, // 128K context
		requiresWebGPU: true,
		minMemoryGB: 4,
		releaseDate: "2025-04",
		performanceScore: 75,
		qualityScore: 85, // MoE architecture, better quality
		contextScore: 98, // Excellent 128K context
		config: {
			provider: "webllm",
			model: "Qwen3-1.7B-q4f16_1-MLC",
		},
	},

	// Wllama - Qwen 3 GGUF
	{
		provider: "wllama",
		providerName: PROVIDER_INFO.wllama.name,
		modelId: "ggml-org/Qwen3-1.7B-GGUF",
		displayName: "Qwen 3 1.7B",
		size: "1.1GB",
		sizeGB: 1.1,
		contextLength: 128000,
		requiresWebGPU: false,
		minMemoryGB: 4,
		releaseDate: "2025-04",
		performanceScore: 60, // CPU-based, slower
		qualityScore: 85,
		contextScore: 98,
		config: {
			provider: "wllama",
			repo: "ggml-org/Qwen3-1.7B-GGUF",
			filename: "Qwen3-1.7B-Q4_K_M.gguf",
		},
	},

	// === DEEPSEEK-R1-DISTILL MODELS (Released January 2025) ===

	// WebLLM - DeepSeek-R1-Distill-Qwen-7B
	{
		provider: "webllm",
		providerName: PROVIDER_INFO.webllm.name,
		modelId: "DeepSeek-R1-Distill-Qwen-7B-q4f16_1-MLC",
		displayName: "DeepSeek-R1 Qwen 7B",
		size: "3.5GB",
		sizeGB: 3.5,
		contextLength: 4096,
		requiresWebGPU: true,
		minMemoryGB: 6,
		releaseDate: "2025-01",
		performanceScore: 65,
		qualityScore: 90, // Distilled from R1, excellent reasoning
		contextScore: 50,
		config: {
			provider: "webllm",
			model: "DeepSeek-R1-Distill-Qwen-7B-q4f16_1-MLC",
		},
	},

	// Transformers.js - DeepSeek-R1-Distill-Qwen-1.5B
	// This is available and optimized for browser inference
	// 128K context, 83.9% on MATH-500, 28.9% on AIME 2024
	{
		provider: "transformer",
		providerName: PROVIDER_INFO.transformer.name,
		modelId: "onnx-community/DeepSeek-R1-Distill-Qwen-1.5B-ONNX",
		displayName: "DeepSeek-R1 Qwen 1.5B",
		size: "1.5GB",
		sizeGB: 1.5,
		contextLength: 128000, // FIXED: 128K context (was 4096)
		requiresWebGPU: true,
		minMemoryGB: 4,
		releaseDate: "2025-01",
		performanceScore: 80,
		qualityScore: 85, // Strong reasoning: 83.9% MATH-500, 28.9% AIME
		contextScore: 98, // 128K context
		config: {
			provider: "transformer",
			model: "onnx-community/DeepSeek-R1-Distill-Qwen-1.5B-ONNX",
		},
	},

	// Wllama - DeepSeek-R1-Distill GGUF
	{
		provider: "wllama",
		providerName: PROVIDER_INFO.wllama.name,
		modelId: "unsloth/DeepSeek-R1-Distill-Qwen-1.5B-GGUF",
		displayName: "DeepSeek-R1 Qwen 1.5B",
		size: "1.0GB",
		sizeGB: 1.0,
		contextLength: 128000, // FIXED: 128K context (was 4096)
		requiresWebGPU: false,
		minMemoryGB: 3,
		releaseDate: "2025-01",
		performanceScore: 65,
		qualityScore: 85,
		contextScore: 98, // 128K context
		config: {
			provider: "wllama",
			repo: "unsloth/DeepSeek-R1-Distill-Qwen-1.5B-GGUF",
			filename: "DeepSeek-R1-Distill-Qwen-1.5B-Q4_K_M.gguf",
		},
	},

	// === SMOLLM3 MODELS (Released July 2025, HuggingFace) ===
	// 128K context, dual-mode reasoning, 6 languages, trained on 11.2T tokens

	// Transformers.js - SmolLM3 3B (Latest, WebGPU optimized)
	{
		provider: "transformer",
		providerName: PROVIDER_INFO.transformer.name,
		modelId: "HuggingFaceTB/SmolLM3-3B-ONNX",
		displayName: "SmolLM3 3B",
		size: "1.8GB",
		sizeGB: 1.8,
		contextLength: 128000, // 128K context!
		requiresWebGPU: true,
		minMemoryGB: 5,
		releaseDate: "2025-07",
		performanceScore: 82, // Fast with dual-mode reasoning
		qualityScore: 88, // Beats Qwen2.5-3B, matches 4B models
		contextScore: 98, // 128K context
		config: {
			provider: "transformer",
			model: "HuggingFaceTB/SmolLM3-3B-ONNX",
		},
	},

	// === LFM2 MODELS (Liquid AI, Late 2024) ===
	// Available ONLY in Wllama (llama.cpp), NOT in WebLLM or Transformer
	// 2x faster than Qwen3 on CPU

	{
		provider: "wllama",
		providerName: PROVIDER_INFO.wllama.name,
		modelId: "LiquidAI/LFM2-VL-450M-GGUF",
		displayName: "LFM2 VL 450M",
		size: "263MB",
		sizeGB: 0.26,
		contextLength: 8192,
		requiresWebGPU: false,
		minMemoryGB: 2,
		releaseDate: "2024-11",
		performanceScore: 75, // 2x faster than Qwen3 on CPU
		qualityScore: 45,
		contextScore: 60,
		config: {
			provider: "wllama",
			repo: "LiquidAI/LFM2-VL-450M-GGUF",
			filename: "LFM2-VL-450M-Q4_0.gguf",
		},
	},

	{
		provider: "wllama",
		providerName: PROVIDER_INFO.wllama.name,
		modelId: "LiquidAI/LFM2-700M-GGUF",
		displayName: "LFM2 700M",
		size: "410MB",
		sizeGB: 0.41,
		contextLength: 8192,
		requiresWebGPU: false,
		minMemoryGB: 3,
		releaseDate: "2024-11",
		performanceScore: 70,
		qualityScore: 60,
		contextScore: 60,
		config: {
			provider: "wllama",
			repo: "LiquidAI/LFM2-700M-GGUF",
			filename: "LFM2-700M-Q4_0.gguf",
		},
	},

	{
		provider: "wllama",
		providerName: PROVIDER_INFO.wllama.name,
		modelId: "LiquidAI/LFM2-1.2B-GGUF",
		displayName: "LFM2 1.2B",
		size: "709MB",
		sizeGB: 0.71,
		contextLength: 8192,
		requiresWebGPU: false,
		minMemoryGB: 4,
		releaseDate: "2024-11",
		performanceScore: 65,
		qualityScore: 75,
		contextScore: 60,
		config: {
			provider: "wllama",
			repo: "LiquidAI/LFM2-1.2B-GGUF",
			filename: "LFM2-1.2B-Q4_0.gguf",
		},
	},

	// === PHI-3.5-MINI (Released August 2024, Microsoft) ===
	// 3.8B params, 128K context

	{
		provider: "webllm",
		providerName: PROVIDER_INFO.webllm.name,
		modelId: "Phi-3.5-mini-instruct-q4f16_1-MLC",
		displayName: "Phi-3.5 Mini 3.8B",
		size: "2GB",
		sizeGB: 2.0,
		contextLength: 128000, // 128K context
		requiresWebGPU: true,
		minMemoryGB: 5,
		releaseDate: "2024-08",
		performanceScore: 78,
		qualityScore: 88, // Excellent quality for size
		contextScore: 98, // 128K context
		config: {
			provider: "webllm",
			model: "Phi-3.5-mini-instruct-q4f16_1-MLC",
		},
	},

	// === LLAMA 3.2 MODELS (Meta, 2024) ===
	// Still competitive and widely available

	{
		provider: "webllm",
		providerName: PROVIDER_INFO.webllm.name,
		modelId: "Llama-3.2-1B-Instruct-q4f32_1-MLC",
		displayName: "Llama 3.2 1B",
		size: "0.8GB",
		sizeGB: 0.8,
		contextLength: 131072, // 128K context
		requiresWebGPU: true,
		minMemoryGB: 3,
		releaseDate: "2024-09",
		performanceScore: 85,
		qualityScore: 65,
		contextScore: 98,
		config: {
			provider: "webllm",
			model: "Llama-3.2-1B-Instruct-q4f32_1-MLC",
		},
	},

	{
		provider: "webllm",
		providerName: PROVIDER_INFO.webllm.name,
		modelId: "Llama-3.2-3B-Instruct-q4f32_1-MLC",
		displayName: "Llama 3.2 3B",
		size: "2GB",
		sizeGB: 2.0,
		contextLength: 131072,
		requiresWebGPU: true,
		minMemoryGB: 5,
		releaseDate: "2024-09",
		performanceScore: 70,
		qualityScore: 80,
		contextScore: 98,
		config: {
			provider: "webllm",
			model: "Llama-3.2-3B-Instruct-q4f32_1-MLC",
		},
	},

	// === GEMMA 2 2B (Released June 2024, Google) ===
	// Efficient 2B model, strong quality-to-size ratio
	{
		provider: "webllm",
		providerName: PROVIDER_INFO.webllm.name,
		modelId: "gemma-2-2b-it-q4f16_1-MLC",
		displayName: "Gemma 2 2B",
		size: "1.4GB",
		sizeGB: 1.4,
		contextLength: 8192,
		requiresWebGPU: true,
		minMemoryGB: 4,
		releaseDate: "2024-06",
		performanceScore: 76,
		qualityScore: 80,
		contextScore: 60,
		config: {
			provider: "webllm",
			model: "gemma-2-2b-it-q4f16_1-MLC",
		},
	},

	// === SMOLLM2 1.7B (Released November 2024, HuggingFace) ===
	// Compact, fast model from HuggingFace
	{
		provider: "webllm",
		providerName: PROVIDER_INFO.webllm.name,
		modelId: "SmolLM2-1.7B-Instruct-q4f16_1-MLC",
		displayName: "SmolLM2 1.7B",
		size: "1.1GB",
		sizeGB: 1.1,
		contextLength: 8192,
		requiresWebGPU: true,
		minMemoryGB: 4,
		releaseDate: "2024-11",
		performanceScore: 83,
		qualityScore: 68,
		contextScore: 60,
		config: {
			provider: "webllm",
			model: "SmolLM2-1.7B-Instruct-q4f16_1-MLC",
		},
	},

	// === QWEN 2.5 MODELS (Released September 2024, Qwen Team) ===
	// Predecessor to Qwen 3, strong performance with 128K context
	{
		provider: "webllm",
		providerName: PROVIDER_INFO.webllm.name,
		modelId: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
		displayName: "Qwen 2.5 1.5B",
		size: "1.0GB",
		sizeGB: 1.0,
		contextLength: 128000,
		requiresWebGPU: true,
		minMemoryGB: 3,
		releaseDate: "2024-09",
		performanceScore: 81,
		qualityScore: 75,
		contextScore: 98,
		config: {
			provider: "webllm",
			model: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
		},
	},

	// === QWEN 2.5 CODER (Released November 2024, Qwen Team) ===
	// Code-specialized Qwen 2.5 with 128K context
	{
		provider: "webllm",
		providerName: PROVIDER_INFO.webllm.name,
		modelId: "Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC",
		displayName: "Qwen 2.5 Coder 1.5B",
		size: "1.0GB",
		sizeGB: 1.0,
		contextLength: 128000,
		requiresWebGPU: true,
		minMemoryGB: 3,
		releaseDate: "2024-11",
		performanceScore: 79,
		qualityScore: 78,
		contextScore: 98,
		config: {
			provider: "webllm",
			model: "Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC",
		},
	},
];

/**
 * Generates model recommendations based on system specs and user preference
 * Returns top N models sorted by score
 */
export function generateRecommendations(
	specs: SystemSpecs,
	preference: ModelPreference,
	limit: number = 4,
): ModelRecommendation[] {
	// Filter models that can run on this device
	const compatibleModels = MODEL_DATABASE.filter((model) => {
		// WebGPU requirement check
		if (model.requiresWebGPU && !specs.hasWebGPU) {
			return false;
		}

		// Basic memory check: model requires more RAM than system has
		if (model.minMemoryGB > specs.memoryGB) {
			return false;
		}

		// Conservative memory check: model should use ≤30% of RAM for safety
		// This accounts for OS, browser, and other processes
		// Example: 8GB RAM → recommend models ≤2.4GB
		const maxRecommendedSize = specs.memoryGB * 0.3;
		if (model.sizeGB > maxRecommendedSize) {
			return false;
		}

		return true;
	});

	if (compatibleModels.length === 0) {
		return [];
	}

	// Score each model based on preference and device capability
	const scoredModels = compatibleModels.map((model) => {
		let score = 0;

		// Base score from preference (PRIMARY factor - should dominate)
		switch (preference) {
			case "performance":
				score = model.performanceScore * 2; // 2x multiplier for preference dominance
				break;
			case "quality":
				score = model.qualityScore * 2; // 2x multiplier for preference dominance
				break;
			case "context":
				score = model.contextScore * 2; // 2x multiplier for preference dominance
				break;
		}

		// Modest bonus for newer models (reduced from 1.5 to 0.8)
		const [year, month] = model.releaseDate.split("-").map(Number);
		const monthsSince2024 = (year - 2024) * 12 + month;
		score += monthsSince2024 * 0.8; // Up to +9.6 points for Dec 2025 models (was +18)

		// Bonus for WebGPU on capable devices (reduced from 15 to 10)
		if (specs.hasWebGPU && model.requiresWebGPU) {
			score += 10; // Preference for WebGPU
		}

		// Prefer WebLLM (most optimized) > Transformer > Wllama when WebGPU available
		if (specs.hasWebGPU) {
			if (model.provider === "webllm")
				score += 5; // Reduced from 8
			else if (model.provider === "transformer") score += 3; // Reduced from 5
		}

		// Device-specific adjustments
		if (specs.deviceCategory === "ultra" || specs.deviceCategory === "high") {
			// Prefer larger, higher quality models on powerful devices
			score += model.sizeGB > 1.0 ? 5 : 0; // Reduced from 10
		} else if (specs.deviceCategory === "low") {
			// Prefer smaller models on low-end devices
			score += model.sizeGB < 0.5 ? 8 : 0; // Reduced from 12
		}

		// Small bonuses for specific notable models (reduced to avoid overwhelming preference scores)
		if (model.displayName.includes("Ministral 3B")) {
			score += 6; // Reduced from 12
		}
		if (model.displayName.includes("SmolLM3")) {
			score += 5; // Reduced from 11
		}
		if (model.displayName.includes("LFM2")) {
			score += 4; // Reduced from 9
		}
		if (model.displayName.includes("Qwen 3")) {
			score += 5; // Reduced from 10
		}
		if (model.displayName.includes("Gemma 3")) {
			score += 4; // Reduced from 9
		}
		if (model.displayName.includes("DeepSeek-R1")) {
			score += 4; // Reduced from 8
		}
		if (model.displayName.includes("Phi-3.5")) {
			score += 3; // Reduced from 7
		}

		return { model, score };
	});

	// Sort by score and get top N matches
	scoredModels.sort((a, b) => b.score - a.score);
	const topMatches = scoredModels.slice(
		0,
		Math.min(limit, scoredModels.length),
	);

	// Convert to ModelRecommendation format
	return topMatches.map(({ model }) => {
		const estimatedTokensPerSecond = estimateTokensPerSecond(specs, model);
		const reason = generateReason(preference, specs, model);

		return {
			provider: model.provider,
			providerName: model.providerName,
			modelId: model.modelId,
			displayName: model.displayName,
			size: model.size,
			sizeGB: model.sizeGB,
			estimatedTokensPerSecond,
			contextLength: model.contextLength,
			reason,
			releaseDate: model.releaseDate,
			usesWebGPU: model.requiresWebGPU && specs.hasWebGPU,
			config: model.config,
		};
	});
}

/**
 * Generates all three recommendations (performance, quality, context)
 * Each preference gets a primary recommendation and ALL compatible alternatives
 */
export function generateAllRecommendations(
	specs: SystemSpecs,
): RecommendationSet | null {
	// Get ALL compatible models for each preference (limit: 50 should cover all models)
	const performanceList = generateRecommendations(specs, "performance", 50);
	const qualityList = generateRecommendations(specs, "quality", 50);
	const contextList = generateRecommendations(specs, "context", 50);

	if (
		performanceList.length === 0 ||
		qualityList.length === 0 ||
		contextList.length === 0
	) {
		return null;
	}

	return {
		performance: {
			primary: performanceList[0],
			alternatives: performanceList.slice(1),
		},
		quality: {
			primary: qualityList[0],
			alternatives: qualityList.slice(1),
		},
		context: {
			primary: contextList[0],
			alternatives: contextList.slice(1),
		},
	};
}

/**
 * Estimates tokens per second based on device specs and model
 * Updated with realistic browser-based LLM performance
 */
function estimateTokensPerSecond(specs: SystemSpecs, model: ModelSpec): number {
	// Base speeds based on realistic browser-based LLM inference
	// WebGPU with good GPU: 15-25 tok/s for 1-3B models
	// WebGPU with integrated: 5-10 tok/s
	// WASM (CPU only): 1-5 tok/s
	let baseSpeed = 0;

	switch (specs.deviceCategory) {
		case "ultra":
			// RTX 4090, RTX 4080, high-end AMD
			baseSpeed = model.requiresWebGPU ? 20 : 4;
			break;
		case "high":
			// RTX 3070, RTX 4060, mid-range GPUs
			baseSpeed = model.requiresWebGPU ? 12 : 3;
			break;
		case "medium":
			// Integrated GPUs, older discrete GPUs
			baseSpeed = model.requiresWebGPU ? 6 : 2;
			break;
		case "low":
			// Old hardware, CPU-only
			baseSpeed = model.requiresWebGPU ? 3 : 1;
			break;
	}

	// Model size penalty - larger models are slower
	// 0.5GB: 1.0x, 1.5GB: 0.85x, 3GB: 0.7x, 5GB: 0.55x
	const sizeMultiplier = Math.max(0.4, 1 - model.sizeGB * 0.1);

	// Provider-specific multipliers (WebLLM is most optimized)
	const providerMultiplier = PROVIDER_INFO[model.provider].speedMultiplier;

	// WebGPU check (already factored into baseSpeed, but keep for compatibility)
	const hasAcceleration = model.requiresWebGPU && specs.hasWebGPU;

	const finalSpeed = baseSpeed * sizeMultiplier * providerMultiplier;

	// Round to realistic values
	return Math.max(1, Math.round(finalSpeed));
}

/**
 * Generates a human-readable reason for the recommendation
 */
function generateReason(
	preference: ModelPreference,
	specs: SystemSpecs,
	model: ModelSpec,
): string {
	const deviceDesc =
		specs.deviceCategory === "ultra"
			? "high-end"
			: specs.deviceCategory === "high"
				? "powerful"
				: specs.deviceCategory === "medium"
					? "capable"
					: "modest";

	const gpuNote =
		model.requiresWebGPU && specs.hasWebGPU ? " with WebGPU acceleration" : "";

	const [year, month] = model.releaseDate.split("-");
	const monthName = new Date(`${year}-${month}-01`).toLocaleString("en", {
		month: "short",
		year: "numeric",
	});
	const releaseNote = ` Released ${monthName}.`;

	switch (preference) {
		case "performance":
			return `Fastest model for your ${deviceDesc} device${gpuNote}. Optimized for quick responses.${releaseNote}`;
		case "quality":
			return `Best quality model for your ${deviceDesc} device${gpuNote}. Excellent reasoning and accuracy.${releaseNote}`;
		case "context":
			return `Maximum context window (${model.contextLength.toLocaleString()} tokens) for handling long documents and conversations${gpuNote}.${releaseNote}`;
	}
}
