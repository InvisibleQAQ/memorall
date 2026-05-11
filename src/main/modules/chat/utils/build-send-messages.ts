import type { ChatMessage, ChatCompletionContentPart } from "@/types/openai";
import type {
	ComplexContent,
	ComplexContentPartImage,
	ComplexContentPartTool,
} from "@/types/chat";
import type { Message } from "@/services/database";
import { documentFileSystemService } from "@/services/filesystem/document-filesystem";

const DESCRIPTION_SMALL_LIMIT = 500;
const DESCRIPTION_LIMIT = 1000;

type StoredAction = {
	id: string;
	name: string;
	description?: string;
	metadata?: Record<string, unknown>;
};

function renderAction(a: StoredAction): string {
	const description = a.description ?? "";
	const toolCall = a.metadata?.tool;

	if (toolCall) {
		return `<tool_call><name>${toolCall}</name>\n<content>${description.slice(0, DESCRIPTION_SMALL_LIMIT)}</content></tool_call>`;
	}

	return `<action><name>${a.name}</name>\n<content>${description.slice(0, DESCRIPTION_LIMIT)}<content></action>`;
}

function buildAssistantContent(msg: Message): string {
	const complexContent = msg.complexContent as
		| ComplexContent
		| null
		| undefined;
	if (complexContent?.some((part) => part.type === "tool")) {
		return complexContent
			.map((part) => {
				if (part.type === "text") return part.text;
				if (part.type === "tool" && part.state !== "running") {
					return renderAction(part as ComplexContentPartTool);
				}
				return "";
			})
			.filter(Boolean)
			.join("\n\n");
	}

	const metadata = msg.metadata as Record<string, unknown> | null;
	const actions = metadata?.actions as StoredAction[] | undefined;

	if (!actions || actions.length === 0) return msg.content;

	const actionsPrefix = actions.map(renderAction).join("\n");
	const content = `${actionsPrefix}\n\n${msg.content}`;

	return content;
}

/** Convert a stored image part into an OpenAI image_url content part (base64 data URI). */
async function resolveImagePart(
	part: ComplexContentPartImage,
): Promise<ChatCompletionContentPart> {
	const dataUri = await documentFileSystemService.readFileAsBase64(
		part.path,
		part.mimeType,
	);
	return {
		type: "image_url",
		image_url: { url: dataUri, detail: "auto" },
	};
}

/**
 * Build the OpenAI content value for a user message.
 * If the message has complexContent (multipart), resolve images to base64 data URIs
 * and return a content array. Otherwise return the plain string.
 */
async function buildUserContent(
	msg: Message,
): Promise<string | ChatCompletionContentPart[]> {
	const complexContent = msg.complexContent as
		| ComplexContent
		| null
		| undefined;

	if (!complexContent || complexContent.length === 0) {
		return msg.content;
	}

	const parts: ChatCompletionContentPart[] = await Promise.all(
		complexContent.map(async (part): Promise<ChatCompletionContentPart> => {
			if (part.type === "text") {
				return { type: "text", text: part.text };
			}
			if (part.type === "image") {
				return resolveImagePart(part);
			}
			return { type: "text", text: "" };
		}),
	);

	return parts;
}

export async function buildSendMessages(
	relevantMessages: Message[],
): Promise<ChatMessage[]> {
	const filtered = relevantMessages.filter((msg) => msg.type !== "separator");

	return Promise.all(
		filtered.map(async (msg): Promise<ChatMessage> => {
			const role = msg.role as "system" | "user" | "assistant";
			if (role === "system") {
				return { role, content: msg.content };
			}
			if (role === "user") {
				const content = await buildUserContent(msg);
				return { role, content };
			}
			// Persisted assistant tool calls must not be replayed on later turns.
			// OpenAI-compatible providers require matching tool result messages for
			// every assistant tool call, but we store only the finalized assistant
			// answer plus action summaries, not the raw tool-message chain.
			return { role: "assistant", content: buildAssistantContent(msg) };
		}),
	);
}
