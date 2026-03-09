import z from "zod";
import type { Tool, ToolFactory } from "@/services/flows/interfaces/tool";
import { toolRegistry } from "@/services/flows/tool-registry";
import {
	closeWebSession,
	createDefaultWebErrorResult,
	createWebResult,
	getOrOpenWebSession,
	refreshWebSession,
	waitForDomSelector,
} from "./web-tool-registry";

const TOOL_NAME = "web_wait" as const;

const schema = z.object({
	sessionId: z.string().optional().describe("Active web session ID."),
	url: z.string().url().optional().describe("Open first, then wait."),
	selector: z
		.string()
		.optional()
		.describe("DOM selector to wait for."),
	state: z
		.enum(["present", "absent"])
		.optional()
		.describe("Selector visibility state."),
	timeoutMs: z
		.number()
		.int()
		.min(500)
		.max(180_000)
		.optional()
		.describe("Total wait timeout."),
	intervalMs: z
		.number()
		.int()
		.min(50)
		.max(2_000)
		.optional()
		.describe("Polling interval when waiting for selector."),
	delayMs: z
		.number()
		.int()
		.min(50)
		.max(300_000)
		.optional()
		.describe("Fixed delay mode when no selector is provided."),
});

type Input = z.infer<typeof schema>;

const waitFixedDelay = async (delayMs: number): Promise<void> =>
	new Promise((resolve) => setTimeout(resolve, delayMs));

export const createWebWaitTool: ToolFactory<Input, undefined> = (): Tool<Input> => ({
	name: TOOL_NAME,
	description:
		"Wait for fixed delay or wait for selector state (present/absent) in a web session.",
	schema,
	execute: async (input) => {
		let disposableSessionId: string | undefined;
		try {
			const { session, disposable } = await getOrOpenWebSession({
				sessionId: input.sessionId,
				url: input.url,
				timeoutMs: input.timeoutMs ?? 15_000,
			});
			if (disposable) {
				disposableSessionId = session.id;
			}
			if (!session.domAccessible) {
				throw new Error("Current session cannot expose DOM for selector waits.");
			}

			refreshWebSession(session.id);

			let result;
			if (input.selector) {
				result = await waitForDomSelector({
					session,
					selector: input.selector,
					state: input.state ?? "present",
					timeoutMs: input.timeoutMs ?? 15_000,
					intervalMs: input.intervalMs ?? 250,
				});
			} else {
				const delay = input.delayMs ?? 1_000;
				await waitFixedDelay(delay);
				result = {
					matched: true,
					html: session.html,
					lastText: session.text,
				};
			}

			const output = createWebResult({
				actionType: "web_wait",
				success: true,
				sessionId: session.id,
				url: session.currentUrl,
				matched: result.matched,
				html: result.html,
				text: result.lastText,
			});
			if (disposableSessionId) {
				closeWebSession(disposableSessionId);
			}
			return output;
		} catch (error) {
			if (disposableSessionId) {
				closeWebSession(disposableSessionId);
			}
			return createDefaultWebErrorResult(error);
		}
	},
});

toolRegistry.register(TOOL_NAME, createWebWaitTool);

declare global {
	interface ToolTypeRegistry {
		[TOOL_NAME]: {
			input: Input;
			services: undefined;
		};
	}
}
