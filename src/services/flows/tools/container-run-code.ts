import z from "zod";
import type { Tool, ToolFactory } from "../interfaces/tool";
import { toolRegistry } from "../tool-registry";
import { sandboxContainerService } from "@/services/sandbox-container";

const TOOL_NAME = "container_run_code" as const;

const schema = z.object({
	code: z.string().min(1).describe("JavaScript/TypeScript code to run."),
	filename: z
		.string()
		.optional()
		.describe("Optional virtual filename for better stack traces."),
	timeoutMs: z
		.number()
		.min(10)
		.max(120_000)
		.optional()
		.describe("Execution timeout in milliseconds (default 5000)."),
	maxLogEntries: z
		.number()
		.min(1)
		.max(500)
		.optional()
		.describe("Maximum number of captured console logs (default 50)."),
});

type Input = z.infer<typeof schema>;

export const createContainerRunCodeTool: ToolFactory<
	Input,
	undefined
> = (): Tool<Input> => ({
	name: TOOL_NAME,
	description:
		"Run code in the sandbox container runtime and return structured result with logs.",
	schema,
	execute: async (input) => {
		const result = await sandboxContainerService.executeCode({
			code: input.code,
			filename: input.filename,
			timeoutMs: input.timeoutMs ?? 5_000,
			maxLogEntries: input.maxLogEntries ?? 50,
		});
		return JSON.stringify(result, null, 2);
	},
});

toolRegistry.register(TOOL_NAME, createContainerRunCodeTool);

declare global {
	interface ToolTypeRegistry {
		[TOOL_NAME]: {
			input: Input;
			services: undefined;
		};
	}
}
