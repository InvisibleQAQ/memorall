import { z } from "zod";
import type { ILLMService } from "@/services/llm/interfaces/llm-service.interface";
import type { IEmbeddingService } from "@/services/embedding/interfaces/embedding-service.interface";
import type { IDatabaseService } from "@/services/database";
import type { ISandboxContainerService } from "@/services/sandbox-container";
import type { IWebBrowserService } from "@/services/web-browser";
import type { DocumentFileSystem } from "@/services/filesystem/document-filesystem";

// All available services
export interface AllServices {
	llm: ILLMService;
	embedding: IEmbeddingService;
	database: IDatabaseService;
	sandboxContainer?: ISandboxContainerService;
	webBrowser?: IWebBrowserService;
	documentFileSystem?: DocumentFileSystem;
}

// Base tool interface for runtime storage (no generic constraints)
export interface BaseTool {
	name: string;
	description: string;
	schema: z.ZodSchema;
	execute: (input: unknown) => Promise<string>;
}

// Typed tool interface for implementation
export interface Tool<TInput> extends Omit<BaseTool, "schema" | "execute"> {
	schema: z.ZodSchema<TInput>;
	execute: (input: TInput) => Promise<string>;
}

// Factory function type for creating tools with services bound
export type ToolFactory<TInput, TServices = void> = TServices extends void
	? () => Tool<TInput>
	: (services: TServices) => Tool<TInput>;

// ============================================================================
// Utility types for deriving combined services from tool names
// ============================================================================

// Extract the keys from a Pick<AllServices, K> type
type ServiceKeys<S> = S extends Pick<AllServices, infer K> ? K : never;

// Get the union of service keys from multiple tool names
type ToolServicesKeys<T extends readonly (keyof ToolTypeRegistry)[]> = {
	[K in T[number]]: ServiceKeys<ToolTypeRegistry[K]["services"]>;
}[T[number]];

// Combine services from tool names + optional extra keys needed by the graph
export type CombinedServices<
	T extends readonly (keyof ToolTypeRegistry)[],
	ExtraKeys extends keyof AllServices = never,
> = Pick<AllServices, ToolServicesKeys<T> | ExtraKeys>;
