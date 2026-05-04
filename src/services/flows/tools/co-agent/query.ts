import z from "zod";
import type { Tool, ToolFactory } from "@/services/flows/interfaces/tool";
import { toolRegistry } from "@/services/flows/tool-registry";
import { CO_AGENT_CONTENT_COMMAND_SOURCE } from "@/services/co-agent";
import {
	createDefaultErrorResult,
	createResult,
	sendCoAgentCommand,
} from "./shared";

const querySchema = z.object({
	selector: z
		.string()
		.min(1)
		.describe("CSS selector to query in the active tab."),
	maxResults: z.number().int().optional(),
});

type QueryInput = z.infer<typeof querySchema>;

const createQueryTool: ToolFactory<QueryInput> = (): Tool<QueryInput> => ({
	name: "co_agent_query",
	description:
		"Query DOM elements in the active co-agent tab. Returns visible state, rects, stable selectors, text/value, and input capability.",
	schema: querySchema,
	execute: async (input) => {
		try {
			const response = await sendCoAgentCommand({
				source: CO_AGENT_CONTENT_COMMAND_SOURCE,
				type: "co-agent:query",
				selector: input.selector,
				maxResults: input.maxResults,
			});
			return createResult({
				actionType: "co_agent_query",
				selector: input.selector,
				...response,
			});
		} catch (error) {
			return createDefaultErrorResult(error);
		}
	},
});

toolRegistry.register("co_agent_query", createQueryTool);

declare global {
	interface ToolTypeRegistry {
		co_agent_query: {
			input: QueryInput;
			services: void;
		};
	}
}
