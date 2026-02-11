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

const normalizeClientUrl = (rawUrl: string): string => {
	const parsed = new URL(rawUrl);
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
		const resolvedUrl = normalizeClientUrl(input.url);
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
