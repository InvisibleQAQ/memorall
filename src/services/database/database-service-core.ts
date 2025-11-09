/**
 * Database Service Core
 *
 * Base class for database service implementations.
 * Contains shared logic without importing heavy modules.
 */

import type {
	IDatabaseService,
	DatabaseConfig,
	DatabaseStatus,
	DatabaseContext,
} from "./interfaces/database-service.interface";
import { DatabaseMode } from "./constants";

export abstract class DatabaseServiceCore implements IDatabaseService {
	protected initialized = false;
	protected initPromise: Promise<void> | null = null;
	protected config: DatabaseConfig | null = null;

	constructor() {}

	async initialize(config?: DatabaseConfig): Promise<void> {
		if (this.initialized) return;
		if (this.initPromise) return this.initPromise;

		this.config = config || { mode: DatabaseMode.MAIN };
		this.initPromise = this.initializeDatabase();
		await this.initPromise;
		this.initialized = true;
	}

	protected abstract initializeDatabase(): Promise<void>;

	isReady(): boolean {
		return this.initialized;
	}

	abstract getStatus(): Promise<DatabaseStatus>;
	abstract getMode(): DatabaseMode | null;
	abstract isMainMode(): boolean;
	abstract isProxyMode(): boolean;

	getConfig(): DatabaseConfig | null {
		return this.config;
	}

	abstract healthCheck(): Promise<boolean>;
	abstract close(): Promise<void>;
	abstract hasTable(tableName: string): boolean;
	abstract getTableNames(): string[];

	abstract use<T>(
		fn: (ctx: DatabaseContext) => Promise<T> | T,
		options?: { transaction?: boolean },
	): Promise<T>;

	async transaction<T>(
		fn: (ctx: DatabaseContext) => Promise<T> | T,
	): Promise<T> {
		return this.use(fn, { transaction: true });
	}

	protected async ensureInitialized(): Promise<void> {
		if (!this.initialized) {
			await this.initialize();
		}
	}
}
