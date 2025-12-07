/**
 * Embedding Size Configuration Utility
 * Works in ALL contexts: UI (React), offscreen, popup, standalone
 * Uses SharedStorageService (IndexedDB + messaging) for cross-thread persistence
 */

import {
	type EmbeddingSize,
	DEFAULT_EMBEDDING_SIZE,
	isValidEmbeddingSize,
	getDimensions,
	getModelId,
} from "@/config/embedding-models";
import { sharedStorageService } from "@/services/shared-storage/shared-storage-service";

const STORAGE_KEY = "embeddingSize";

/**
 * Get current embedding size from shared storage
 * Works in all contexts (UI, offscreen, popup, standalone)
 */
export async function getCurrentEmbeddingSize(): Promise<EmbeddingSize> {
	try {
		const saved = await sharedStorageService.get<EmbeddingSize>(STORAGE_KEY);
		if (saved && isValidEmbeddingSize(saved)) {
			return saved;
		}
	} catch (error) {
		console.warn("Failed to get embedding size from shared storage:", error);
	}
	return DEFAULT_EMBEDDING_SIZE;
}

/**
 * Set embedding size in shared storage
 * Works in all contexts (UI, offscreen, popup, standalone)
 */
export async function setCurrentEmbeddingSize(
	size: EmbeddingSize,
): Promise<void> {
	try {
		await sharedStorageService.set(STORAGE_KEY, size);
	} catch (error) {
		console.warn("Failed to set embedding size in shared storage:", error);
	}
}

/**
 * Get dimensions for current embedding size
 */
export async function getCurrentDimensions(): Promise<number> {
	const size = await getCurrentEmbeddingSize();
	return getDimensions(size);
}

/**
 * Get model ID for current embedding size
 */
