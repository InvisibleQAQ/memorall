import z from "zod";
import { serviceManager } from "@/services";
import type { Tool, ToolFactory } from "@/services/flows/interfaces/tool";
import { toolRegistry } from "@/services/flows/tool-registry";

const TOOL_NAME = "container_list_servers" as const;

const schema = z.object({});

type Input = z.infer<typeof schema>;

export const createContainerListServersTool: ToolFactory<
	Input,
	undefined
> = (): Tool<Input> => ({
	name: TOOL_NAME,
	description: "List all running sandbox servers.",
	schema,
	execute: async () => {
		const sandboxContainerService = serviceManager.getSandboxContainerService();
		const result = await sandboxContainerService.listServers();
		return JSON.stringify(result, null, 2);
	},
});

toolRegistry.register(TOOL_NAME, createContainerListServersTool);

declare global {
	interface ToolTypeRegistry {
		[TOOL_NAME]: {
			input: Input;
			services: undefined;
		};
	}
}
