import z from "zod";
import type { Tool, ToolFactory } from "@/services/flows/interfaces/tool";
import { createDefaultWebErrorResult, createWebResult, openWebSession } from "./web-tool-registry";
import { toolRegistry } from "@/services/flows/tool-registry";

const TOOL_NAME = "web_open" as const;

const schema = z.object({
	url: z.string().url().describe("Target web URL to open."),
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

export const createWebOpenTool: ToolFactory<Input, undefined> = (): Tool<Input> => ({
	name: TOOL_NAME,
	description:
		"Open a web URL inside a hidden offscreen iframe, render DOM, and expose a session handle (`sessionId`) for follow-up DOM actions.",
	schema,
	execute: async (input) => {
		try {
			const { session } = await openWebSession({
				url: input.url,
				timeoutMs: input.timeoutMs ?? 15_000,
				maxHtmlChars: input.maxHtmlChars ?? 160_000,
				persist: input.keepSession ?? true,
			});

			return createWebResult({
				actionType: "web_open",
				success: true,
				sessionId: session.id,
				requestedUrl: input.url,
				url: session.currentUrl,
				title: session.title,
				domAccessible: session.domAccessible,
				html: session.html,
			});
		} catch (error) {
			return createDefaultWebErrorResult(error);
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
