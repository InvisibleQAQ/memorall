// Latest WebGPU-compatible transformer models
// Focus on: LFM2, Gemma 3, Phi 4

export const RECOMMENDATION_TRANSFORMER_MODELS: string[] = [
	// LFM2 models - Liquid AI's latest efficient foundation models
	"onnx-community/LFM2-350M-ONNX",
	"onnx-community/LFM2-700M-ONNX",
	"onnx-community/LFM2-1.2B-ONNX",
	"onnx-community/LFM2-1.2B-Tool-ONNX",

	// Gemma 3 models - Google's latest open models
	"onnx-community/gemma-3-1b-it",
	"onnx-community/gemma-3-270m-it",

	// Phi 4 models - Microsoft's latest efficient models
	"onnx-community/Phi-4-mini-instruct",

	// SmolLM2 - Latest compact models
	"onnx-community/SmolLM2-135M-Instruct",
	"onnx-community/SmolLM2-360M-Instruct",
	"onnx-community/SmolLM2-1.7B-Instruct",

	// Qwen2.5 - Latest multilingual models
	"onnx-community/Qwen2.5-0.5B-Instruct",
	"onnx-community/Qwen2.5-1.5B-Instruct",
];

// Quick download recommended models (latest only)
export const QUICK_TRANSFORMER_MODELS = [
	// LFM2 Models - Best for on-device efficiency
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

	// Gemma 3 Models - Latest from Google
	{
		model: "onnx-community/gemma-3-270m-it",
		size: "180MB",
		description: "💎 Gemma 3: Ultra-compact chat model (WebGPU)",
	},
	{
		model: "onnx-community/gemma-3-1b-it",
		size: "650MB",
		description: "💎 Gemma 3: Latest Google chat model (WebGPU)",
	},

	// Phi 4 Models - Latest from Microsoft
	{
		model: "onnx-community/Phi-4-mini-instruct",
		size: "2.4GB",
		description: "🔬 Phi 4: Latest reasoning model (WebGPU)",
	},

	// SmolLM2 - For edge devices
	{
		model: "onnx-community/SmolLM2-360M-Instruct",
		size: "230MB",
		description: "🐭 SmolLM2: Efficient edge model (WebGPU)",
	},

	// Qwen2.5 - Multilingual
	{
		model: "onnx-community/Qwen2.5-0.5B-Instruct",
		size: "320MB",
		description: "🌐 Qwen2.5: Multilingual compact model (WebGPU)",
	},
];
