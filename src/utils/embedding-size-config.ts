/**
 * Embedding Size Configuration Utility
 * Works in ALL contexts: UI (React), offscreen, popup, standalone
 * Uses localStorage for persistence across all contexts
 */

import {
	type EmbeddingSize,
	DEFAULT_EMBEDDING_SIZE,
	isValidEmbeddingSize,
	getDimensions,
	getModelId,
} from "@/config/embedding-models";

const STORAGE_KEY = "embeddingSize";

/**
 * Get current embedding size from localStorage
 * Works in all contexts (UI, offscreen, popup, standalone)
 */
export function getCurrentEmbeddingSize(): EmbeddingSize {
	try {
		if (typeof window !== "undefined" && window.localStorage) {
			const saved = localStorage.getItem(STORAGE_KEY);
			if (saved && isValidEmbeddingSize(saved)) {
				return saved;
			}
		}
	} catch (error) {
		console.warn("Failed to get embedding size from localStorage:", error);
	}
	return DEFAULT_EMBEDDING_SIZE;
}

/**
 * Set embedding size in localStorage
 * Works in all contexts (UI, offscreen, popup, standalone)
 */
export function setCurrentEmbeddingSize(size: EmbeddingSize): void {
	try {
		if (typeof window !== "undefined" && window.localStorage) {
			localStorage.setItem(STORAGE_KEY, size);
		}
	} catch (error) {
		console.warn("Failed to set embedding size in localStorage:", error);
	}
}

/**
 * Get dimensions for current embedding size
 */
export function getCurrentDimensions(): number {
	return getDimensions(getCurrentEmbeddingSize());
}

/**
 * Get model ID for current embedding size
 */
export function getCurrentModelId(): string | null {
	return getModelId(getCurrentEmbeddingSize());
}

/**
 * Get database field names for current embedding size
 */
export interface EmbeddingFieldNames {
	// Node fields
	nameEmbedding: string;

	// Edge fields
	factEmbedding: string;
	typeEmbedding: string;

	// Message fields
	embedding: string;
}

/**
 * Get the correct field names based on current embedding size
 * @returns Object with field names for nodes, edges, and messages
 */
export function getCurrentEmbeddingFields(): EmbeddingFieldNames {
	const size = getCurrentEmbeddingSize();

	switch (size) {
		case "small":
			return {
				nameEmbedding: "nameEmbeddingSmall",
				factEmbedding: "factEmbeddingSmall",
				typeEmbedding: "typeEmbeddingSmall",
				embedding: "embeddingSmall",
			};
		case "medium":
			return {
				nameEmbedding: "nameEmbedding",
				factEmbedding: "factEmbedding",
				typeEmbedding: "typeEmbedding",
				embedding: "embedding",
			};
		case "large":
			return {
				nameEmbedding: "nameEmbeddingLarge",
				factEmbedding: "factEmbeddingLarge",
				typeEmbedding: "typeEmbeddingLarge",
				embedding: "embeddingLarge",
			};
	}
}

/**
 * Get database column names (snake_case) for current embedding size
 */
export function getCurrentEmbeddingColumns(): {
	nameEmbedding: string;
	factEmbedding: string;
	typeEmbedding: string;
	embedding: string;
} {
	const size = getCurrentEmbeddingSize();

	switch (size) {
		case "small":
			return {
				nameEmbedding: "name_embedding_small",
				factEmbedding: "fact_embedding_small",
				typeEmbedding: "type_embedding_small",
				embedding: "embedding_small",
			};
		case "medium":
			return {
				nameEmbedding: "name_embedding",
				factEmbedding: "fact_embedding",
				typeEmbedding: "type_embedding",
				embedding: "embedding",
			};
		case "large":
			return {
				nameEmbedding: "name_embedding_large",
				factEmbedding: "fact_embedding_large",
				typeEmbedding: "type_embedding_large",
				embedding: "embedding_large",
			};
	}
}

/**
 * Check if current embedding size requires remote API
 */
export function currentSizeRequiresRemote(): boolean {
	return getCurrentEmbeddingSize() === "large";
}

/**
 * Get info about current embedding configuration
 */
export function getCurrentEmbeddingInfo(): {
	size: EmbeddingSize;
	dimensions: number;
	modelId: string | null;
	fields: EmbeddingFieldNames;
	columns: ReturnType<typeof getCurrentEmbeddingColumns>;
	requiresRemote: boolean;
} {
	const size = getCurrentEmbeddingSize();
	return {
		size,
		dimensions: getDimensions(size),
		modelId: getModelId(size),
		fields: getCurrentEmbeddingFields(),
		columns: getCurrentEmbeddingColumns(),
		requiresRemote: currentSizeRequiresRemote(),
	};
}

/**
 * Initialize embedding size configuration
 * Should be called BEFORE service manager initialization
 * Works in all contexts (UI, offscreen, popup, standalone)
 *
 * This function:
 * 1. Checks if there's already a saved size in localStorage
 * 2. If not, detects existing data in database
 * 3. Sets default: medium for existing data (backward compat), small for new installations
 * 4. Saves the determined size to localStorage
 */
export async function initializeEmbeddingSize(
	databaseService?: {
		use: <T>(
			fn: (helpers: {
				raw: (sql: string) => Promise<unknown>;
			}) => Promise<T>,
		) => Promise<T>;
	},
): Promise<EmbeddingSize> {
	// Check if already configured
	const saved = getCurrentEmbeddingSize();
	if (saved && saved !== DEFAULT_EMBEDDING_SIZE) {
		// Already has a saved preference, use it
		return saved;
	}

	// No saved preference - need to detect and set default
	if (databaseService) {
		try {
			// Check for existing embedding data
			const hasData = await databaseService.use(async ({ raw }) => {
				const nodeCheck = await raw(
					"SELECT COUNT(*) as count FROM nodes WHERE name_embedding IS NOT NULL LIMIT 1",
				);
				const edgeCheck = await raw(
					"SELECT COUNT(*) as count FROM edges WHERE fact_embedding IS NOT NULL LIMIT 1",
				);

				const nodeCount =
					((nodeCheck as { rows: [{ count: number }] }).rows[0]?.count ||
						0) as number;
				const edgeCount =
					((edgeCheck as { rows: [{ count: number }] }).rows[0]?.count ||
						0) as number;

				return nodeCount > 0 || edgeCount > 0;
			});

			// Set default based on existing data
			const defaultSize: EmbeddingSize = hasData ? "medium" : "small";
			setCurrentEmbeddingSize(defaultSize);
			return defaultSize;
		} catch (error) {
			console.warn(
				"Failed to detect existing embeddings, using default:",
				error,
			);
			// On error, use medium for safety (backward compatible)
			setCurrentEmbeddingSize("medium");
			return "medium";
		}
	}

	// No database service available - use current value or safe default
	if (saved) {
		return saved;
	}

	// Use medium as safe default for backward compatibility
	setCurrentEmbeddingSize("medium");
	return "medium";
}
