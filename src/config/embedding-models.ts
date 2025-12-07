/**
 * Embedding Model Configuration
 * Defines available embedding sizes and their corresponding models
 */

export type EmbeddingSize = "small" | "medium" | "large";

export interface EmbeddingModelConfig {
	/** Model identifier (for local models) or null for remote-only */
	modelId: string | null;
	/** Display name for UI */
	displayName: string;
	/** Vector dimensions */
	dimensions: number;
	/** Description of capabilities */
	description: string;
	/** Supported languages */
	languageSupport: string;
	/** Whether this requires remote API (OpenAI, etc.) */
	requiresRemote: boolean;
}

/**
 * Model registry for each embedding size
 * - small/medium: Local models
 * - large: Remote API (OpenAI, etc.)
 */
export const EMBEDDING_MODELS: Record<EmbeddingSize, EmbeddingModelConfig> = {
	small: {
		modelId: "Xenova/paraphrase-multilingual-MiniLM-L12-v2",
		displayName: "Small (384d)",
		dimensions: 384,
		description: "Fast, efficient, good multilingual support",
		languageSupport: "50+ languages",
		requiresRemote: false,
	},
	medium: {
		modelId: "nomic-ai/nomic-embed-text-v1.5",
		displayName: "Medium (768d)",
		dimensions: 768,
		description: "Balanced performance (current default)",
		languageSupport: "English + limited multilingual",
		requiresRemote: false,
	},
	large: {
		modelId: null, // Uses remote API (OpenAI, etc.)
		displayName: "Large (1536d)",
		dimensions: 1536,
		description: "Highest quality via remote API (OpenAI, etc.)",
		languageSupport: "Multilingual (depends on API)",
		requiresRemote: true,
	},
};

/**
 * Default embedding size for new installations
 */
export const DEFAULT_EMBEDDING_SIZE: EmbeddingSize = "small";

/**
 * Get model configuration for a given size
 */
export function getModelConfig(size: EmbeddingSize): EmbeddingModelConfig {
	return EMBEDDING_MODELS[size];
}

/**
 * Get dimensions for a given size
 */
export function getDimensions(size: EmbeddingSize): number {
	return EMBEDDING_MODELS[size].dimensions;
}

/**
 * Get model ID for a given size (null for remote-only)
 */
export function getModelId(size: EmbeddingSize): string | null {
	return EMBEDDING_MODELS[size].modelId;
}

/**
 * Check if size requires remote API
 */
export function requiresRemoteAPI(size: EmbeddingSize): boolean {
	return EMBEDDING_MODELS[size].requiresRemote;
}

/**
 * Get all available embedding sizes
 */
export function getAvailableSizes(): EmbeddingSize[] {
	return Object.keys(EMBEDDING_MODELS) as EmbeddingSize[];
}

/**
 * Validate if a string is a valid embedding size
 */
export function isValidEmbeddingSize(size: string): size is EmbeddingSize {
	return size in EMBEDDING_MODELS;
}

/**
 * Get field name for a given embedding size in database
 * @param baseFieldName - Base field name (e.g., "embedding", "nameEmbedding", "factEmbedding")
 * @param size - Embedding size
 * @returns Database field name (e.g., "embedding" for medium, "embeddingSmall" for small)
 */
export function getEmbeddingFieldName(
	baseFieldName: string,
	size: EmbeddingSize,
): string {
	switch (size) {
		case "small":
			return `${baseFieldName}Small`;
		case "medium":
			return baseFieldName; // Default/current field (backward compatible)
		case "large":
			return `${baseFieldName}Large`;
	}
}
