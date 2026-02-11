import z from "zod";
import type { Tool, ToolFactory } from "@/services/flows/interfaces/tool";
import { toolRegistry } from "@/services/flows/tool-registry";
import { sandboxContainerService } from "@/services/sandbox-container";

const TOOL_NAME = "container_mkdir" as const;

const schema = z.object({
	path: z.string().min(1).describe("Absolute virtual directory path."),
	recursive: z
		.boolean()
		.optional()
		.describe("Create parent directories recursively (default true)."),
});

type Input = z.infer<typeof schema>;

export const createContainerMkdirTool: ToolFactory<
	Input,
	undefined
> = (): Tool<Input> => ({
	name: TOOL_NAME,
	description: "Create a directory in the container virtual filesystem.",
	schema,
	execute: async (input) => {
		const result = await sandboxContainerService.mkdir({
			path: input.path,
			recursive: input.recursive ?? true,
		});
		return JSON.stringify(result, null, 2);
	},
});

toolRegistry.register(TOOL_NAME, createContainerMkdirTool);

declare global {
	interface ToolTypeRegistry {
		[TOOL_NAME]: {
			input: Input;
			services: undefined;
		};
	}
}
