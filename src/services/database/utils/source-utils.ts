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
 * @returns The effective status (may convert "processing" to "failed" if timed out)
 */
export function getEffectiveSourceStatus(
	source: Source,
	timeoutMinutes: number = 30,
): string {
	if (source.status === "processing" && source.statusValidFrom) {
		const now = new Date();
		const timeoutAgo = new Date(now.getTime() - timeoutMinutes * 60 * 1000);
		if (source.statusValidFrom < timeoutAgo) {
			return "failed";
		}
	}
	return source.status || "pending";
}
