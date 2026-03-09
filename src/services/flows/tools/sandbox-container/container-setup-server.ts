import z from "zod";
import type {
	AllServices,
	Tool,
	ToolFactory,
} from "@/services/flows/interfaces/tool";
import { toolRegistry } from "@/services/flows/tool-registry";
import type { SandboxServerKind } from "@/services/sandbox-container";

const TOOL_NAME = "container_setup_server" as const;

/**
 * Template → server kind mapping.
 * Keeps the agent API simple: one field describes both the template and
 * the runtime type.
 */
const TEMPLATE_KIND: Record<string, SandboxServerKind> = {
	express: "express",
	"vite-react": "vite",
	"next-pages": "next",
	"next-app": "next",
};

/** Sensible default port per template. */
const TEMPLATE_DEFAULT_PORT: Record<string, number> = {
	express: 3000,
	"vite-react": 5173,
	"next-pages": 3000,
	"next-app": 3000,
};

const schema = z.object({
	template: z
		.enum(["express", "vite-react", "next-pages", "next-app"])
		.describe(
			"Framework template to scaffold, install, and start in one step. " +
				'"express" – Express.js app with JSON API routes; ' +
				'"vite-react" – Vite + React SPA; ' +
				'"next-pages" – Next.js Pages Router; ' +
				'"next-app" – Next.js App Router.',
		),
	port: z
		.number()
		.int()
		.min(1)
		.max(65535)
		.optional()
		.describe(
			"Port to listen on. Defaults: express=3000, vite-react=5173, next=3000.",
		),
	rootDir: z
		.string()
		.optional()
		.describe(
			'VFS root directory for the project (default "/app"). ' +
				"Scaffold files are written here.",
		),
	previewPath: z
		.string()
		.optional()
		.describe(
			"URL path to open in the preview iframe after start (default '/').",
		),
});

type Input = z.infer<typeof schema>;
type Services = Pick<AllServices, "sandboxContainer">;

export const createContainerSetupServerTool: ToolFactory<Input, Services> = (
	services,
): Tool<Input> => ({
	name: TOOL_NAME,
	description:
		"One-shot setup: scaffold a starter project, npm-install, start the server, " +
		"and return an iframe preview URL — all in a single call. " +
		"Ideal for Vite+React, Next.js Pages Router, Next.js App Router, and Express.",
	schema,
	execute: async (input) => {
		if (!services.sandboxContainer) {
			return 'Sanbox container is not avaible'
		}
		const kind = TEMPLATE_KIND[input.template];
		const port = input.port ?? TEMPLATE_DEFAULT_PORT[input.template] ?? 3000;
		const rootDir = input.rootDir ?? "/app";
		const previewPath = input.previewPath ?? "/";

		try {
			// Scaffold + install + start (template flag enables autoInstall by default).
			const serverResult = await services.sandboxContainer.startServer({
				kind,
				port,
				rootDir,
				template: input.template,
				autoInstall: true,
			});

			// Fetch the render URL so the iframe preview appears immediately in chat.
			const renderResult = await services.sandboxContainer.getServerRenderUrl({
				port,
				path: previewPath,
			});

			return JSON.stringify(
				{
					actionType: "web_access",
					url: renderResult.url,
					port: serverResult.port,
					kind: serverResult.kind,
					template: input.template,
					rootDir,
					renderUrl: serverResult.renderUrl,
					previewPath,
				},
				null,
				2,
			);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return JSON.stringify(
				{
					success: false,
					template: input.template,
					kind,
					port,
					rootDir,
					error: message,
				},
				null,
				2,
			);
		}
	},
});

toolRegistry.register(TOOL_NAME, createContainerSetupServerTool);

declare global {
	interface ToolTypeRegistry {
		[TOOL_NAME]: {
			input: Input;
			services: Services;
		};
	}
}
