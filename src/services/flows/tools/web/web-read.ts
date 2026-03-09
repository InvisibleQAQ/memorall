import z from "zod";
import type { Tool, ToolFactory } from "@/services/flows/interfaces/tool";
import { toolRegistry } from "@/services/flows/tool-registry";
import {
	createDefaultWebErrorResult,
	createWebResult,
	getOrOpenWebSession,
	closeWebSession,
	queryDomElements,
	refreshWebSession,
	fetchRenderedFallback,
} from "./web-tool-registry";

const TOOL_NAME = "web_read" as const;

const schema = z.object({
	sessionId: z.string().optional().describe("Active web session to read."),
	url: z.string().url().optional().describe("Open first, then read. Use with no sessionId."),
	maxHtmlChars: z
		.number()
		.int()
		.min(1024)
		.max(500_000)
		.optional()
		.describe("Limit HTML length returned to the agent."),
	timeoutMs: z
		.number()
		.int()
		.min(500)
		.max(180_000)
		.optional()
		.describe("Navigation/load timeout used when opening by URL."),
	selector: z
		.string()
		.optional()
		.describe("Optional selector for a focused read."),
});

type Input = z.infer<typeof schema>;

const readBySelector = (
	sessionId: string,
	selector: string,
): ReturnType<typeof createWebResult> => {
	const session = refreshWebSession(sessionId);
	const elements = queryDomElements(session, selector, 10).map((entry, index) => ({
		index,
		...entry,
	}));
	return createWebResult({
		actionType: "web_read",
		success: true,
		sessionId: session.id,
		url: session.currentUrl,
		title: session.title,
		domAccessible: session.domAccessible,
		html: session.html,
		elements,
	});
};

export const createWebReadTool: ToolFactory<Input, undefined> = (): Tool<Input> => ({
	name: TOOL_NAME,
	description:
		"Read rendered HTML/text from an active web session or directly from a URL.",
	schema,
	execute: async (input) => {
		let disposableSession = false;
		let sessionId = input.sessionId;
		try {
			const sessionResult = await getOrOpenWebSession({
				sessionId: input.sessionId,
				url: input.url,
				timeoutMs: input.timeoutMs ?? 15_000,
				maxHtmlChars: input.maxHtmlChars ?? 160_000,
			});
			disposableSession = sessionResult.disposable;
			sessionId = sessionResult.session.id;
			const session = refreshWebSession(
				sessionId,
				input.maxHtmlChars ?? 160_000,
			);
			if (!session.domAccessible) {
				const fallback = await fetchRenderedFallback({
					url: session.requestedUrl,
					timeoutMs: input.timeoutMs ?? 15_000,
					maxHtmlChars: input.maxHtmlChars ?? 160_000,
				});
				return createWebResult({
					actionType: "web_read",
					success: true,
					sessionId: session.id,
					url: fallback.currentUrl,
					title: fallback.title,
					domAccessible: false,
					fallback: "network",
					html: fallback.html,
					text: fallback.text,
				});
			}

			if (input.selector) {
				return readBySelector(sessionId, input.selector);
			}

			return createWebResult({
				actionType: "web_read",
				success: true,
				sessionId: session.id,
				url: session.currentUrl,
				title: session.title,
				domAccessible: session.domAccessible,
				html: session.html,
				text: session.text,
			});
		} catch (error) {
			return createDefaultWebErrorResult(error);
		} finally {
			if (disposableSession && sessionId) {
				closeWebSession(sessionId);
			}
		}
	},
});

toolRegistry.register(TOOL_NAME, createWebReadTool);

declare global {
	interface ToolTypeRegistry {
		[TOOL_NAME]: {
			input: Input;
			services: undefined;
		};
	}
}
