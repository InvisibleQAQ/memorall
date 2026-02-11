import z from "zod";
import type { Tool, ToolFactory } from "@/services/flows/interfaces/tool";
import { toolRegistry } from "@/services/flows/tool-registry";
import { sandboxContainerService } from "@/services/sandbox-container";

const TOOL_NAME = "container_exists" as const;

const schema = z.object({
	path: z
		.string()
		.min(1)
		.describe("Virtual path to check (absolute or relative)."),
});

type Input = z.infer<typeof schema>;

export const createContainerExistsTool: ToolFactory<
	Input,
	undefined
> = (): Tool<Input> => ({
	name: TOOL_NAME,
	description: "Check whether a file or directory exists in container FS.",
	schema,
	execute: async (input) => {
		const result = await sandboxContainerService.exists(input);
		return JSON.stringify(result, null, 2);
	},
});

toolRegistry.register(TOOL_NAME, createContainerExistsTool);

declare global {
	interface ToolTypeRegistry {
		[TOOL_NAME]: {
			input: Input;
			services: undefined;
		};
	}
}
