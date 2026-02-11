import z from "zod";
import type { Tool, ToolFactory } from "@/services/flows/interfaces/tool";
import { toolRegistry } from "@/services/flows/tool-registry";
import { sandboxContainerService } from "@/services/sandbox-container";

const TOOL_NAME = "container_write_file" as const;

const schema = z.object({
	path: z
		.string()
		.min(1)
		.describe(
			"Virtual path (absolute or relative, e.g. /src/index.ts or src/index.ts).",
		),
	content: z.string().describe("File content to write."),
});

type Input = z.infer<typeof schema>;

export const createContainerWriteFileTool: ToolFactory<
	Input,
	undefined
> = (): Tool<Input> => ({
	name: TOOL_NAME,
	description: "Write file content to the container virtual filesystem.",
	schema,
	execute: async (input) => {
		const result = await sandboxContainerService.writeFile(input);
		return JSON.stringify(result, null, 2);
	},
});

toolRegistry.register(TOOL_NAME, createContainerWriteFileTool);

declare global {
	interface ToolTypeRegistry {
		[TOOL_NAME]: {
			input: Input;
			services: undefined;
		};
	}
}
