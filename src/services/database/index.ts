// Export database service interface
export type { IDatabaseService } from "./interfaces/database-service.interface";
export type {
	DatabaseConfig,
	DatabaseStatus,
} from "./interfaces/database-service.interface";

// Export database service implementations (use dynamic imports to avoid heavy module loading)
// Main implementation (offscreen only)
export { DatabaseServiceMain } from "./database-service-main";
// Proxy implementation (popup/UI)
export { DatabaseServiceProxy } from "./database-service-proxy";
// Core base class
export { DatabaseServiceCore } from "./database-service-core";

// Export database core with dual-mode support (types and enums only, NO runtime imports)
export { DatabaseMode } from "./constants";
export type { DatabaseConfig as DBConfig } from "./constants";

// Export type-only entities
export * from "./types";
