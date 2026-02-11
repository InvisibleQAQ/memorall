import z from "zod";
import type { Tool, ToolFactory } from "@/services/flows/interfaces/tool";
import { toolRegistry } from "@/services/flows/tool-registry";
import { sandboxContainerService } from "@/services/sandbox-container";

const TOOL_NAME = "container_unlink" as const;

const schema = z.object({
	path: z
		.string()
		.min(1)
		.describe("Virtual path to delete (absolute or relative)."),
});

type Input = z.infer<typeof schema>;

export const createContainerUnlinkTool: ToolFactory<
	Input,
	undefined
> = (): Tool<Input> => ({
	name: TOOL_NAME,
	description: "Delete a file/path from the container filesystem.",
	schema,
	execute: async (input) => {
		const result = await sandboxContainerService.unlink(input);
		return JSON.stringify(result, null, 2);
	},
});

toolRegistry.register(TOOL_NAME, createContainerUnlinkTool);

declare global {
	interface ToolTypeRegistry {
		[TOOL_NAME]: {
			input: Input;
			services: undefined;
		};
	}
}
