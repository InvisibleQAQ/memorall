export type LangGraphStreamChunk =
	| [string, unknown]
	| [string[], string, unknown]
	| unknown;

import type { ChatCompletionChunk } from "@/types/openai";

export type FlowAction = {
	id: string;
	name: string;
	description?: string;
	metadata: Record<string, unknown>;
};

export type LangGraphCustomChunkPayload =
	| {
			type: "llm";
			chunk: ChatCompletionChunk;
	  }
	| {
			type: "actions";
			actions: FlowAction[];
	  }
	| {
			type: string;
	  };

export function normalizeLangGraphStreamChunk(value: LangGraphStreamChunk): {
	mode: string;
	payload: unknown;
} {
	if (Array.isArray(value)) {
		if (value.length === 3) {
			return { mode: String(value[1]), payload: value[2] };
		}
		if (value.length === 2) {
			return { mode: String(value[0]), payload: value[1] };
		}
	}
	return { mode: "values", payload: value };
}

export function isCustomChunkPayload(
	payload: unknown,
): payload is LangGraphCustomChunkPayload {
	return (
		!!payload &&
		typeof payload === "object" &&
		"type" in payload &&
		typeof (payload as { type?: string }).type === "string"
	);
}
