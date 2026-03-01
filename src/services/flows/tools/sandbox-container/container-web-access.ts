import z from "zod";
import type { Tool, ToolFactory } from "@/services/flows/interfaces/tool";
import { toolRegistry } from "@/services/flows/tool-registry";
import { sandboxContainerService } from "@/services/sandbox-container";

const TOOL_NAME = "container_web_access" as const;

const schema = z.object({
	url: z
		.string()
		.url()
		.describe("URL to access (local sandbox server or remote)."),
	timeoutMs: z
		.number()
		.int()
		.min(1)
		.max(120_000)
		.optional()
		.describe("Request timeout in milliseconds (default 15000)."),
	maxHtmlChars: z
		.number()
		.int()
		.min(256)
		.max(500_000)
		.optional()
		.describe("Maximum HTML characters returned (default 100000)."),
});

type Input = z.infer<typeof schema>;

const normalizeClientUrl = async (rawUrl: string): Promise<string> => {
	const parsed = new URL(rawUrl);

	// Virtual server routes are safest as same-origin relative paths.
	// Using chrome-extension://<id>/__virtual__/... can fail depending on context.
	if (parsed.pathname.startsWith("/__virtual__/")) {
		const normalizedPath = /\/$/.test(parsed.pathname)
			? parsed.pathname
			: `${parsed.pathname}/`;
		return `${normalizedPath}${parsed.search}${parsed.hash}`;
	}

	const localhostLikeHosts = new Set([
		"localhost",
		"127.0.0.1",
		"0.0.0.0",
		"::",
	]);
	if (localhostLikeHosts.has(parsed.hostname) && parsed.port) {
		const port = Number(parsed.port);
		if (!Number.isNaN(port)) {
			const servers = await sandboxContainerService.listServers();
			const matched = servers.servers.find((server) => server.port === port);
			if (matched) {
				const requestedPath = `${parsed.pathname || "/"}${parsed.search || ""}${parsed.hash || ""}`;
				const render = await sandboxContainerService.getServerRenderUrl({
					port,
					path: requestedPath || "/",
				});
				return render.url;
			}
		}
	}

	// 0.0.0.0 / :: are bind addresses, not client-routable for fetch/iframe.
	if (parsed.hostname === "0.0.0.0" || parsed.hostname === "::") {
		parsed.hostname = "127.0.0.1";
	}
	return parsed.toString();
};

export const createContainerWebAccessTool: ToolFactory<
	Input,
	undefined
> = (): Tool<Input> => ({
	name: TOOL_NAME,
	description:
		"Access a web URL (including started Next/Vite sandbox servers) and return HTML content for browser-like preview.",
	schema,
	execute: async (input) => {
		const resolvedUrl = await normalizeClientUrl(input.url);
		try {
			const result = await sandboxContainerService.fetchResource({
				url: resolvedUrl,
				method: "GET",
				timeoutMs: input.timeoutMs ?? 15_000,
				responseType: "html",
			});

			const maxChars = input.maxHtmlChars ?? 100_000;
			const html = result.body.slice(0, maxChars);

			return JSON.stringify(
				{
					actionType: "web_access",
					success: true,
					requestedUrl: input.url,
					url: resolvedUrl,
					status: result.status,
					ok: result.ok,
					contentType: result.contentType,
					html,
					truncated: result.body.length > html.length,
					originalLength: result.body.length,
				},
				null,
				2,
			);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return JSON.stringify(
				{
					actionType: "web_access",
					success: false,
					requestedUrl: input.url,
					url: resolvedUrl,
					error: message,
				},
				null,
				2,
			);
		}
	},
});

toolRegistry.register(TOOL_NAME, createContainerWebAccessTool);

declare global {
	interface ToolTypeRegistry {
		[TOOL_NAME]: {
			input: Input;
			services: undefined;
		};
	}
}
