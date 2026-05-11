import type { ChatMessage } from "@/types/openai";
import { estimatePromptTokens } from "@/services/llm/utils/token-usage";

/** Fraction of the model's context window to use for input messages. */
export const CONTEXT_BUDGET_RATIO = 0.5;

/** Max chars kept inside a tool output block during truncation. */
const TOOL_CONTENT_SHORT = 60;

const CHARS_PER_TOKEN = 4;

function hasToolBlocks(content: string): boolean {
	return /<(?:tool_call|action)>/.test(content);
}

/**
 * Truncate <content>…</content> inside every tool_call/action block
 * to maxLen chars. Preserves the block structure so the LLM still
 * knows what tool ran; only the output is shortened.
 */
function truncateToolContent(content: string, maxLen: number): string {
	return content.replace(
		/(<(?:tool_call|action)[^>]*>[\s\S]*?<content>)([\s\S]*?)(<\/content>)/g,
		(_, open, body: string, close) =>
			body.length > maxLen
				? `${open}${body.slice(0, maxLen)}…${close}`
				: `${open}${body}${close}`,
	);
}

/** Strip all tool_call/action blocks entirely from the content. */
function removeToolBlocks(content: string): string {
	return content
		.replace(/<tool_call>[\s\S]*?<\/tool_call>\n?/g, "")
		.replace(/<action>[\s\S]*?<\/action>\n?/g, "")
		.trim();
}

/** Approximate token savings from a content change. */
function tokenDelta(before: string, after: string): number {
	return Math.ceil((before.length - after.length) / CHARS_PER_TOKEN);
}

/**
 * Reduce messages to fit within maxTokens.
 *
 * O(n) — computes token total once, then tracks a running delta so
 * each phase iterates the message list once without re-scanning.
 *
 * Phase 1a — truncate tool output <content> to TOOL_CONTENT_SHORT chars,
 *   oldest assistant message first. Early-return as soon as under budget.
 *
 * Phase 1b — remove tool blocks entirely, oldest first.
 *   LLM still sees the surrounding assistant text; only the tool XML is gone.
 *   Early-return as soon as under budget.
 *
 * Phase 2 — drop the oldest non-system message entirely, one at a time,
 *   until under budget. Always preserves the final user + assistant pair.
 */
export function trimToContextBudget(
	messages: ChatMessage[],
	maxTokens: number,
): ChatMessage[] {
	let tokens = estimatePromptTokens(messages);
	if (tokens <= maxTokens) return messages;

	const working: ChatMessage[] = messages.map((m) => ({ ...m }) as ChatMessage);

	// Phase 1a: truncate tool content to short limit
	for (let i = 0; i < working.length; i++) {
		const msg = working[i];
		if (msg.role !== "assistant" || typeof msg.content !== "string") continue;
		if (!hasToolBlocks(msg.content)) continue;

		const before = msg.content;
		const after = truncateToolContent(before, TOOL_CONTENT_SHORT);
		if (after === before) continue;

		working[i] = { ...msg, content: after };
		tokens -= tokenDelta(before, after);
		if (tokens <= maxTokens) return working;
	}

	// Phase 1b: remove tool blocks entirely
	for (let i = 0; i < working.length; i++) {
		const msg = working[i];
		if (msg.role !== "assistant" || typeof msg.content !== "string") continue;
		if (!hasToolBlocks(msg.content)) continue;

		const before = msg.content;
		const after = removeToolBlocks(before);
		if (after === before) continue;

		working[i] = { ...msg, content: after };
		tokens -= tokenDelta(before, after);
		if (tokens <= maxTokens) return working;
	}

	// Phase 2: drop oldest non-system messages one at a time
	const systemMessages = working.filter((m) => m.role === "system");
	const conversation = working.filter((m) => m.role !== "system");

	while (conversation.length > 2 && tokens > maxTokens) {
		const dropped = conversation.shift()!;
		const droppedContent =
			typeof dropped.content === "string" ? dropped.content : "";
		tokens -= tokenDelta(droppedContent, "");
	}

	return [...systemMessages, ...conversation];
}
