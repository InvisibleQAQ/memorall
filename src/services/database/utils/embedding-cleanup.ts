/**
 * Embedding Cleanup Utilities
 * Functions to clear embedding data when changing embedding sizes
 */

import type { IDatabaseService } from "@/services/database";
import { logInfo, logError } from "@/utils/logger";

/**
 * Clear all embeddings from nodes table
 */
export async function clearNodeEmbeddings(
	databaseService: IDatabaseService,
): Promise<number> {
	try {
		logInfo("Clearing node embeddings...");

		const result = await databaseService.use(async ({ raw }) => {
			return await raw(`
				UPDATE nodes
				SET
					name_embedding_small = NULL,
					name_embedding = NULL,
					name_embedding_large = NULL
				WHERE
					name_embedding_small IS NOT NULL
					OR name_embedding IS NOT NULL
					OR name_embedding_large IS NOT NULL
			`);
		});

		const rowCount =
			typeof (result as { affectedRows?: number }).affectedRows === "number"
				? (result as { affectedRows: number }).affectedRows
				: 0;

		logInfo(`Cleared embeddings from ${rowCount} nodes`);
		return rowCount;
	} catch (error) {
		logError("Error clearing node embeddings:", error);
		throw error;
	}
}

/**
 * Clear all embeddings from edges table
 */
export async function clearEdgeEmbeddings(
	databaseService: IDatabaseService,
): Promise<number> {
	try {
		logInfo("Clearing edge embeddings...");

		const result = await databaseService.use(async ({ raw }) => {
			return await raw(`
				UPDATE edges
				SET
					fact_embedding_small = NULL,
					fact_embedding = NULL,
					fact_embedding_large = NULL,
					type_embedding_small = NULL,
					type_embedding = NULL,
					type_embedding_large = NULL
				WHERE
					fact_embedding_small IS NOT NULL
					OR fact_embedding IS NOT NULL
					OR fact_embedding_large IS NOT NULL
					OR type_embedding_small IS NOT NULL
					OR type_embedding IS NOT NULL
					OR type_embedding_large IS NOT NULL
			`);
		});

		const rowCount =
			typeof (result as { affectedRows?: number }).affectedRows === "number"
				? (result as { affectedRows: number }).affectedRows
				: 0;

		logInfo(`Cleared embeddings from ${rowCount} edges`);
		return rowCount;
	} catch (error) {
		logError("Error clearing edge embeddings:", error);
		throw error;
	}
}

/**
 * Clear all embeddings from messages table
 */
export async function clearMessageEmbeddings(
	databaseService: IDatabaseService,
): Promise<number> {
	try {
		logInfo("Clearing message embeddings...");

		const result = await databaseService.use(async ({ raw }) => {
			return await raw(`
				UPDATE messages
				SET
					embedding_small = NULL,
					embedding = NULL,
					embedding_large = NULL
				WHERE
					embedding_small IS NOT NULL
					OR embedding IS NOT NULL
					OR embedding_large IS NOT NULL
			`);
		});

		const rowCount =
			typeof (result as { affectedRows?: number }).affectedRows === "number"
				? (result as { affectedRows: number }).affectedRows
				: 0;

		logInfo(`Cleared embeddings from ${rowCount} messages`);
		return rowCount;
	} catch (error) {
		logError("Error clearing message embeddings:", error);
		throw error;
	}
}

/**
 * Clear all embeddings from all tables
 * @returns Object with counts of cleared items per table
 */
export async function clearAllEmbeddings(
	databaseService: IDatabaseService,
): Promise<{
	nodes: number;
	edges: number;
	messages: number;
	total: number;
}> {
	try {
		logInfo("Clearing all embeddings from database...");

		const [nodeCount, edgeCount, messageCount] = await Promise.all([
			clearNodeEmbeddings(databaseService),
			clearEdgeEmbeddings(databaseService),
			clearMessageEmbeddings(databaseService),
		]);

		const total = nodeCount + edgeCount + messageCount;

		logInfo(
			`Cleared all embeddings: ${nodeCount} nodes, ${edgeCount} edges, ${messageCount} messages (total: ${total})`,
		);

		return {
			nodes: nodeCount,
			edges: edgeCount,
			messages: messageCount,
			total,
		};
	} catch (error) {
		logError("Error clearing all embeddings:", error);
		throw error;
	}
}

/**
 * Check if there are any embeddings in the database
 */
export async function hasAnyEmbeddings(
	databaseService: IDatabaseService,
): Promise<boolean> {
	try {
		const [nodeCheck, edgeCheck, messageCheck] = await Promise.all([
			databaseService.use(async ({ raw }) => {
				return await raw(`
					SELECT EXISTS(
						SELECT 1 FROM nodes
						WHERE name_embedding_small IS NOT NULL
							OR name_embedding IS NOT NULL
							OR name_embedding_large IS NOT NULL
						LIMIT 1
					) as has_embeddings
				`);
			}),
			databaseService.use(async ({ raw }) => {
				return await raw(`
					SELECT EXISTS(
						SELECT 1 FROM edges
						WHERE fact_embedding_small IS NOT NULL
							OR fact_embedding IS NOT NULL
							OR fact_embedding_large IS NOT NULL
							OR type_embedding_small IS NOT NULL
							OR type_embedding IS NOT NULL
							OR type_embedding_large IS NOT NULL
						LIMIT 1
					) as has_embeddings
				`);
			}),
			databaseService.use(async ({ raw }) => {
				return await raw(`
					SELECT EXISTS(
						SELECT 1 FROM messages
						WHERE embedding_small IS NOT NULL
							OR embedding IS NOT NULL
							OR embedding_large IS NOT NULL
						LIMIT 1
					) as has_embeddings
				`);
			}),
		]);

		return (
			(nodeCheck as { rows: [{ has_embeddings: boolean }] }).rows[0]
				?.has_embeddings ||
			(edgeCheck as { rows: [{ has_embeddings: boolean }] }).rows[0]
				?.has_embeddings ||
			(messageCheck as { rows: [{ has_embeddings: boolean }] }).rows[0]
				?.has_embeddings ||
			false
		);
	} catch (error) {
		logError("Error checking for embeddings:", error);
		return false;
	}
}
