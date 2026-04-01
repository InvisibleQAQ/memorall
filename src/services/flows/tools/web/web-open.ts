import z from "zod";
import type { Tool, ToolFactory } from "@/services/flows/interfaces/tool";
import { toolRegistry } from "@/services/flows/tool-registry";
import {
	createCleanHtml,
	createDefaultWebErrorResult,
	createWebResult,
	truncateContent,
	requireWebBrowserService,
	type WebToolServices,
} from "./web-tool-utils";

const TOOL_NAME = "web_open" as const;

const schema = z.object({
	url: z.string().url().describe("Target web URL to open."),
	browserMode: z
		.enum(["iframe", "tab", "window"])
		.optional()
		.describe(
			"Open mode. `iframe` uses offscreen embedding; `tab`/`window` use browser-backed page access.",
		),
	timeoutMs: z
		.number()
		.int()
		.min(500)
		.max(180_000)
		.optional()
		.describe("Navigation wait timeout in milliseconds."),
	maxHtmlChars: z
		.number()
		.int()
		.min(1024)
		.max(500_000)
		.optional()
		.describe("Limit HTML length returned to the agent."),
	keepSession: z
		.boolean()
		.optional()
		.describe("Keep session alive for follow-up DOM actions (default true)."),
});

type Input = z.infer<typeof schema>;

export const createWebOpenTool: ToolFactory<Input, WebToolServices> = (
	services,
): Tool<Input> => ({
	name: TOOL_NAME,
	description:
		"Open a web URL in `iframe` or browser-backed `tab`/`window` mode, wait for the initial navigation load, and expose `sessionId` for follow-up actions. When `renderReady` is false the page timed out but partial content is included — inspect `partialContent` to decide whether to call `web_wait` then `web_read`, or skip this page.",
	schema,
	execute: async (input) => {
		const webBrowser = requireWebBrowserService(services);
		const maxHtmlChars = input.maxHtmlChars ?? 160_000;
		let disposableSessionId: string | undefined;
		try {
			const { session, disposable, renderReady } = await webBrowser.openSession(
				{
					url: input.url,
					timeoutMs: input.timeoutMs ?? 15_000,
					maxHtmlChars,
					persist: input.keepSession ?? true,
					mode: input.browserMode,
				},
			);
			if (disposable) {
				disposableSessionId = session.id;
			}

			if (!renderReady) {
				const cleanHtml = truncateContent(
					createCleanHtml(session.html),
					maxHtmlChars,
				);
				return createWebResult({
					actionType: "web_open",
					success: true,
					sessionId: session.id,
					requestedUrl: input.url,
					url: session.currentUrl,
					title: session.title,
					domAccessible: session.domAccessible,
					browserMode: session.mode,
					renderReady: false,
					partialContent: cleanHtml || null,
					hint: "Page load timed out. partialContent shows what loaded so far. Call web_wait (waitMode=\"render\") then web_read to get more content, or skip this page if partialContent is empty.",
				});
			}

			return createWebResult({
				actionType: "web_open",
				success: true,
				sessionId: session.id,
				requestedUrl: input.url,
				url: session.currentUrl,
				title: session.title,
				domAccessible: session.domAccessible,
				browserMode: session.mode,
				renderReady: true,
			});
		} catch (error) {
			return createDefaultWebErrorResult(error);
		} finally {
			if (disposableSessionId) {
				await webBrowser.closeSession(disposableSessionId);
			}
		}
	},
});

toolRegistry.register(TOOL_NAME, createWebOpenTool);

declare global {
	interface ToolTypeRegistry {
		[TOOL_NAME]: {
			input: Input;
			services: WebToolServices;
		};
	}
}
