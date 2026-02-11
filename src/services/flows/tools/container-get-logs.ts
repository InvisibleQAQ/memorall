import z from "zod";
import type { Tool, ToolFactory } from "../interfaces/tool";
import { toolRegistry } from "../tool-registry";
import { sandboxContainerService } from "@/services/sandbox-container";

const TOOL_NAME = "container_get_logs" as const;

const schema = z.object({
	limit: z
		.number()
		.int()
		.min(1)
		.max(500)
		.optional()
		.describe("Maximum number of log entries to return (default 100)."),
	level: z
		.enum(["log", "info", "warn", "error", "debug"])
		.optional()
		.describe("Optional log level filter."),
});

type Input = z.infer<typeof schema>;

export const createContainerGetLogsTool: ToolFactory<
	Input,
	undefined
> = (): Tool<Input> => ({
	name: TOOL_NAME,
	description: "Get recent sandbox container logs.",
	schema,
	execute: async (input) => {
		const result = await sandboxContainerService.getLogs({
			limit: input.limit ?? 100,
			level: input.level,
		});
		return JSON.stringify(result, null, 2);
	},
});

toolRegistry.register(TOOL_NAME, createContainerGetLogsTool);

declare global {
	interface ToolTypeRegistry {
		[TOOL_NAME]: {
			input: Input;
			services: undefined;
		};
	}
}
