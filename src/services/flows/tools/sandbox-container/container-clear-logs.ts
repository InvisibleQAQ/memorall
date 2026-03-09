import z from "zod";
import { serviceManager } from "@/services";
import type { Tool, ToolFactory } from "@/services/flows/interfaces/tool";
import { toolRegistry } from "@/services/flows/tool-registry";

const TOOL_NAME = "container_clear_logs" as const;

const schema = z.object({});

type Input = z.infer<typeof schema>;

export const createContainerClearLogsTool: ToolFactory<
	Input,
	undefined
> = (): Tool<Input> => ({
	name: TOOL_NAME,
	description: "Clear sandbox container logs.",
	schema,
	execute: async () => {
		const sandboxContainerService = serviceManager.getSandboxContainerService();
		const result = await sandboxContainerService.clearLogs();
		return JSON.stringify(result, null, 2);
	},
});

toolRegistry.register(TOOL_NAME, createContainerClearLogsTool);

declare global {
	interface ToolTypeRegistry {
		[TOOL_NAME]: {
			input: Input;
			services: undefined;
		};
	}
}
