import z from "zod";
import type { Tool, ToolFactory } from "@/services/flows/interfaces/tool";
import { toolRegistry } from "@/services/flows/tool-registry";
import { sandboxContainerService } from "@/services/sandbox-container";

const TOOL_NAME = "container_start_server" as const;

const schema = z.object({
	kind: z.enum(["express", "vite", "next"]).describe("Server framework kind."),
	port: z.number().int().min(1).max(65535).describe("Server port."),
	hostname: z
		.string()
		.optional()
		.describe("Optional hostname (default runtime value)."),
	rootDir: z.string().optional().describe("Optional project root path."),
	entryPath: z.string().optional().describe("Entry path for express mode."),
});

type Input = z.infer<typeof schema>;

export const createContainerStartServerTool: ToolFactory<
	Input,
	undefined
> = (): Tool<Input> => ({
	name: TOOL_NAME,
	description:
		"Start a sandbox server (Express, Vite, or Next) and return its mapped URL.",
	schema,
	execute: async (input) => {
		try {
			const result = await sandboxContainerService.startServer({
				kind: input.kind,
				port: input.port,
				hostname: input.hostname,
				rootDir: input.rootDir,
				entryPath: input.entryPath,
			});
			return JSON.stringify(
				{
					success: true,
					...result,
				},
				null,
				2,
			);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);

			return JSON.stringify(
				{
					success: false,
					kind: input.kind,
					port: input.port,
					entryPath: input.entryPath,
					error: message,
				},
				null,
				2,
			);
		}
	},
});

toolRegistry.register(TOOL_NAME, createContainerStartServerTool);

declare global {
	interface ToolTypeRegistry {
		[TOOL_NAME]: {
			input: Input;
			services: undefined;
		};
	}
}
