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
	template: z
		.enum(["express", "vite-react", "next-pages", "next-app"])
		.optional()
		.describe(
			"Scaffold a starter template into rootDir before starting the server. " +
				'"express" – Express app with API routes; ' +
				'"vite-react" – Vite + React; ' +
				'"next-pages" – Next.js Pages Router; ' +
				'"next-app" – Next.js App Router.',
		),
	autoInstall: z
		.boolean()
		.optional()
		.describe(
			"Run npm install from package.json after scaffolding (default true when template is set).",
		),
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
				template: input.template,
				autoInstall: input.autoInstall,
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
