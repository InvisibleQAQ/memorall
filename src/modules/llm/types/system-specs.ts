/**
 * System specifications detected from the user's device
 */
export interface SystemSpecs {
	/** Total RAM in GB (approximate) */
	memoryGB: number;
	/** Number of logical CPU cores */
	cpuCores: number;
	/** Whether WebGPU is available */
	hasWebGPU: boolean;
	/** GPU information if available */
	gpu?: {
		vendor: string;
		renderer: string;
		/** Estimated VRAM in GB (if detectable) */
		estimatedVRAM?: number;
	};
	/** Device category based on specs */
	deviceCategory: "low" | "medium" | "high" | "ultra";
}

/**
 * User's preference for model selection
 */
export type ModelPreference = "performance" | "quality" | "context";

/**
 * Model recommendation with performance estimates
 */
export interface ModelRecommendation {
	/** Provider that hosts this model */
	provider: "transformer" | "wllama" | "webllm" | "lmstudio" | "ollama";
	/** Provider display name */
	providerName: string;
	/** Model identifier */
	modelId: string;
	/** Display name for the model */
	displayName: string;
	/** Model size in human-readable format */
	size: string;
	/** Model size in GB for calculations */
	sizeGB: number;
	/** Estimated tokens per second on user's device */
	estimatedTokensPerSecond: number;
	/** Maximum context length */
	contextLength: number;
	/** Why this model was recommended */
	reason: string;
	/** Model release date (for showing recency) */
	releaseDate: string;
	/** Whether this uses WebGPU acceleration */
	usesWebGPU: boolean;
	/** Model configuration for download */
	config: ModelConfig;
}

/**
 * Configuration needed to download/load a model
 */
export type ModelConfig =
	| {
			provider: "transformer";
			model: string;
	  }
	| {
			provider: "wllama";
			repo: string;
			filename: string;
	  }
	| {
			provider: "webllm";
			model: string;
	  }
	| {
			provider: "lmstudio" | "ollama";
			modelId: string;
	  };

/**
 * Recommendation set for all three preferences
 * Each preference includes a primary recommendation and alternatives
 */
export interface RecommendationSet {
	performance: {
		primary: ModelRecommendation;
		alternatives: ModelRecommendation[];
	};
	quality: {
		primary: ModelRecommendation;
		alternatives: ModelRecommendation[];
	};
	context: {
		primary: ModelRecommendation;
		alternatives: ModelRecommendation[];
	};
}
