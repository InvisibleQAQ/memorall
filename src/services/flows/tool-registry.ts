import z from "zod";
import type { BaseTool, ToolFactory } from "./interfaces/tool";
import type { ChatCompletionTool } from "@/types/openai";

// Global tool type registry for smart type inference
// Tool modules extend this interface to register their tool types and required services
declare global {
	interface ToolTypeRegistry {
		// Empty by default - tools will extend this interface
		// Example: 'calculator': { input: CalculatorInput; services: undefined; };
	}
}

// Internal factory storage type
type StoredFactory = (services: unknown) => BaseTool;

type JsonSchema = Record<string, unknown>;

const isOptionalSchema = (schema: z.ZodTypeAny): boolean => {
	if (schema instanceof z.ZodOptional) return true;
	if (schema instanceof z.ZodDefault) return true;
	if (schema instanceof z.ZodNullable) return true;
	return false;
};

const unwrapSchema = (schema: z.ZodTypeAny): z.ZodTypeAny => {
	const def = (
		schema as {
			_def?: {
				innerType?: z.ZodTypeAny;
				schema?: z.ZodTypeAny;
				typeName?: string;
			};
		}
	)._def;
	if (schema instanceof z.ZodOptional && def?.innerType)
		return unwrapSchema(def.innerType);
	if (schema instanceof z.ZodDefault && def?.innerType)
		return unwrapSchema(def.innerType);
	if (schema instanceof z.ZodNullable && def?.innerType)
		return unwrapSchema(def.innerType);
	if (def?.typeName === "ZodEffects" && def.schema)
		return unwrapSchema(def.schema);
	return schema;
};

const toJsonSchema = (schema: z.ZodTypeAny): JsonSchema => {
	const unwrapped = unwrapSchema(schema);

	if (unwrapped instanceof z.ZodString) {
		return { type: "string" };
	}
	if (unwrapped instanceof z.ZodNumber) {
		return { type: "number" };
	}
	if (unwrapped instanceof z.ZodBoolean) {
		return { type: "boolean" };
	}
	if (unwrapped instanceof z.ZodEnum) {
		return { type: "string", enum: unwrapped.options };
	}
	if (unwrapped instanceof z.ZodLiteral) {
		const value = unwrapped.value;
		const type = typeof value;
		return { type, enum: [value] };
	}
	if (unwrapped instanceof z.ZodArray) {
		const itemSchema = (
			unwrapped as unknown as { _def?: { type?: z.ZodTypeAny } }
		)._def?.type;
		return { type: "array", items: toJsonSchema(itemSchema ?? z.any()) };
	}
	if (unwrapped instanceof z.ZodObject) {
		const rawShape = (unwrapped as { _def?: { shape?: unknown } })._def?.shape;
		const shape =
			typeof rawShape === "function"
				? (rawShape as () => Record<string, z.ZodTypeAny>)()
				: (rawShape as Record<string, z.ZodTypeAny>);
		const properties: Record<string, JsonSchema> = {};
		const required: string[] = [];

		for (const [key, value] of Object.entries(shape ?? {})) {
			properties[key] = toJsonSchema(value as z.ZodTypeAny);
			if (!isOptionalSchema(value as z.ZodTypeAny)) {
				required.push(key);
			}
		}

		const result: JsonSchema = {
			type: "object",
			properties,
		};
		if (required.length) {
			result.required = required;
		}
		return result;
	}

	return { type: "object", properties: {} };
};

const toOpenAIToolParameters = (schema: z.ZodTypeAny): JsonSchema =>
	toJsonSchema(schema);

/**
 * Convert tools to OpenAI ChatCompletionTool format
 */
export function convertToolsToOpenAI(tools: BaseTool[]): ChatCompletionTool[] {
	return tools.map((tool) => ({
		type: "function" as const,
		function: {
			name: tool.name,
			description: tool.description,
			parameters: toOpenAIToolParameters(tool.schema),
		},
	}));
}

// Registry class using singleton pattern
export class ToolRegistryManager {
	private static instance: ToolRegistryManager;
	private factories = new Map<string, StoredFactory>();

	private constructor() {}

	static getInstance(): ToolRegistryManager {
		if (!ToolRegistryManager.instance) {
			ToolRegistryManager.instance = new ToolRegistryManager();
		}
		return ToolRegistryManager.instance;
	}

	/**
	 * Register a tool factory
	 */
	register<T extends keyof ToolTypeRegistry>(
		toolName: T,
		factory: ToolFactory<
			ToolTypeRegistry[T]["input"],
			ToolTypeRegistry[T]["services"]
		>,
	): void {
		// Wrap factories that don't need services to normalize the signature
		const normalizedFactory: StoredFactory = (services: unknown) => {
			if (factory.length === 0) {
				return (factory as () => BaseTool)();
			}
			return (factory as (s: unknown) => BaseTool)(services);
		};
		this.factories.set(toolName as string, normalizedFactory);
	}

	/**
	 * Get a tool instance with services bound (type-safe version)
	 */
	getTool<T extends keyof ToolTypeRegistry>(
		toolName: T,
		services: ToolTypeRegistry[T]["services"],
	): BaseTool {
		const factory = this.factories.get(toolName as string);
		if (!factory) {
			throw new Error(`No tool registered for name: ${String(toolName)}`);
		}
		return factory(services);
	}

	/**
	 * Get a tool by name with services (loose typing for dynamic access)
	 */
	getToolByName(toolName: string, services?: unknown): BaseTool {
		const factory = this.factories.get(toolName);
		if (!factory) {
			throw new Error(`No tool registered for name: ${toolName}`);
		}
		return factory(services);
	}

	/**
	 * Get multiple tools by name with services bound
	 */
	getTools(toolNames: readonly string[], services?: unknown): BaseTool[] {
		return toolNames.map((name) => this.getToolByName(name, services));
	}

	/**
	 * Get all registered tool names
	 */
	getRegisteredToolNames(): string[] {
		return Array.from(this.factories.keys());
	}

	/**
	 * Check if a tool is registered
	 */
	hasToolName(toolName: string): boolean {
		return this.factories.has(toolName);
	}

	/**
	 * Execute a tool by name
	 */
	async executeToolByName<T extends keyof ToolTypeRegistry>(
		toolName: T,
		args: ToolTypeRegistry[T]["input"],
		services: ToolTypeRegistry[T]["services"],
	): Promise<string> {
		const tool = this.getTool(toolName, services);
		const validatedArgs = tool.schema.parse(args);
		return tool.execute(validatedArgs);
	}
}

export const toolRegistry = ToolRegistryManager.getInstance();
