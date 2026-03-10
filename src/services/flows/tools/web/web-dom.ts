import z from "zod";
import type { Tool, ToolFactory } from "@/services/flows/interfaces/tool";
import { toolRegistry } from "@/services/flows/tool-registry";
import {
	createDefaultWebErrorResult,
	createWebResult,
	getWebSession,
	performDomAction,
	queryDomElements,
} from "./web-tool-registry";

const TOOL_NAME = "web_dom_action" as const;

const schema = z.object({
	sessionId: z.string().describe("Active web session ID."),
	selector: z.string().min(1).describe("CSS selector for DOM target."),
	action: z
		.enum([
			"query",
			"read",
			"click",
			"input",
			"focus",
			"scrollTop",
			"scrollBottom",
		])
		.describe(
			"DOM action. `query` supports index-less selection list, others operate by selector+index.",
		),
	index: z
		.number()
		.int()
		.min(0)
		.optional()
		.describe("Element index for selectors returning multiple results."),
	value: z.string().optional().describe("Text to fill (input action only)."),
	maxResults: z
		.number()
		.int()
		.min(1)
		.max(50)
		.optional()
		.describe("For query: max returned element list."),
});

type Input = z.infer<typeof schema>;

export const createWebDomActionTool: ToolFactory<
	Input,
	undefined
> = (): Tool<Input> => ({
	name: TOOL_NAME,
	description:
		"Interact with or inspect DOM of an active web session via selectors (`click`, `input`, `read`, `query`, `focus`, `scroll*`).",
	schema,
	execute: async (input) => {
		try {
			const session = await getWebSession(input.sessionId);
			if (!session.domAccessible) {
				throw new Error("Current session cannot expose DOM actions.");
			}

			if (input.action === "query") {
				const elements = await queryDomElements(
					session,
					input.selector,
					input.maxResults ?? 20,
				);
				const actionResult = elements.map((record) => ({
					index: record.index,
					label: `${record.tagName}#${record.id || "no-id"}[${record.name || "no-name"}]`,
					text: record.text,
					value: record.value,
				}));

				return createWebResult({
					actionType: "web_dom_action",
					success: true,
					sessionId: session.id,
					url: session.currentUrl,
					action: input.action,
					selector: input.selector,
					result: actionResult,
				});
			}

			const actionResult = await performDomAction(session, input.action, {
				selector: input.selector,
				index: input.index ?? 0,
				value: input.value,
			});

			return createWebResult({
				actionType: "web_dom_action",
				success: true,
				sessionId: session.id,
				url: session.currentUrl,
				action: input.action,
				selector: input.selector,
				result: actionResult,
			});
		} catch (error) {
			return createDefaultWebErrorResult(error);
		}
	},
});

toolRegistry.register(TOOL_NAME, createWebDomActionTool);

declare global {
	interface ToolTypeRegistry {
		[TOOL_NAME]: {
			input: Input;
			services: undefined;
		};
	}
}
