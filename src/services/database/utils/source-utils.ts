/**
 * Lightweight source utilities
 *
 * These utilities work with Source type objects but DO NOT import
 * database schemas or drizzle-orm. Safe for use in popup thread.
 */

import type { Source } from "../entities/sources";

/**
 * Helper function to get the effective status of a source, accounting for timeout
 * @param source The source object
 * @param timeoutMinutes Timeout in minutes (default 30)
 * @returns The effective status (may convert "pending"/"processing" to "failed" if timed out)
 */
export function getEffectiveSourceStatus(
	source: Source,
	timeoutMinutes: number = 30,
): string {
	const status = source.status || "pending";
	if (status === "pending" || status === "processing") {
		const now = new Date();
		const timeoutAgo = new Date(now.getTime() - timeoutMinutes * 60 * 1000);
		const statusStartedAt =
			source.statusValidFrom ?? source.updatedAt ?? source.createdAt;
		const validFrom =
			statusStartedAt instanceof Date
				? statusStartedAt
				: new Date(statusStartedAt);
		if (!Number.isNaN(validFrom.getTime()) && validFrom < timeoutAgo) {
			return "failed";
		}
	}
	return status;
}
