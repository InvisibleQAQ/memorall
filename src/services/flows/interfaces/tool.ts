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

// ==================== TOOL RESULT ====================

/** An image produced by a tool and stored in document-fs. */
export interface ToolResultImage {
	/** Relative path in document filesystem (e.g. /resources/images/<uuid>.png) */
	path: string;
	mimeType: string;
}

/**
 * Rich tool result that carries both a text description for the LLM
 * (OpenAI tool messages are string-only) and optional image references
 * for the UI to render inside the action card.
 */
export interface ToolComplexResult {
	/** Text sent to the LLM as the tool message content. */
	content: string;
	/** Images produced by the tool, stored in document-fs by path. */
	images?: ToolResultImage[];
}

/**
 * Tools may return a plain string (backward-compatible) or a ToolComplexResult.
 * String results are treated as { content: result, images: [] }.
 */
export type ToolResultValue = string | ToolComplexResult;

/** Normalise a ToolResultValue to its two components. */
export const extractToolResult = (
	value: ToolResultValue,
): { content: string; images: ToolResultImage[] } => {
	if (typeof value === "string") {
		return { content: value, images: [] };
	}
	return { content: value.content, images: value.images ?? [] };
};

export type JsonSchema = Record<string, unknown>;

export interface JsonToolSchema {
	kind: "json-schema";
	jsonSchema: JsonSchema;
	parse: (input: unknown) => unknown;
}

export type ToolSchema = z.ZodSchema | JsonToolSchema;

export const jsonToolSchema = (
	jsonSchema: JsonSchema,
	parse: (input: unknown) => unknown = (input) => input,
): JsonToolSchema => ({
	kind: "json-schema",
	jsonSchema,
	parse,
});

export const isJsonToolSchema = (
	schema: ToolSchema,
): schema is JsonToolSchema =>
	typeof schema === "object" &&
	schema !== null &&
	"kind" in schema &&
	schema.kind === "json-schema";

export const parseToolInput = <T>(schema: ToolSchema, input: unknown): T =>
	schema.parse(input) as T;

// Base tool interface for runtime storage (no generic constraints)
export interface BaseTool {
	name: string;
	description: string;
	schema: ToolSchema;
	metadata?: Record<string, unknown>;
	execute: (input: unknown) => Promise<ToolResultValue>;
}

export interface ToolBinding<TName extends string = string, TConfig = unknown> {
	name: TName;
	config?: TConfig;
}

// Typed tool interface for implementation
export interface Tool<TInput> extends Omit<BaseTool, "schema" | "execute"> {
	schema: z.ZodSchema<TInput>;
	execute: (input: TInput) => Promise<ToolResultValue>;
}

// Factory function type for creating tools with services bound
export type ToolFactory<
	TInput,
	TServices = void,
	TConfig = void,
> = TServices extends void
	? TConfig extends void
		? () => Tool<TInput>
		: (services: undefined, config: TConfig) => Tool<TInput>
	: TConfig extends void
		? (services: TServices) => Tool<TInput>
		: (services: TServices, config: TConfig) => Tool<TInput>;

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
