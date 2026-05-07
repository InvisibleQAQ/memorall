import z from "zod";
import type { Tool, ToolFactory } from "@/services/flows/interfaces/tool";
import { toolRegistry } from "@/services/flows/tool-registry";
import {
	CO_AGENT_CONTENT_COMMAND_SOURCE,
	type CoAgentContentCommandResponse,
	type CoAgentElementInfo,
} from "@/services/co-agent";
import { createCleanHtmlWithSelectors } from "@/services/flows/tools/web/web-tool-utils";
import { createDefaultErrorResult, sendCoAgentCommand } from "./shared";

const observeSchema = z.object({
	scope: z
		.enum(["metadata", "selector", "selection", "viewport", "page"])
		.optional()
		.describe(
			"What to read. Default: metadata. Use selector for hovered/focused target, selection for selected text, viewport for current screen, page only for whole-page questions.",
		),
	selector: z
		.string()
		.min(1)
		.optional()
		.describe("CSS selector to read when scope is selector."),
	index: z
		.number()
		.int()
		.optional()
		.describe("Element index if selector matches multiple elements."),
	maxChars: z
		.number()
		.int()
		.optional()
		.describe("Text limit for selector, viewport, or page reads."),
	outputFormat: z
		.enum(["text", "html"])
		.optional()
		.describe(
			"Output format. Default: text. Use html when you need stable selectors to move the cursor — each element is rendered with a data-selector attribute you can pass directly to co_agent_move.",
		),
});

type ObserveInput = z.infer<typeof observeSchema>;

const compact = (value: string | null | undefined, max = 900): string => {
	const text = (value ?? "").replace(/\s+/g, " ").trim();
	return text.length > max ? `${text.slice(0, max)}...` : text;
};

const formatElement = (element: CoAgentElementInfo): string[] => {
	const lines = [
		`target: <${element.tagName}> ${element.stableSelector}`,
		`visible: ${element.visible}`,
		`rect: ${Math.round(element.rect.width)}x${Math.round(element.rect.height)} at ${Math.round(element.rect.x)},${Math.round(element.rect.y)}`,
	];
	const label = compact(
		element.ariaLabel || element.placeholder || element.title,
	);
	if (label) lines.push(`label: ${label}`);
	if (element.href) lines.push(`href: ${element.href}`);
	if (element.value) lines.push(`value: ${compact(element.value, 300)}`);
	if (element.text) lines.push(`text: ${compact(element.text)}`);
	if (element.images?.length) {
		lines.push("images:");
		for (const image of element.images) {
			const alt = compact(image.alt || image.title, 160);
			lines.push(
				`- ${image.src}${alt ? ` | alt: ${alt}` : ""} | size: ${image.width}x${image.height}`,
			);
		}
	}
	return lines;
};

const formatObserveResultHtml = (
	input: ObserveInput,
	response: CoAgentContentCommandResponse,
): string => {
	if (!response.success)
		return `<!-- co_agent_observe failed: ${response.error} -->`;
	const scope = input.scope ?? "metadata";
	const parts: string[] = [
		`<!-- co_agent_observe ok | scope: ${scope} -->`,
		`<!-- page: ${response.snapshot?.title || "Untitled"} | url: ${response.snapshot?.url || "Unknown"} -->`,
	];
	if (response.element) {
		const el = response.element;
		const attrs = [
			`data-selector="${el.stableSelector}"`,
			el.ariaLabel ? `aria-label="${el.ariaLabel}"` : "",
			el.href ? `href="${el.href}"` : "",
			el.placeholder ? `placeholder="${el.placeholder}"` : "",
		]
			.filter(Boolean)
			.join(" ");
		parts.push(
			"<!-- focused element — use data-selector value with co_agent_move -->",
			`<${el.tagName} ${attrs}>${compact(el.text || el.value || "", 200)}</${el.tagName}>`,
		);
	}
	if (response.snapshot?.domSummary?.length) {
		parts.push(
			"<!-- visible elements — each data-selector is usable with co_agent_move -->",
		);
		for (const item of response.snapshot.domSummary.slice(0, 50)) {
			const attrs = [
				`data-selector="${item.stableSelector}"`,
				item.ariaLabel ? `aria-label="${item.ariaLabel}"` : "",
				item.placeholder ? `placeholder="${item.placeholder}"` : "",
			]
				.filter(Boolean)
				.join(" ");
			parts.push(
				`<${item.tagName} ${attrs}>${compact(item.text || item.placeholder || "", 120)}</${item.tagName}>`,
			);
		}
	} else if (response.snapshot?.visibleText) {
		parts.push(
			`<div data-selector="body">${compact(response.snapshot.visibleText)}</div>`,
		);
	}
	return createCleanHtmlWithSelectors(parts.filter(Boolean).join("\n"));
};

const formatObserveResult = (
	input: ObserveInput,
	response: CoAgentContentCommandResponse,
): string => {
	if (input.outputFormat === "html")
		return formatObserveResultHtml(input, response);
	if (!response.success)
		return `co_agent_observe failed\nerror: ${response.error}`;
	const scope = input.scope ?? "metadata";
	const lines = [
		"co_agent_observe ok",
		`scope: ${scope}`,
		`page: ${response.snapshot?.title || "Untitled"}`,
		`url: ${response.snapshot?.url || "Unknown"}`,
	];
	const isPageScope = scope === "page";
	const defaultChars = isPageScope ? 12000 : 2000;
	const maxChars = input.maxChars ?? defaultChars;
	if (response.element) lines.push(...formatElement(response.element));
	if (response.note)
		lines.push(`selection: ${compact(response.note, maxChars)}`);
	if (response.snapshot?.visibleText) {
		lines.push(
			`visibleText: ${compact(response.snapshot.visibleText, maxChars)}`,
		);
	}
	if (response.snapshot?.text) {
		lines.push(`pageText: ${compact(response.snapshot.text, maxChars)}`);
	}
	if (response.snapshot?.domSummary?.length) {
		lines.push("visibleElements:");
		for (const item of response.snapshot.domSummary.slice(0, 50)) {
			lines.push(
				`- <${item.tagName}> ${item.stableSelector} ${compact(
					item.ariaLabel || item.text || item.placeholder,
					120,
				)}`,
			);
		}
	}
	return lines.filter(Boolean).join("\n");
};

const createObserveTool: ToolFactory<
	ObserveInput
> = (): Tool<ObserveInput> => ({
	name: "co_agent_observe",
	description:
		"Read page context with a simple scope. Default metadata is cheap. Use selector for hovered/focused targets, selection for selected text, viewport for current screen, and page only for whole-page questions. Set outputFormat:'html' to get elements with embedded data-selector attributes — use those selector values directly with co_agent_move to visually point the cursor at matching elements.",
	schema: observeSchema,
	execute: async (input) => {
		try {
			const response = await sendCoAgentCommand({
				source: CO_AGENT_CONTENT_COMMAND_SOURCE,
				type: "co-agent:observe",
				scope: input.scope,
				selector: input.selector,
				index: input.index,
				maxTextChars: input.maxChars,
				maxVisibleTextChars: input.maxChars,
				maxDomElements: 50,
			});
			return formatObserveResult(input, response);
		} catch (error) {
			return createDefaultErrorResult(error);
		}
	},
});

toolRegistry.register("co_agent_observe", createObserveTool);

declare global {
	interface ToolTypeRegistry {
		co_agent_observe: {
			input: ObserveInput;
			services: void;
		};
	}
}
