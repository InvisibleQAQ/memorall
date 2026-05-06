import { embeddedChatService } from "@/embedded/chat-service";
import type {
	ChatStreamOptions,
	EmbeddedChatStreamResult,
} from "@/embedded/chat-service";
import type { ChatMessage } from "@/embedded/types";
import { buildDefaultFlowConfig } from "@/services/flows/build-flow-config";
import type { UnifiedFlowConfig } from "@/services/flows/interfaces/flow-config";
import { CO_AGENT_FEATURE_STEP_NAME } from "@/services/flows/steps/features/co-agent-feature";
import type { CoAgentContextAnchor } from "@/embedded/utils/co-agent/context-anchor";

export interface CoAgentPageContext {
	url: string;
	title: string;
	description?: string;
}

export interface CoAgentChatStreamOptions
	extends Pick<
		ChatStreamOptions,
		"model" | "onExecuteStart" | "onProgress" | "onError" | "signal"
	> {
	prompt: string;
	pageContext: CoAgentPageContext;
	anchorContext?: CoAgentContextAnchor;
}

export const CO_AGENT_PAGE_CONTEXT_SYSTEM_PROMPT = `
Current user-enabled browser page context:
- URL: {{url}}
- Title: {{title}}
- Description: {{description}}

Use this as starting orientation. Still use co-agent browser tools before making page-grounded claims or taking actions.
`.trim();

const renderAnchorContextPrompt = (
	anchor?: CoAgentContextAnchor,
): string | null => {
	if (!anchor) return null;
	return `
The user is asking about this current page target first:
- Source: ${anchor.kind}
- Selector: ${anchor.selector ?? "Not available"}
- Tag: ${anchor.tagName}
- Label: ${anchor.ariaLabel || anchor.placeholder || "Not available"}
- Text: ${anchor.text || "Not available"}
- Value: ${anchor.value || "Not available"}
- Nearby text: ${anchor.nearbyText || "Not available"}

Prioritize this anchored target when interpreting the user's prompt. Still verify with co-agent tools before making page-grounded claims.
`.trim();
};

const renderCoAgentPageContextPrompt = (context: CoAgentPageContext): string =>
	CO_AGENT_PAGE_CONTEXT_SYSTEM_PROMPT.replace(
		"{{url}}",
		context.url || "Unknown",
	)
		.replace("{{title}}", context.title || "Unknown")
		.replace("{{description}}", context.description || "Not available");

const createUserMessage = (prompt: string): ChatMessage => ({
	id: `co-agent-user-${Date.now()}`,
	role: "user",
	content: prompt,
	timestamp: new Date(),
});

export const createCoAgentEnabledFlowConfig = (): UnifiedFlowConfig => {
	const config = buildDefaultFlowConfig("foundation");
	return {
		...config,
		steps: config.steps.map((step) =>
			step.name === CO_AGENT_FEATURE_STEP_NAME
				? { ...step, enabled: true }
				: step,
		),
	};
};

export const coAgentChatService = {
	chatStream: (
		options: CoAgentChatStreamOptions,
	): Promise<EmbeddedChatStreamResult> =>
		embeddedChatService.chatStream({
			messages: [createUserMessage(options.prompt)],
			model: options.model,
			mode: "custom",
			flowConfig: createCoAgentEnabledFlowConfig(),
			systemMessages: [
				renderCoAgentPageContextPrompt(options.pageContext),
				renderAnchorContextPrompt(options.anchorContext),
			].filter((message): message is string => Boolean(message)),
			onExecuteStart: options.onExecuteStart,
			onProgress: options.onProgress,
			onError: options.onError,
			signal: options.signal,
		}),
};
