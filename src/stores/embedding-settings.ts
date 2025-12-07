/**
 * Embedding Settings Store
 * Manages embedding size configuration using Zustand
 */

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import {
	type EmbeddingSize,
	DEFAULT_EMBEDDING_SIZE,
	isValidEmbeddingSize,
} from "@/config/embedding-models";
import {
	getCurrentEmbeddingSize,
	setCurrentEmbeddingSize,
} from "@/utils/embedding-size-config";
import { serviceManager } from "@/services";
import { logInfo } from "@/utils/logger";

export interface EmbeddingSettingsState {
	// State
	embeddingSize: EmbeddingSize;
	hasExistingData: boolean;
	isDetecting: boolean;

	// Actions
	setEmbeddingSize: (size: EmbeddingSize) => Promise<void>;
	detectExistingData: () => Promise<void>;
	initialize: () => Promise<void>;
}

export const useEmbeddingSettings = create<EmbeddingSettingsState>()(
	subscribeWithSelector((set, get) => ({
		embeddingSize: DEFAULT_EMBEDDING_SIZE,
		hasExistingData: false,
		isDetecting: false,

		setEmbeddingSize: async (size: EmbeddingSize) => {
			await setCurrentEmbeddingSize(size);
			set({ embeddingSize: size });
			logInfo(`Embedding size changed to: ${size}`);
		},

		detectExistingData: async () => {
			try {
				set({ isDetecting: true });

				const hasData = await serviceManager.databaseService.use(
					async ({ raw }) => {
						// Check for ANY embedding data across all sizes
						const nodeCheck = await raw(
							"SELECT COUNT(*) as count FROM nodes WHERE name_embedding_small IS NOT NULL OR name_embedding IS NOT NULL OR name_embedding_large IS NOT NULL LIMIT 1",
						);
						const edgeCheck = await raw(
							"SELECT COUNT(*) as count FROM edges WHERE fact_embedding_small IS NOT NULL OR fact_embedding IS NOT NULL OR fact_embedding_large IS NOT NULL OR type_embedding_small IS NOT NULL OR type_embedding IS NOT NULL OR type_embedding_large IS NOT NULL LIMIT 1",
						);

						const nodeCount = ((nodeCheck as { rows: [{ count: number }] })
							.rows[0]?.count || 0) as number;
						const edgeCount = ((edgeCheck as { rows: [{ count: number }] })
							.rows[0]?.count || 0) as number;

						return nodeCount > 0 || edgeCount > 0;
					},
				);

				set({ hasExistingData: hasData });
			} catch (error) {
				console.warn("Failed to detect existing data:", error);
				set({ hasExistingData: false });
			} finally {
				set({ isDetecting: false });
			}
		},

		initialize: async () => {
			try {
				set({ isDetecting: true });

				// Read the already-configured size from shared storage
				// (It was already initialized by service-manager in offscreen thread)
				const currentSize = await getCurrentEmbeddingSize();

				console.log(
					`[EmbeddingSettings] Initializing - getCurrentEmbeddingSize(): "${currentSize}"`,
				);

				// Detect existing data for UI display
				await get().detectExistingData();

				set({ embeddingSize: currentSize });
				logInfo(`Embedding settings loaded: ${currentSize}`);
			} catch (error) {
				console.error("Failed to load embedding settings:", error);
				// Fallback to saved or default
				const savedSize = await getCurrentEmbeddingSize();
				set({
					embeddingSize: isValidEmbeddingSize(savedSize)
						? savedSize
						: DEFAULT_EMBEDDING_SIZE,
				});
			} finally {
				set({ isDetecting: false });
			}
		},
	})),
);

/**
 * Hook to get current embedding size
 */
export function useCurrentEmbeddingSize(): EmbeddingSize {
	return useEmbeddingSettings((state) => state.embeddingSize);
}

/**
 * Hook to check if there's existing data
 */
export function useHasExistingData(): boolean {
	return useEmbeddingSettings((state) => state.hasExistingData);
}
