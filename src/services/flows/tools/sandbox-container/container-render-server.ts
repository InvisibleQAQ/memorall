import z from "zod";
import type { Tool, ToolFactory } from "@/services/flows/interfaces/tool";
import { toolRegistry } from "@/services/flows/tool-registry";
import { sandboxContainerService } from "@/services/sandbox-container";

const TOOL_NAME = "container_render_server" as const;

const schema = z.object({
	port: z.number().int().min(1).max(65535).describe("Target server port."),
	path: z
		.string()
		.optional()
		.describe("Optional render path inside server (default '/')."),
});

type Input = z.infer<typeof schema>;

export const createContainerRenderServerTool: ToolFactory<
	Input,
	undefined
> = (): Tool<Input> => ({
	name: TOOL_NAME,
	description:
		"Get a virtual render URL for a started sandbox server. Returned URL can be opened in iframe.",
	schema,
	execute: async (input) => {
		const result = await sandboxContainerService.getServerRenderUrl({
			port: input.port,
			path: input.path ?? "/",
		});

		return JSON.stringify(
			{
				actionType: "web_access",
				port: result.port,
				requestedPath: input.path ?? "/",
				url: result.url,
			},
			null,
			2,
		);
	},
});

toolRegistry.register(TOOL_NAME, createContainerRenderServerTool);

declare global {
	interface ToolTypeRegistry {
		[TOOL_NAME]: {
			input: Input;
			services: undefined;
		};
	}
}
