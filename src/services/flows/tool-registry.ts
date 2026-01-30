import { zodToJsonSchema } from "zod-to-json-schema";
import type { ZodSchema } from "zod/v3";
import type { BaseTool, Tool, ToolFactory } from "./interfaces/tool";
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

/**
 * Convert tools to OpenAI ChatCompletionTool format
 */
export function convertToolsToOpenAI(tools: BaseTool[]): ChatCompletionTool[] {
	return tools.map((tool) => ({
		type: "function" as const,
		function: {
			name: tool.name,
			description: tool.description,
			parameters: zodToJsonSchema(tool.schema as unknown as ZodSchema, { target: "openAi" }),
		},
	}));
}