export async function getCurrentModelId(): Promise<string | null> {
	const size = await getCurrentEmbeddingSize();
	return getModelId(size);
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
export async function getCurrentEmbeddingFields(): Promise<EmbeddingFieldNames> {
	const size = await getCurrentEmbeddingSize();

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
export async function getCurrentEmbeddingColumns(): Promise<{
	nameEmbedding: string;
	factEmbedding: string;
	typeEmbedding: string;
	embedding: string;
}> {
	const size = await getCurrentEmbeddingSize();

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
export async function currentSizeRequiresRemote(): Promise<boolean> {
	const size = await getCurrentEmbeddingSize();
	return size === "large";
}

/**
 * Get info about current embedding configuration
 */
export async function getCurrentEmbeddingInfo(): Promise<{
	size: EmbeddingSize;
	dimensions: number;
	modelId: string | null;
	fields: EmbeddingFieldNames;
	columns: {
		nameEmbedding: string;
		factEmbedding: string;
		typeEmbedding: string;
		embedding: string;
	};
	requiresRemote: boolean;
}> {
	const size = await getCurrentEmbeddingSize();
	const [fields, columns, requiresRemote] = await Promise.all([
		getCurrentEmbeddingFields(),
		getCurrentEmbeddingColumns(),
		currentSizeRequiresRemote(),
	]);

	return {
		size,
		dimensions: getDimensions(size),
		modelId: getModelId(size),
		fields,
		columns,
		requiresRemote,
	};
}

/**
 * Initialize embedding size configuration
 * Should be called BEFORE service manager initialization
 * Works in all contexts (UI, offscreen, popup, standalone)
 *
 * This function:
 * 1. Checks if there's already a saved preference in localStorage (not null)
 * 2. If saved preference exists, use it (respects user choice)
 * 3. If no saved preference, detects from database by checking ALL embedding size fields:
 *    - If nameEmbeddingLarge/factEmbeddingLarge has data -> "large" (1536d)
 *    - If nameEmbedding/factEmbedding has data -> "medium" (768d)
 *    - If nameEmbeddingSmall/factEmbeddingSmall has data -> "small" (384d)
 *    - If no data -> "small" (default for new installations)
 * 4. Saves the detected/determined size to localStorage for future use
 */
export async function initializeEmbeddingSize(databaseService?: {
	use: <T>(
		fn: (helpers: { raw: (sql: string) => Promise<unknown> }) => Promise<T>,
	) => Promise<T>;
}): Promise<EmbeddingSize> {
	// Check if already configured by checking shared storage directly
	// (Don't use getCurrentEmbeddingSize which returns default if empty)
	const savedValue = await sharedStorageService.get<EmbeddingSize>(STORAGE_KEY);
	const hasSavedPreference = savedValue !== null;

	if (hasSavedPreference) {
		// Already has a saved preference, use it
		console.log(`✅ Using saved embedding size preference: ${savedValue}`);
		return savedValue;
	}

	// No saved preference - need to detect from database
	if (databaseService) {
		try {
			// Check for existing embedding data across ALL size fields
			const detectedSize = await databaseService.use(async ({ raw }) => {
				// Check for large embeddings (1536d)
				const nodeLargeCheck = await raw(
					"SELECT COUNT(*) as count FROM nodes WHERE name_embedding_large IS NOT NULL LIMIT 1",
				);
				const edgeLargeCheck = await raw(
					"SELECT COUNT(*) as count FROM edges WHERE fact_embedding_large IS NOT NULL OR type_embedding_large IS NOT NULL LIMIT 1",
				);

				const nodeLargeCount = ((
					nodeLargeCheck as { rows: [{ count: number }] }
				).rows[0]?.count || 0) as number;
				const edgeLargeCount = ((
					edgeLargeCheck as { rows: [{ count: number }] }
				).rows[0]?.count || 0) as number;

				if (nodeLargeCount > 0 || edgeLargeCount > 0) {
					return "large" as EmbeddingSize;
				}

				// Check for medium embeddings (768d)
				const nodeMediumCheck = await raw(
					"SELECT COUNT(*) as count FROM nodes WHERE name_embedding IS NOT NULL LIMIT 1",
				);
				const edgeMediumCheck = await raw(
					"SELECT COUNT(*) as count FROM edges WHERE fact_embedding IS NOT NULL OR type_embedding IS NOT NULL LIMIT 1",
				);

				const nodeMediumCount = ((
					nodeMediumCheck as { rows: [{ count: number }] }
				).rows[0]?.count || 0) as number;
				const edgeMediumCount = ((
					edgeMediumCheck as { rows: [{ count: number }] }
				).rows[0]?.count || 0) as number;

				if (nodeMediumCount > 0 || edgeMediumCount > 0) {
					return "medium" as EmbeddingSize;
				}

				// Check for small embeddings (384d)
				const nodeSmallCheck = await raw(
					"SELECT COUNT(*) as count FROM nodes WHERE name_embedding_small IS NOT NULL LIMIT 1",
				);
				const edgeSmallCheck = await raw(
					"SELECT COUNT(*) as count FROM edges WHERE fact_embedding_small IS NOT NULL OR type_embedding_small IS NOT NULL LIMIT 1",
				);

				const nodeSmallCount = ((
					nodeSmallCheck as { rows: [{ count: number }] }
				).rows[0]?.count || 0) as number;
				const edgeSmallCount = ((
					edgeSmallCheck as { rows: [{ count: number }] }
				).rows[0]?.count || 0) as number;

				if (nodeSmallCount > 0 || edgeSmallCount > 0) {
					return "small" as EmbeddingSize;
				}

				// No embeddings found - use default for new installations
				return "small" as EmbeddingSize;
			});

			await setCurrentEmbeddingSize(detectedSize);
			console.log(`✅ Detected embedding size from database: ${detectedSize}`);
			return detectedSize;
		} catch (error) {
			console.warn(
				"Failed to detect existing embeddings, using default:",
				error,
			);
			// On error, use medium for safety (backward compatible)
			await setCurrentEmbeddingSize("medium");
			return "medium";
		}
	}

	// No database service available - use safe default
	// Use medium as safe default for backward compatibility
	await setCurrentEmbeddingSize("medium");
	return "medium";
}
