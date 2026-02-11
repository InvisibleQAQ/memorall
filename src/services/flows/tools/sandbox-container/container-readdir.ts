import z from "zod";
import type { Tool, ToolFactory } from "@/services/flows/interfaces/tool";
import { toolRegistry } from "@/services/flows/tool-registry";
import { sandboxContainerService } from "@/services/sandbox-container";

const TOOL_NAME = "container_readdir" as const;

const schema = z.object({
	path: z.string().min(1).describe("Absolute virtual directory path."),
});

type Input = z.infer<typeof schema>;

export const createContainerReaddirTool: ToolFactory<
	Input,
	undefined
> = (): Tool<Input> => ({
	name: TOOL_NAME,
	description: "List entries in a container directory.",
	schema,
	execute: async (input) => {
		const result = await sandboxContainerService.readdir(input);
		return JSON.stringify(result, null, 2);
	},
});

toolRegistry.register(TOOL_NAME, createContainerReaddirTool);

declare global {
	interface ToolTypeRegistry {
		[TOOL_NAME]: {
			input: Input;
			services: undefined;
		};
	}
}
