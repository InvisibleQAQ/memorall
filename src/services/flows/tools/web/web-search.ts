import z from "zod";
import type { Tool, ToolFactory } from "@/services/flows/interfaces/tool";
import { toolRegistry } from "@/services/flows/tool-registry";
import {
	createDefaultWebErrorResult,
	createWebResult,
	getOrOpenWebSession,
	closeWebSession,
	searchInSessionHtml,
	refreshWebSession,
} from "./web-tool-registry";

const TOOL_NAME = "web_search" as const;

const schema = z.object({
	sessionId: z.string().optional().describe("Active web session to search."),
	url: z.string().url().optional().describe("Open first, then search. Use with no sessionId."),
	query: z.string().min(1).describe("Text to search in page text content."),
	selector: z
		.string()
		.optional()
		.describe("Optional selector to limit search scope."),
	isRegex: z
		.boolean()
		.optional()
		.describe("Treat query as regular expression."),
	caseSensitive: z
		.boolean()
		.optional()
		.describe("Case-sensitive text matching (default false)."),
	maxMatches: z
		.number()
		.int()
		.min(1)
		.max(50)
		.optional()
		.describe("Maximum matches to return."),
	maxSnippetChars: z
		.number()
		.int()
		.min(20)
		.max(500)
		.optional()
		.describe("Max characters returned per match snippet."),
	timeoutMs: z
		.number()
		.int()
		.min(500)
		.max(180_000)
		.optional()
		.describe("Navigation/load timeout used when opening by URL."),
});

type Input = z.infer<typeof schema>;
type SearchResult = Awaited<ReturnType<typeof searchInSessionHtml>>;

export const createWebSearchTool: ToolFactory<Input, undefined> = (): Tool<
	Input
> => ({
	name: TOOL_NAME,
	description:
		"Search rendered page HTML by text/regex inside active session or URL-based temporary session.",
	schema,
	execute: async (input) => {
		let shouldCloseSession = false;
		let sessionId: string | undefined;
		try {
			const { session, disposable } = await getOrOpenWebSession({
				sessionId: input.sessionId,
				url: input.url,
				timeoutMs: input.timeoutMs ?? 15_000,
			});
			sessionId = session.id;
			shouldCloseSession = disposable;

			refreshWebSession(session.id);

			const matches: SearchResult = await searchInSessionHtml({
				session,
				pattern: input.query,
				selector: input.selector,
				isRegex: input.isRegex ?? false,
				caseSensitive: input.caseSensitive ?? false,
				maxMatches: input.maxMatches ?? 10,
				maxSnippetChars: input.maxSnippetChars ?? 180,
			});

			const result = createWebResult({
				actionType: "web_search",
				success: true,
				sessionId: session.id,
				url: session.currentUrl,
				query: input.query,
				selector: input.selector,
				matches,
				count: matches.length,
			});
			if (shouldCloseSession) {
				closeWebSession(session.id);
			}
			return result;
		} catch (error) {
			return createDefaultWebErrorResult(error);
		} finally {
			if (shouldCloseSession && sessionId) {
				closeWebSession(sessionId);
			}
		}
	},
});

toolRegistry.register(TOOL_NAME, createWebSearchTool);

declare global {
	interface ToolTypeRegistry {
		[TOOL_NAME]: {
			input: Input;
			services: undefined;
		};
	}
}
