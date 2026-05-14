import type {
	ChatCompletionChunkToolCall,
	ChatCompletionMessageToolCall,
} from "@/types/openai";

export type ToolCallAccumulator = Map<number, ChatCompletionMessageToolCall>;

export const createToolCallAccumulator = (): ToolCallAccumulator => new Map();

export const accumulateChunkToolCalls = (
	accumulator: ToolCallAccumulator,
	toolCalls: ChatCompletionChunkToolCall[] | undefined,
): void => {
	if (!toolCalls?.length) return;

	for (const toolCall of toolCalls) {
		const existing = accumulator.get(toolCall.index);
		if (existing) {
			if (toolCall.id) existing.id = toolCall.id;
			if (toolCall.function?.name) {
				existing.function.name = toolCall.function.name;
			}
			if (toolCall.function?.arguments) {
				existing.function.arguments += toolCall.function.arguments;
			}
			continue;
		}

		accumulator.set(toolCall.index, {
			id: toolCall.id || `call_${toolCall.index}_${Date.now()}`,
			type: "function",
			function: {
				name: toolCall.function?.name || "",
				arguments: toolCall.function?.arguments || "",
			},
		});
	}
};

export const getAccumulatedToolCalls = (
	accumulator: ToolCallAccumulator,
): ChatCompletionMessageToolCall[] => Array.from(accumulator.values());
