import z from "zod";
import type { Tool, ToolFactory } from "../interfaces/tool";
import { toolRegistry } from "../tool-registry";
import { sandboxContainerService } from "@/services/sandbox-container";

const TOOL_NAME = "container_stop_server" as const;

const schema = z.object({
	port: z.number().int().min(1).max(65535).describe("Port of the server to stop."),
});

type Input = z.infer<typeof schema>;

export const createContainerStopServerTool: ToolFactory<
	Input,
	undefined
> = (): Tool<Input> => ({
	name: TOOL_NAME,
	description: "Stop a running sandbox server by port.",
	schema,
	execute: async (input) => {
		const result = await sandboxContainerService.stopServer({
			port: input.port,
		});
		return JSON.stringify(result, null, 2);
	},
});

toolRegistry.register(TOOL_NAME, createContainerStopServerTool);

declare global {
	interface ToolTypeRegistry {
		[TOOL_NAME]: {
			input: Input;
			services: undefined;
		};
	}
}
