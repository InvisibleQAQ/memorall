import type {
	ComplexContent,
	ComplexContentPart,
	ComplexContentPartExecution,
	ComplexContentPartText,
	ComplexContentPartTool,
} from "@/types/chat";

export type ContentPartAction = {
	id: string;
	name: string;
	description: string;
	metadata: Record<string, unknown>;
};

export const cloneContentParts = (parts: ComplexContent): ComplexContent =>
	parts.map((part) => ({
		...part,
		...("metadata" in part && part.metadata
			? { metadata: { ...part.metadata } }
			: {}),
	}));

export const completeRunningExecutionParts = (
	parts: ComplexContent,
): ComplexContent =>
	parts.map((part) =>
		part.type === "execution" && part.state === "running"
			? { ...part, state: "complete" }
			: part,
	);

const getToolPartKey = (part: {
	id?: string;
	name?: string;
	metadata?: Record<string, unknown>;
}): string | undefined => {
	const toolCall = part.metadata?.tool_call;
	if (
		toolCall &&
		typeof toolCall === "object" &&
		"id" in toolCall &&
		typeof toolCall.id === "string"
	) {
		return toolCall.id;
	}
	const toolCallId = part.metadata?.tool_call_id;
	if (typeof toolCallId === "string" && toolCallId) return toolCallId;
	const tool = part.metadata?.tool;
	if (typeof tool === "string" && tool) return tool;
	if (part.id) return part.id;
	return part.name;
};

export const appendTextPart = (
	parts: ComplexContent,
	text: string,
): ComplexContent => {
	if (!text) return parts;
	const next = [...parts];
	const last = next.at(-1);
	if (last?.type === "text") {
		next[next.length - 1] = {
			...last,
			text: `${last.text}${text}`,
		} satisfies ComplexContentPartText;
		return next;
	}
	return [...next, { type: "text", text }];
};

export const upsertExecutionPart = (
	parts: ComplexContent,
	event: { node: string; metadata?: Record<string, unknown> },
): ComplexContent => {
	const completedParts = completeRunningExecutionParts(parts);
	const id =
		(typeof event.metadata?.tool_call_id === "string" &&
			event.metadata.tool_call_id) ||
		(typeof event.metadata?.tool === "string" && event.metadata.tool) ||
		event.node;
	const executionPart: ComplexContentPartExecution = {
		type: "execution",
		id,
		node: event.node,
		metadata: event.metadata,
		state: "running",
	};
	const executionKey = getToolPartKey(executionPart);
	const existingIndex = completedParts.findIndex(
		(part) =>
			(part.type === "execution" || part.type === "tool") &&
			getToolPartKey(part) === executionKey,
	);
	if (existingIndex === -1) return [...completedParts, executionPart];
	const next = [...completedParts];
	next[existingIndex] = executionPart;
	return next;
};

export const upsertToolParts = (
	parts: ComplexContent,
	incomingActions: ContentPartAction[],
): ComplexContent => {
	let next = completeRunningExecutionParts(parts);
	for (const action of incomingActions) {
		const toolPart: ComplexContentPartTool = {
			type: "tool",
			id: action.id,
			name: action.name,
			description: action.description,
			metadata: action.metadata,
			state:
				action.name.toLowerCase().includes("error") ||
				typeof action.metadata?.error === "string"
					? "error"
					: "complete",
		};
		const toolKey = getToolPartKey(toolPart);
		const existingIndex = next.findIndex(
			(part) =>
				(part.type === "execution" || part.type === "tool") &&
				getToolPartKey(part) === toolKey,
		);
		if (existingIndex === -1) {
			next = [...next, toolPart];
		} else {
			next[existingIndex] = toolPart;
		}
	}
	return next;
};

export const stripTransientExecutionParts = (
	parts: ComplexContent,
): ComplexContent =>
	parts.filter(
		(part): part is ComplexContentPart =>
			part.type !== "execution" || part.state !== "running",
	);
