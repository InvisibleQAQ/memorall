// Latest WebGPU-compatible transformer models
// Focus on: Ministral, SmolLM3, DeepSeek-R1, Qwen3, Gemma 3

export const RECOMMENDATION_TRANSFORMER_MODELS: string[] = [
	// Ministral 3B - Mistral AI's latest model (December 2025)
	"mistralai/Ministral-3-3B-Instruct-2512-ONNX",

	// SmolLM3 - HuggingFace's latest efficient model (July 2025)
	"HuggingFaceTB/SmolLM3-3B-ONNX",

	// DeepSeek-R1 - Reasoning specialist (January 2025)
	"onnx-community/DeepSeek-R1-Distill-Qwen-1.5B-ONNX",

	// Qwen 3 - Latest MoE architecture (April 2025)
	"onnx-community/Qwen3-0.6B-ONNX",

	// Gemma 3 models - Google's latest open models (March 2025)
	"onnx-community/gemma-3-1b-it-ONNX",
	"onnx-community/gemma-3-270m-it",

	// Phi 4 - Microsoft's latest reasoning model
	"onnx-community/Phi-4-mini-instruct",

	// LFM2 models - Liquid AI's efficient foundation models
	"onnx-community/LFM2-350M-ONNX",
	"onnx-community/LFM2-700M-ONNX",
	"onnx-community/LFM2-1.2B-ONNX",
	"onnx-community/LFM2-1.2B-Tool-ONNX",

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
	// === MINISTRAL 3B (December 2025) ===
	{
		model: "mistralai/Ministral-3-3B-Instruct-2512-ONNX",
		size: "1.5GB",
		description: "✨ Ministral 3B: Latest from Mistral, 256K context (WebGPU)",
	},

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
	{
		model: "onnx-community/gemma-3-1b-it-ONNX",
		size: "500MB",
		description: "💎 Gemma 3 1B: Latest Google model, 32K context (WebGPU)",
	},
	{
		model: "onnx-community/gemma-3-270m-it",
		size: "180MB",
		description: "💎 Gemma 3: Ultra-compact chat model (WebGPU)",
	},

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
		model: "onnx-community/LFM2-1.2B-Tool-ONNX",
		size: "709MB",
		description: "🌊 LFM2: Tool-calling specialist (WebGPU)",
	},

	// === PHI 4 MODELS ===
	{
		model: "onnx-community/Phi-4-mini-instruct",
		size: "2.4GB",
		description: "🔬 Phi 4: Latest reasoning model (WebGPU)",
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
