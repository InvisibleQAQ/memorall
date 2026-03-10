import z from "zod";
import sanitizeHtml from "sanitize-html";
import type { Tool, ToolFactory } from "@/services/flows/interfaces/tool";
import { toolRegistry } from "@/services/flows/tool-registry";
import {
	createDefaultWebErrorResult,
	createWebResult,
	getOrOpenWebSession,
	closeWebSession,
	fetchRenderedFallback,
} from "./web-tool-registry";

const TOOL_NAME = "web_read" as const;
const CONTENT_MODE_VALUES = [
	"text",
	"structure_text",
	"html",
	"clean_html",
] as const;
type ContentMode = (typeof CONTENT_MODE_VALUES)[number];
type NormalizedContentMode = "text" | "html" | "clean_html";

const schema = z.object({
	sessionId: z.string().optional().describe("Active web session to read."),
	url: z
		.string()
		.url()
		.optional()
		.describe("Open first, then read. Use with no sessionId."),
	browserMode: z
		.enum(["iframe", "tab", "window"])
		.optional()
		.describe("Open mode when no sessionId is provided."),
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
	contentMode: z
		.enum(CONTENT_MODE_VALUES)
		.optional()
		.describe(
			"Content format. Default is `text`. `text` returns readable page text, `html` returns rendered HTML, `clean_html` returns HTML with tags only and no attributes/scripts/styles.",
		),
});

type Input = z.infer<typeof schema>;

const parseHtml = (html: string): Document =>
	new DOMParser().parseFromString(
		html || "<html><body></body></html>",
		"text/html",
	);

const truncateContent = (value: string, maxChars: number): string => {
	if (value.length <= maxChars) {
		return value;
	}
	return `${value.slice(0, maxChars)}\n...truncated`;
};

const normalizeContentMode = (
	contentMode: ContentMode,
): NormalizedContentMode =>
	contentMode === "structure_text" ? "text" : contentMode;

const createCleanHtml = (html: string): string => {
	return sanitizeHtml(html, {
		allowedTags: false,
		allowedAttributes: {},
		disallowedTagsMode: "discard",
		exclusiveFilter: (frame) =>
			frame.tag === "script" ||
			frame.tag === "style" ||
			frame.tag === "noscript" ||
			frame.tag === "link",
	});
};

const extractSelectorHtml = (
	html: string,
	selector: string,
	maxMatches = 10,
): { html: string; matchCount: number } => {
	const document = parseHtml(html);
	const matchedElements = Array.from(document.querySelectorAll(selector)).slice(
		0,
		maxMatches,
	);
	return {
		html: matchedElements.map((element) => element.outerHTML).join("\n"),
		matchCount: matchedElements.length,
	};
};

const extractTextFromHtml = (html: string): string => {
	const document = parseHtml(html);
	return (
		document.body?.innerText ??
		document.body?.textContent ??
		document.documentElement?.textContent ??
		""
	).trim();
};

const buildReadContent = ({
	rawHtml,
	rawText,
	contentMode,
	maxChars,
}: {
	rawHtml: string;
	rawText: string;
	contentMode: ContentMode;
	maxChars: number;
}): {
	contentMode: NormalizedContentMode;
	content: string;
} => {
	const normalizedMode = normalizeContentMode(contentMode);

	if (normalizedMode === "text") {
		return {
			contentMode: normalizedMode,
			content: truncateContent(rawText, maxChars),
		};
	}

	if (normalizedMode === "clean_html") {
		const cleanHtml = createCleanHtml(rawHtml);
		return {
			contentMode: normalizedMode,
			content: truncateContent(cleanHtml, maxChars),
		};
	}

	return {
		contentMode: normalizedMode,
		content: truncateContent(rawHtml, maxChars),
	};
};

const readBySelector = async (
	session: Awaited<ReturnType<typeof getOrOpenWebSession>>["session"],
	selector: string,
	contentMode: ContentMode,
	maxChars: number,
): Promise<ReturnType<typeof createWebResult>> => {
	const selectorHtml = extractSelectorHtml(session.html, selector, 10);
	const transformedContent = buildReadContent({
		rawHtml: selectorHtml.html,
		rawText: extractTextFromHtml(selectorHtml.html),
		contentMode,
		maxChars,
	});
	return createWebResult({
		actionType: "web_read",
		success: true,
		sessionId: session.id,
		url: session.currentUrl,
		title: session.title,
		domAccessible: session.domAccessible,
		browserMode: session.mode,
		selector,
		matchCount: selectorHtml.matchCount,
		contentMode: transformedContent.contentMode,
		content: transformedContent.content,
	});
};

export const createWebReadTool: ToolFactory<
	Input,
	undefined
> = (): Tool<Input> => ({
	name: TOOL_NAME,
	description:
		"Read rendered page content from an active web session or directly from a URL. Default output is readable text.",
	schema,
	execute: async (input) => {
		let disposableSession = false;
		let sessionId = input.sessionId;
		const contentMode = input.contentMode ?? "text";
		const maxChars = input.maxHtmlChars ?? 160_000;
		try {
			const sessionResult = await getOrOpenWebSession({
				sessionId: input.sessionId,
				url: input.url,
				timeoutMs: input.timeoutMs ?? 15_000,
				maxHtmlChars: maxChars,
				browserMode: input.browserMode,
			});
			disposableSession = sessionResult.disposable;
			sessionId = sessionResult.session.id;
			const session = sessionResult.session;
			if (input.selector) {
				return readBySelector(session, input.selector, contentMode, maxChars);
			}

			if (session.mode === "iframe" && !session.domAccessible) {
				const fallback = await fetchRenderedFallback({
					url: session.requestedUrl,
					timeoutMs: input.timeoutMs ?? 15_000,
					maxHtmlChars: maxChars,
				});
				const transformedFallback = buildReadContent({
					rawHtml: fallback.html,
					rawText: fallback.text,
					contentMode,
					maxChars,
				});
				return createWebResult({
					actionType: "web_read",
					success: true,
					sessionId: session.id,
					url: fallback.currentUrl,
					title: fallback.title,
					domAccessible: false,
					browserMode: session.mode,
					contentMode: transformedFallback.contentMode,
					content: transformedFallback.content,
					fallback: "network",
				});
			}

			const transformedContent = buildReadContent({
				rawHtml: session.html,
				rawText: session.text,
				contentMode,
				maxChars,
			});

			return createWebResult({
				actionType: "web_read",
				success: true,
				sessionId: session.id,
				url: session.currentUrl,
				title: session.title,
				domAccessible: session.domAccessible,
				browserMode: session.mode,
				contentMode: transformedContent.contentMode,
				content: transformedContent.content,
			});
		} catch (error) {
			return createDefaultWebErrorResult(error);
		} finally {
			if (disposableSession && sessionId) {
				await closeWebSession(sessionId);
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
