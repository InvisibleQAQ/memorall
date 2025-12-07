/**
 * Embedding Model Helper
 * Business logic layer for selecting embedding models based on size configuration
 * Keeps low-level implementations (LocalEmbedding, WorkerEmbedding) generic
 */

import {
	type EmbeddingSize,
	getModelConfig,
	getModelId,
	requiresRemoteAPI,
} from "@/config/embedding-models";
import type {
	LocalEmbeddingConfig,
	WorkerEmbeddingConfig,
	OpenAIEmbeddingConfig,
} from "./interfaces/base-embedding";

/**
 * Get embedding configuration for LocalEmbedding based on size
 */
export function getLocalEmbeddingConfig(
	size: EmbeddingSize,
): LocalEmbeddingConfig {
	if (requiresRemoteAPI(size)) {
		throw new Error(
			`Embedding size "${size}" requires remote API and cannot be used with LocalEmbedding`,
		);
	}

	const modelId = getModelId(size);
	if (!modelId) {
		throw new Error(`No model ID available for embedding size "${size}"`);
	}

	return {
		type: "local",
		modelName: modelId,
	};
}

/**
 * Get embedding configuration for WorkerEmbedding based on size
 */
export function getWorkerEmbeddingConfig(
	size: EmbeddingSize,
): WorkerEmbeddingConfig {
	if (requiresRemoteAPI(size)) {
		throw new Error(
			`Embedding size "${size}" requires remote API and cannot be used with WorkerEmbedding`,
		);
	}

	const modelId = getModelId(size);
	if (!modelId) {
		throw new Error(`No model ID available for embedding size "${size}"`);
	}

	return {
		type: "worker",
		modelName: modelId,
	};
}

/**
 * Get embedding configuration for OpenAI based on size
 */
export function getOpenAIEmbeddingConfig(
	size: EmbeddingSize,
	apiKey?: string,
	baseUrl?: string,
): OpenAIEmbeddingConfig {
	const config = getModelConfig(size);

	// For large (1536d), use OpenAI's models
	// text-embedding-3-small: 1536d
	// text-embedding-ada-002: 1536d (legacy)
	const modelName =
		size === "large" ? "text-embedding-3-small" : "text-embedding-ada-002";

	return {
		type: "openai",
		modelName,
		apiKey,
		baseUrl,
	};
}

/**
 * Get model name for a given embedding size
 * @param size - Embedding size
 * @param embeddingType - Type of embedding service ('local', 'worker', 'openai')
 * @returns Model name to use
 */
export function getModelNameForSize(
	size: EmbeddingSize,
	embeddingType: "local" | "worker" | "openai" = "local",
): string {
	if (embeddingType === "openai") {
		return size === "large"
			? "text-embedding-3-small"
			: "text-embedding-ada-002";
	}

	const modelId = getModelId(size);
	if (!modelId) {
		throw new Error(
			`Embedding size "${size}" requires remote API for ${embeddingType}`,
		);
	}

	return modelId;
}

/**
 * Check if an embedding size can be used with a specific embedding type
 */
export function canUseEmbeddingSize(
	size: EmbeddingSize,
	embeddingType: "local" | "worker" | "openai",
): boolean {
	if (embeddingType === "openai") {
		return true; // OpenAI supports all sizes
	}

	// Local and worker only support sizes with local models
	return !requiresRemoteAPI(size);
}
