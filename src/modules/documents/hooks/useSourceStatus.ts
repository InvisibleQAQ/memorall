/**
 * Source Status Hook
 * Tracks knowledge generation status using the sources table
 */

import { useState, useEffect, useCallback } from "react";
import { serviceManager } from "@/services";
import { eq, inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export interface SourceStatus {
	isGenerating: boolean;
	status: "pending" | "processing" | "completed" | "failed" | null;
	sourceId?: string;
}

export function useSourceStatus(filePath: string): SourceStatus {
	const [sourceStatus, setSourceStatus] = useState<SourceStatus>({
		isGenerating: false,
		status: null,
	});

	const checkSourceStatus = useCallback(async () => {
		try {
			const result = await serviceManager.databaseService.use(
				async ({ db, schema }) => {
					// Get the most recent source for this file
					const sources = await db
						.select()
						.from(schema.sources)
						.where(eq(schema.sources.targetId, filePath))
						.orderBy(schema.sources.createdAt)
						.limit(1);

					return sources[0] || null;
				},
			);

			if (result) {
				const isGenerating =
					result.status === "pending" || result.status === "processing";
				setSourceStatus({
					isGenerating,
					status: result.status as
						| "pending"
						| "processing"
						| "completed"
						| "failed",
					sourceId: result.id,
				});
			} else {
				setSourceStatus({
					isGenerating: false,
					status: null,
				});
			}
		} catch (error) {
			logError("Failed to check source status:", error);
			setSourceStatus({
				isGenerating: false,
				status: null,
			});
		}
	}, [filePath]);

	// Check status on mount and when filePath changes
	useEffect(() => {
		if (filePath) {
			checkSourceStatus();
		}
	}, [filePath, checkSourceStatus]);

	// Poll for status updates when generating
	useEffect(() => {
		if (sourceStatus.isGenerating) {
			const interval = setInterval(checkSourceStatus, 2000); // Check every 2 seconds
			return () => clearInterval(interval);
		}
	}, [sourceStatus.isGenerating, checkSourceStatus]);

	return sourceStatus;
}

/**
 * Hook to track multiple file source statuses
 */
export function useMultipleSourceStatus(
	filePaths: string[],
): Map<string, SourceStatus> {
	const [statusMap, setStatusMap] = useState<Map<string, SourceStatus>>(
		new Map(),
	);

	const checkAllStatuses = useCallback(async () => {
		if (filePaths.length === 0) return;

		try {
			const results = await serviceManager.databaseService.use(
				async ({ db, schema }) => {
					// Get the most recent source for each file
					const sources = await db
						.select()
						.from(schema.sources)
						.where(inArray(schema.sources.targetId, filePaths))
						.orderBy(schema.sources.createdAt);

					// Group by targetId and get the most recent for each
					const sourceMap = new Map();
					sources.forEach((source) => {
						const existing = sourceMap.get(source.targetId);
						if (!existing || source.createdAt > existing.createdAt) {
							sourceMap.set(source.targetId, source);
						}
					});

					return sourceMap;
				},
			);

			const newStatusMap = new Map<string, SourceStatus>();

			filePaths.forEach((filePath) => {
				const source = results.get(filePath);
				if (source) {
					const isGenerating =
						source.status === "pending" || source.status === "processing";
					newStatusMap.set(filePath, {
						isGenerating,
						status: source.status as
							| "pending"
							| "processing"
							| "completed"
							| "failed",
						sourceId: source.id,
					});
				} else {
					newStatusMap.set(filePath, {
						isGenerating: false,
						status: null,
					});
				}
			});

			setStatusMap(newStatusMap);
		} catch (error) {
			logError("Failed to check multiple source statuses:", error);
		}
	}, [filePaths]);

	// Check statuses on mount and when filePaths change
	useEffect(() => {
		checkAllStatuses();
	}, [checkAllStatuses]);

	// Poll for status updates when any file is generating
	useEffect(() => {
		const hasGenerating = Array.from(statusMap.values()).some(
			(status) => status.isGenerating,
		);
		if (hasGenerating) {
			const interval = setInterval(checkAllStatuses, 10000);
			return () => clearInterval(interval);
		}
	}, [statusMap, checkAllStatuses]);

	return statusMap;
}
