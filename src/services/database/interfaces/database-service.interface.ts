/**
 * Database Service Interface
 *
 * Type-safe interface without heavy runtime imports.
 */

import type { schema } from "../schema";
import type { DatabaseMode, DatabaseConfig } from "../constants";

// Properly typed database instance from drizzle
export type DrizzleDB = ReturnType<
	typeof import("drizzle-orm/pglite").drizzle<typeof schema>
>;

// Database context with full type safety
export interface DatabaseContext {
	db: DrizzleDB;
	schema: typeof schema;
	raw: (sql: string, params?: unknown[]) => Promise<unknown>;
}

// Re-export DatabaseConfig from constants for convenience
export type { DatabaseConfig };

// Database status
export interface DatabaseStatus {
	initialized: boolean;
	mode: DatabaseMode | null;
	isMainMode: boolean;
	isProxyMode: boolean;
	tableCount: number;
	availableTables: string[];
	healthy: boolean;
	healthCheck: unknown;
}

/**
 * Database Service Interface
 *
 * Thin wrapper around db.ts with consistent API
 */
export interface IDatabaseService {
	initialize(config?: DatabaseConfig): Promise<void>;
	isReady(): boolean;
	getStatus(): Promise<DatabaseStatus>;
	getMode(): DatabaseMode | null;
	isMainMode(): boolean;
	isProxyMode(): boolean;
	getConfig(): DatabaseConfig | null;
	healthCheck(): Promise<boolean>;
	close(): Promise<void>;
	hasTable(tableName: string): boolean;
	getTableNames(): string[];

	/**
	 * Execute with database context - fully typed
	 */
	use<T>(
		fn: (ctx: DatabaseContext) => Promise<T> | T,
		options?: { transaction?: boolean },
	): Promise<T>;

	transaction<T>(fn: (ctx: DatabaseContext) => Promise<T> | T): Promise<T>;
}
