import type { ChatMessage } from "@/types/openai";
import type { Message } from "@/services/database";

const DESCRIPTION_LIMIT = 1000;

type StoredAction = {
	id: string;
	name: string;
	description?: string;
	metadata?: Record<string, unknown>;
};

function renderAction(a: StoredAction): string {
	const description = (a.description ?? "").slice(0, DESCRIPTION_LIMIT);
	const toolCall = a.metadata?.tool;

	if (toolCall) {
		return `<tool_call><name>${toolCall}</name>\n<content>${description}</content></tool_call>`;
	}

	return `<action><name>${a.name}</name>\n<content>${description}<content></action>`;
}

function buildAssistantContent(msg: Message): string {
	const metadata = msg.metadata as Record<string, unknown> | null;
	const actions = metadata?.actions as StoredAction[] | undefined;

	if (!actions || actions.length === 0) return msg.content;

	const actionsPrefix = actions.map(renderAction).join("\n");
	const content = `${actionsPrefix}\n\n${msg.content}`;

	return content;
}

export function buildSendMessages(relevantMessages: Message[]): ChatMessage[] {
	return relevantMessages
		.filter((msg) => msg.type !== "separator")
		.map((msg): ChatMessage => {
			const role = msg.role as "system" | "user" | "assistant";
			if (role === "system" || role === "user") {
				return { role, content: msg.content };
			}
			return { role: "assistant", content: buildAssistantContent(msg) };
		});
}
