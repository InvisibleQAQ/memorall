import z from "zod";
import type { Tool, ToolFactory, AllServices } from "../interfaces/tool";
import { toolRegistry } from "../tool-registry";

const TOOL_NAME = "memory_search" as const;

const schema = z.object({
	query: z.string().describe("Search query"),
	limit: z.number().optional().describe("Maximum number of results"),
});

type Input = z.infer<typeof schema>;
type Services = Pick<AllServices, "embedding">;

export const createMemorySearchTool: ToolFactory<Input, Services> = (
	services,
): Tool<Input> => ({
	name: TOOL_NAME,
	description: "Search through conversation memory and knowledge base",
	schema,
	execute: async (input) => {
		const { query, limit = 5 } = input;
		// services.embedding is available in scope for future implementation

		// TODO: Implement actual memory search using embedding service
		// For now, return a mock response
		return `Searched for "${query}" and found ${limit} relevant memories. This would integrate with the embedding service and knowledge graph.`;
	},
});

// Self-register the tool
toolRegistry.register(TOOL_NAME, createMemorySearchTool);

// Extend global ToolTypeRegistry for type-safe tool creation
declare global {
	interface ToolTypeRegistry {
		[TOOL_NAME]: {
			input: Input;
			services: Services;
		};
	}
}
