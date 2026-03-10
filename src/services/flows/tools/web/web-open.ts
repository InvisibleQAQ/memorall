import z from "zod";
import type { Tool, ToolFactory } from "@/services/flows/interfaces/tool";
import {
	closeWebSession,
	createDefaultWebErrorResult,
	createWebResult,
	openWebSession,
} from "./web-tool-registry";
import { toolRegistry } from "@/services/flows/tool-registry";

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

export const createWebOpenTool: ToolFactory<
	Input,
	undefined
> = (): Tool<Input> => ({
	name: TOOL_NAME,
	description:
		"Open a web URL in `iframe` or browser-backed `tab`/`window` mode, wait for the initial navigation load, and expose `sessionId` for follow-up actions. Use `web_wait` for SPA/render waits and `web_read` to retrieve page content.",
	schema,
	execute: async (input) => {
		let disposableSessionId: string | undefined;
		try {
			const { session, disposable, renderReady } = await openWebSession({
				url: input.url,
				timeoutMs: input.timeoutMs ?? 15_000,
				maxHtmlChars: input.maxHtmlChars ?? 160_000,
				persist: input.keepSession ?? true,
				mode: input.browserMode,
			});
			if (disposable) {
				disposableSessionId = session.id;
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
				renderReady,
			});
		} catch (error) {
			return createDefaultWebErrorResult(error);
		} finally {
			if (disposableSessionId) {
				await closeWebSession(disposableSessionId);
			}
		}
	},
});

toolRegistry.register(TOOL_NAME, createWebOpenTool);

declare global {
	interface ToolTypeRegistry {
		[TOOL_NAME]: {
			input: Input;
			services: undefined;
		};
	}
}
