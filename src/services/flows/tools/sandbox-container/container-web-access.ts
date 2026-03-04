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

type NormalizedTarget =
	| { kind: "server"; port: number; path: string }
	| { kind: "fetch"; url: string };

const localhostHosts = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::"]);

/**
 * Resolve the URL to either a direct server.request (by port+path, routed
 * internally by AlmostNode) or a plain network.fetch.
 *
 * Virtual URLs (/__virtual__/<port>/...) and localhost:<port> URLs that match
 * a running sandbox server are routed via server.request so that AlmostNode
 * can handle the request in-memory — bypassing the browser fetch + service
 * worker path entirely.
 */
const resolveTarget = async (rawUrl: string): Promise<NormalizedTarget> => {
	let parsed: URL;
	try {
		parsed = new URL(rawUrl);
	} catch {
		return { kind: "fetch", url: rawUrl };
	}

	// chrome-extension://id/__virtual__/<port>/path  or  /__virtual__/<port>/path
	const virtualMatch = parsed.pathname.match(/^\/__virtual__\/(\d+)(\/.*)?$/);
	if (virtualMatch) {
		const port = Number(virtualMatch[1]);
		const path = virtualMatch[2] || "/";
		if (!Number.isNaN(port)) {
			return { kind: "server", port, path: `${path}${parsed.search}${parsed.hash}` };
		}
	}

	// localhost / 127.0.0.1 — match against a running sandbox server
	if (localhostHosts.has(parsed.hostname) && parsed.port) {
		const port = Number(parsed.port);
		if (!Number.isNaN(port)) {
			const servers = await sandboxContainerService.listServers();
			const matched = servers.servers.find((s) => s.port === port);
			if (matched) {
				const path = `${parsed.pathname || "/"}${parsed.search}${parsed.hash}`;
				return { kind: "server", port, path };
			}
		}
	}

	// Normalise bind addresses for external fetch
	if (parsed.hostname === "0.0.0.0" || parsed.hostname === "::") {
		parsed.hostname = "127.0.0.1";
	}
	return { kind: "fetch", url: parsed.toString() };
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
		const target = await resolveTarget(input.url);
		try {
			let status: number;
			let ok: boolean;
			let contentType: string;
			let body: string;

			if (target.kind === "server") {
				const result = await sandboxContainerService.requestServer({
					port: target.port,
					path: target.path,
					method: "GET",
					timeoutMs: input.timeoutMs ?? 15_000,
					responseType: "html",
				});
				status = result.status;
				ok = result.ok;
				contentType = result.contentType;
				body = result.body;
			} else {
				const result = await sandboxContainerService.fetchResource({
					url: target.url,
					method: "GET",
					timeoutMs: input.timeoutMs ?? 15_000,
					responseType: "html",
				});
				status = result.status;
				ok = result.ok;
				contentType = result.contentType;
				body = result.body;
			}

			const maxChars = input.maxHtmlChars ?? 100_000;
			const html = body.slice(0, maxChars);

			return JSON.stringify(
				{
					actionType: "web_access",
					success: true,
					requestedUrl: input.url,
					url: input.url,
					status,
					ok,
					contentType,
					html,
					truncated: body.length > html.length,
					originalLength: body.length,
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
					url: input.url,
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
