import z from "zod";
import type { Tool, ToolFactory } from "@/services/flows/interfaces/tool";
import { toolRegistry } from "@/services/flows/tool-registry";
import { sandboxContainerService } from "@/services/sandbox-container";

const TOOL_NAME = "container_read_file" as const;

const schema = z.object({
	path: z.string().min(1).describe("Absolute virtual path to read."),
});

type Input = z.infer<typeof schema>;

export const createContainerReadFileTool: ToolFactory<
	Input,
	undefined
> = (): Tool<Input> => ({
	name: TOOL_NAME,
	description: "Read file content from the container virtual filesystem.",
	schema,
	execute: async (input) => {
		const result = await sandboxContainerService.readFile(input);
		return JSON.stringify(result, null, 2);
	},
});

toolRegistry.register(TOOL_NAME, createContainerReadFileTool);

declare global {
	interface ToolTypeRegistry {
		[TOOL_NAME]: {
			input: Input;
			services: undefined;
		};
	}
}
