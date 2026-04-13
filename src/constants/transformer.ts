// Latest WebGPU-compatible transformer models
// Focus on: Granite, Gemma 4, LFM2.5 Thinking, LFM2 MoE, MiniThinky, SmolLM3, Qwen3

export const RECOMMENDATION_TRANSFORMER_MODELS: string[] = [
	// Granite 4.0 Micro - IBM browser-tuned WebGPU demo
	"onnx-community/granite-4.0-micro-ONNX-web",

	// Gemma 4 - Google multimodal/browser demo model
	"onnx-community/gemma-4-E2B-it-ONNX",

	// LFM2.5 Thinking - Liquid AI reasoning model
	"LiquidAI/LFM2.5-1.2B-Thinking-ONNX",

	// LFM2 MoE - Liquid AI browser demo models
	"LiquidAI/LFM2-8B-A1B-ONNX",
	"LiquidAI/LFM2-24B-A2B-ONNX",

	// Ministral 3B - Mistral AI's latest model (December 2025)
	"mistralai/Ministral-3-3B-Instruct-2512-ONNX",

	// SmolLM3 - HuggingFace's latest efficient model (July 2025)
	"HuggingFaceTB/SmolLM3-3B-ONNX",

	// DeepSeek-R1 - Reasoning specialist (January 2025)
	"onnx-community/DeepSeek-R1-Distill-Qwen-1.5B-ONNX",

	// Qwen 3 - Latest MoE architecture (April 2025)
	"onnx-community/Qwen3-0.6B-ONNX",

	// Gemma 3 models - Google's latest open models (March 2025)
	// DISABLED: gemma-3-1b-it-ONNX is not reliable in the bundled browser runtime.
	// Use another transformer model or a Wllama GGUF Gemma variant instead.
	// DISABLED: gemma-3-270m-it currently fails tokenizer metadata loading in the bundled browser runtime.
	// Use the Wllama Gemma GGUF variant instead.

	// Phi 4 - Microsoft's latest reasoning model
	"onnx-community/Phi-4-mini-instruct-ONNX-GQA",

	// LFM2 models - Liquid AI's efficient foundation models
	"onnx-community/LFM2-350M-ONNX",
	"onnx-community/LFM2-700M-ONNX",
	"onnx-community/LFM2-1.2B-ONNX",
	"LiquidAI/LFM2.5-1.2B-Instruct-ONNX",

	// SmolLM2 - Compact models (older generation)
	"onnx-community/SmolLM2-135M-Instruct",
	"onnx-community/SmolLM2-360M-Instruct",
	"onnx-community/SmolLM2-1.7B-Instruct",

	// Qwen2.5 - Multilingual models (older generation)
	"onnx-community/Qwen2.5-0.5B-Instruct",
	"onnx-community/Qwen2.5-1.5B-Instruct",
];

// Quick download recommended models (latest only)
export const QUICK_TRANSFORMER_MODELS = [
	// === GEMMA 4 / GRANITE / LFM2.5 / LFM2 MOE / MINITHINKY ===
	{
		model: "onnx-community/granite-4.0-micro-ONNX-web",
		size: "2.3GB",
		description: "🪨 Granite 4.0 Micro: IBM browser-tuned WebGPU model",
	},
	{
		model: "onnx-community/gemma-4-E2B-it-ONNX",
		size: "4.8GB",
		description: "💠 Gemma 4 E2B: Multimodal q4f16 WebGPU model",
	},
	{
		model: "LiquidAI/LFM2.5-1.2B-Thinking-ONNX",
		size: "854MB",
		description: "🌊 LFM2.5 Thinking: Reasoning-focused q4 WebGPU model",
	},
	{
		model: "LiquidAI/LFM2-8B-A1B-ONNX",
		size: "4.8GB",
		description: "🌊 LFM2 8B-A1B: Mixture-of-experts q4f16 WebGPU model",
	},
	{
		model: "LiquidAI/LFM2-24B-A2B-ONNX",
		size: "13.5GB",
		description: "🌊 LFM2 24B-A2B: Large mixture-of-experts q4f16 WebGPU model",
	},

	// === MINISTRAL 3B (December 2025) ===
	// Transformer not yet supported
	// {
	// 	model: "mistralai/Ministral-3-3B-Instruct-2512-ONNX",
	// 	size: "1.5GB",
	// 	description: "✨ Ministral 3B: Latest from Mistral, 256K context (WebGPU)",
	// },

	// === SMOLLM3 (July 2025) ===
	{
		model: "HuggingFaceTB/SmolLM3-3B-ONNX",
		size: "1.8GB",
		description: "🐭 SmolLM3 3B: Dual-mode reasoning, 128K context (WebGPU)",
	},

	// === DEEPSEEK-R1 (January 2025) ===
	{
		model: "onnx-community/DeepSeek-R1-Distill-Qwen-1.5B-ONNX",
		size: "1.5GB",
		description: "🧠 DeepSeek-R1: Reasoning specialist, 128K context (WebGPU)",
	},

	// === GEMMA 3 (March 2025) ===
	// DISABLED: gemma-3-1b-it-ONNX is not reliable in the bundled browser runtime.
	// Use another transformer model or a Wllama GGUF Gemma variant instead.
	// DISABLED: gemma-3-270m-it currently fails tokenizer metadata loading in the bundled browser runtime.
	// Use the Wllama Gemma GGUF variant instead.

	// === QWEN 3 (April 2025) ===
	{
		model: "onnx-community/Qwen3-0.6B-ONNX",
		size: "400MB",
		description: "🌐 Qwen 3 0.6B: Smallest, fastest, 32K context (WebGPU)",
	},

	// === LFM2 MODELS (November 2024) ===
	{
		model: "onnx-community/LFM2-350M-ONNX",
		size: "200MB",
		description: "🌊 LFM2: Ultra-compact language model (WebGPU)",
	},
	{
		model: "onnx-community/LFM2-700M-ONNX",
		size: "410MB",
		description: "🌊 LFM2: Balanced performance model (WebGPU)",
	},
	{
		model: "onnx-community/LFM2-1.2B-ONNX",
		size: "709MB",
		description: "🌊 LFM2: High-quality model (WebGPU)",
	},
	{
		model: "LiquidAI/LFM2.5-1.2B-Instruct-ONNX",
		size: "900MB",
		description: "🌊 LFM2: specialist (WebGPU)",
	},

	// === PHI 4 MODELS ===
	{
		model: "onnx-community/Phi-4-mini-instruct-ONNX-GQA",
		size: "3.1GB",
		description: "🔬 Phi 4: ONNX GQA WebGPU build for browser inference",
	},

	// === SMOLLM2 ===
	{
		model: "onnx-community/SmolLM2-360M-Instruct",
		size: "230MB",
		description: "🐭 SmolLM2: Efficient edge model (WebGPU)",
	},

	// === QWEN 2.5 ===
	{
		model: "onnx-community/Qwen2.5-0.5B-Instruct",
		size: "320MB",
		description: "🌐 Qwen2.5: Multilingual compact model (WebGPU)",
	},
];
