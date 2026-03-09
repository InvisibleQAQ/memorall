import { logError } from "@/utils/logger";
import { defineStep, bindStep } from "@/services/flows/interfaces/step";
import type {
	StepFactoryFromSpec,
	StepSpecFromDefinition,
} from "@/services/flows/interfaces/step";
import { stepRegistry } from "@/services/flows/step-registry";
import { GraphBase, type ToolName } from "@/services/flows/graph/graph.base";
import type { ChatCompletionMessageParam } from "@/types/openai";
import { getActiveWebSessionInfo } from "@/services/flows/tools/web/web-tool-registry";

const STEP_NAME = "web-feature" as const;
export const WEB_FEATURE_NAME = STEP_NAME;

export interface WebFeatureInput {
	messages: ChatCompletionMessageParam[];
	tools: `${ToolName}`[];
}

export interface WebFeatureOutput {
	tools?: `${ToolName}`[];
	messages?: ChatCompletionMessageParam[];
}

export interface WebFeatureConfig {}

export type WebFeatureServices = {};

const SYSTEM_PROMPT_INSTRUCTION = `
# WEB TOOL FEATURE
You have access to a browser.

Use this feature when the agent needs to work with web pages, including:
- Open a URL in iframe (DOM mode) or tab/window mode (wide-access mode), then keep session.

## MODE GUIDELINES
- Use "iframe" when you need direct DOM actions: "query", "click", "input", "focus", and "scroll".
- Use "tab" or "window" when you only need wide web access (open/read/search/fallback) and can tolerate no DOM actions.
- If broad accessibility is required first, prefer "window" (fallback to "tab" when "window" is unavailable).
- In this environment, "tab" and "window" are equivalent for content access behavior; choose "window" for clarity when you want browser-window style execution.
- Read rendered HTML or read selected DOM elements.
- Search in rendered HTML/DOM content.
- Perform DOM operations (query/read/click/input/focus/scroll).
- Wait for navigation timing or selector state.

## AVAILABLE TOOLS
- web_open: open URL and keep a session.
- web_read: read rendered page (or selected DOM region).
- web_search: search text/regex in rendered page content.
- web_dom_action: query DOM nodes, click, input text, read node details, focus, scroll.
- web_wait: wait for timeout or selector appear/disappear.

## RECOMMENDED WORKFLOW
1. Use web_open with keepSession=true to create a session.
2. Use web_read or web_search to inspect content.
3. Use web_dom_action for field fill/click interactions.
4. Use web_wait after navigation-heavy UI actions.
`;

export const WEB_FEATURE_SYSTEM_PROMPT = SYSTEM_PROMPT_INSTRUCTION.trim();
const formatActiveWebSession = (
	session: ReturnType<typeof getActiveWebSessionInfo>,
): string => {
	if (!session.isOpen) {
		return "";
	}

	const lastAccessedAt = session.lastAccessedAt
		? `- lastAccessedAt: ${new Date(session.lastAccessedAt).toISOString()}`
		: "";
	const createdAt = session.createdAt
		? `- createdAt: ${new Date(session.createdAt).toISOString()}`
		: "";

	return `## CURRENT WEB SESSION
- requestedUrl: ${session.requestedUrl}
- currentUrl: ${session.currentUrl}
- title: ${session.title || "(no title)"}
 - mode: ${session.mode || "iframe"}
${lastAccessedAt}
${createdAt}`.trim();
};

export const WEB_FEATURE_TOOLS = [
	"web_open",
	"web_read",
	"web_search",
	"web_dom_action",
	"web_wait",
] as const;

export const WEB_FEATURE_DESCRIPTION =
	"Enable offscreen web tooling: open, read, search, DOM access, and wait.";

const definition = defineStep<
	WebFeatureInput,
	WebFeatureOutput,
	WebFeatureServices,
	WebFeatureConfig
>({
	name: STEP_NAME,
	execute: async ({ input }) => {
		try {
			const tools = GraphBase.chat.addTool(input.tools, ...WEB_FEATURE_TOOLS);
			const activeSession = getActiveWebSessionInfo();
			const messages = GraphBase.chat.systemMessage(
				input.messages,
				`${WEB_FEATURE_SYSTEM_PROMPT}\n\n${formatActiveWebSession(activeSession)}`,
			);
			return {
				output: {
					tools,
					messages,
				},
			};
		} catch (error) {
			logError("[WEB_FEATURE] Failed:", error);
			return {
				output: {
					tools: input.tools,
					messages: input.messages,
					errors: [
						error instanceof Error ? error.message : "Web feature step failed",
					],
				},
			};
		}
	},
});

type WebFeatureSpec = StepSpecFromDefinition<typeof definition>;
export const createWebFeatureStep: StepFactoryFromSpec<WebFeatureSpec> = (
	services: WebFeatureServices,
	config?: WebFeatureConfig,
) => bindStep(definition, services, config);

stepRegistry.register(STEP_NAME, createWebFeatureStep);

declare global {
	interface StepTypeRegistry {
		[STEP_NAME]: WebFeatureSpec;
	}
}
