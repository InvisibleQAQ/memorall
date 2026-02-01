import { Annotation, END, START, StateGraph } from "@langchain/langgraph/web";
import type {
	ChatCompletionMessageParam,
	ChatCompletionMessageToolCall,
} from "@/types/openai";

export interface BaseStateBase {
	messages: ChatCompletionMessageParam[];
	finalMessage: string;
}

export const normalizeChatMessages = (
	messages: ChatCompletionMessageParam[] | undefined,
	systemContent?: string,
): ChatCompletionMessageParam[] => {
	const list = Array.isArray(messages) ? messages : [];
	const systemMessages = list.filter((message) => message.role === "system");
	const nonSystem = list.filter((message) => message.role !== "system");
	const resolvedSystemContent =
		systemContent ?? systemMessages[systemMessages.length - 1]?.content ?? "";

	const toolById = new Map<string, ChatCompletionMessageParam[]>();
	const orphanTools: ChatCompletionMessageParam[] = [];
	const ordered: ChatCompletionMessageParam[] = [];

	for (const message of nonSystem) {
		if (message.role === "tool") {
			if (message.tool_call_id) {
				const existing = toolById.get(message.tool_call_id) ?? [];
				existing.push(message);
				toolById.set(message.tool_call_id, existing);
			} else {
				orphanTools.push(message);
			}
			continue;
		}

		ordered.push(message);

		if (message.role === "assistant" && message.tool_calls?.length) {
			for (const toolCall of message.tool_calls) {
				const bucket = toolById.get(toolCall.id);
				if (bucket?.length) {
					ordered.push(...bucket);
					toolById.delete(toolCall.id);
				}
			}
		}
	}

	for (const bucket of toolById.values()) {
		ordered.push(...bucket);
	}
	ordered.push(...orphanTools);

	return [{ role: "system", content: resolvedSystemContent }, ...ordered];
};

export const BaseAnnotation = {
	messages: Annotation<ChatCompletionMessageParam[]>({
		value: (x, y) => normalizeChatMessages(y ?? x),
		default: () => [{ role: "system", content: "" }],
	}),
	finalMessage: Annotation<string>({
		value: (x, y) => y ?? x,
		default: () => "",
	}),
};
// Proper LangGraph types
type CompiledGraph<T> = ReturnType<
	StateGraph<T, T, unknown, string | typeof START | typeof END>["compile"]
>;
type LangGraphInvokeResult<T> = ReturnType<CompiledGraph<T>["invoke"]>;
type LangGraphStreamResult<T> = ReturnType<CompiledGraph<T>["stream"]>;
type LangGraphInvokeOptions<T> = Parameters<CompiledGraph<T>["invoke"]>[1];
type LangGraphStreamOptions<T> = Parameters<CompiledGraph<T>["stream"]>[1];

export class GraphBase<N extends string, T extends BaseStateBase, S = unknown> {
	protected workflow!: StateGraph<T, T, unknown, N | typeof START | typeof END>;
	protected app!: CompiledGraph<T>;
	protected services!: S;
	public abortController = new AbortController();

	constructor(services: S) {
		this.services = services;
	}

	protected chat = {
		system: (
			messages: ChatCompletionMessageParam[],
			systemContent: string,
		): ChatCompletionMessageParam[] =>
			normalizeChatMessages(messages, systemContent),
		assistant: (
			messages: ChatCompletionMessageParam[],
			content: string | null,
			tool_calls?: ChatCompletionMessageToolCall[],
		): ChatCompletionMessageParam[] => [
			...messages,
			{
				role: "assistant",
				content,
				tool_calls,
			},
		],
		tool: (
			messages: ChatCompletionMessageParam[],
			tool_call_id: string,
			content: string,
		): ChatCompletionMessageParam[] => [
			...messages,
			{
				role: "tool",
				content,
				tool_call_id,
			},
		],
		last: (messages: ChatCompletionMessageParam[]) =>
			messages[messages.length - 1],
		getToolCall: (messages: ChatCompletionMessageParam[], toolCallId: string) =>
			messages.find(
				(message) =>
					message.role === "tool" && message.tool_call_id === toolCallId,
			),
	};

	protected compile(
		options?: Parameters<typeof this.workflow.compile>[0],
	): CompiledGraph<T> {
		if (!this.workflow) {
			throw new Error("Workflow is not defined");
		}
		this.app = this.workflow.compile({
			...options,
		});
		return this.app;
	}

	invoke(
		input: Partial<T>,
		options?: LangGraphInvokeOptions<T>,
	): LangGraphInvokeResult<T> {
		const arg = input as Parameters<typeof this.app.invoke>[0];
		return this.app.invoke(arg, options);
	}

	stream(
		input: Partial<T>,
		options?: LangGraphStreamOptions<T>,
	): LangGraphStreamResult<T> {
		const arg = input as Parameters<typeof this.app.stream>[0];
		return this.app.stream(arg, options);
	}

	getGraph() {
		return this.app.getGraph();
	}
}
