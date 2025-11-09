/**
 * Database Constants and Enums
 *
 * Lightweight file with no heavy imports.
 * Safe to import from both proxy and main implementations.
 */

// Database mode configuration
export enum DatabaseMode {
	MAIN = "main",
	PROXY = "proxy",
}

export interface DatabaseConfig {
	mode: DatabaseMode;
	dataDir?: string;
	// Proxy mode specific options
	proxyOptions?: {
		channelName?: string;
	};
}
