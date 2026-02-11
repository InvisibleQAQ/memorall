import z from "zod";
import type { Tool, ToolFactory } from "@/services/flows/interfaces/tool";
import { toolRegistry } from "@/services/flows/tool-registry";
import { sandboxContainerService } from "@/services/sandbox-container";

const TOOL_NAME = "container_rename" as const;

const schema = z.object({
	oldPath: z
		.string()
		.min(1)
		.describe("Current virtual path (absolute or relative)."),
	newPath: z
		.string()
		.min(1)
		.describe("New virtual path (absolute or relative)."),
});

type Input = z.infer<typeof schema>;

export const createContainerRenameTool: ToolFactory<
	Input,
	undefined
> = (): Tool<Input> => ({
	name: TOOL_NAME,
	description: "Rename/move a path in the container filesystem.",
	schema,
	execute: async (input) => {
		const result = await sandboxContainerService.rename(input);
		return JSON.stringify(result, null, 2);
	},
});

toolRegistry.register(TOOL_NAME, createContainerRenameTool);

declare global {
	interface ToolTypeRegistry {
		[TOOL_NAME]: {
			input: Input;
			services: undefined;
		};
	}
}
