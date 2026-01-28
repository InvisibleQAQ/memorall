import z from "zod";
import type { Tool, ToolFactory, AllServices } from "../interfaces/tool";
import { toolRegistry } from "../tool-registry";

const TOOL_NAME = "knowledge_graph" as const;

const schema = z.object({
	entity: z.string().describe("Entity to search for"),
	relationship: z.string().optional().describe("Specific relationship type"),
});

type Input = z.infer<typeof schema>;
type Services = Pick<AllServices, "embedding">;

export const createKnowledgeGraphTool: ToolFactory<Input, Services> = (
	services,
): Tool<Input> => ({
	name: TOOL_NAME,
	description: "Query the knowledge graph for relationships and entities",
	schema,
	execute: async (input) => {
		const { entity, relationship } = input;
		// services.embedding is available in scope for future implementation

		// TODO: Implement actual knowledge graph query using database service
		// For now, return a mock response
		if (relationship) {
			return `Found relationships of type "${relationship}" for entity "${entity}". This would query the knowledge graph database.`;
		} else {
			return `Found information about entity "${entity}" in the knowledge graph. This would query the nodes and edges tables.`;
		}
	},
});

// Self-register the tool
toolRegistry.register(TOOL_NAME, createKnowledgeGraphTool);

// Extend global ToolTypeRegistry for type-safe tool creation
declare global {
	interface ToolTypeRegistry {
		[TOOL_NAME]: {
			input: Input;
			services: Services;
		};
	}
}
