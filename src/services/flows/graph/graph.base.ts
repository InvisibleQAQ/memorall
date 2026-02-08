import { Annotation, END, START, StateGraph } from "@langchain/langgraph/web";
import type {
	ChatCompletionMessageParam,
	ChatCompletionMessageToolCall,
} from "@/types/openai";
import { logWarn } from "@/utils/logger";

export interface BaseStateBase {
	messages: ChatCompletionMessageParam[];
	response?: string;
}

export type SystemPlacement = "append" | "top" | "replace";

export interface NormalizeChatMessageOptions {
	placement?: SystemPlacement;
}

const getSystemContent = (message: ChatCompletionMessageParam): string => {
	if (typeof message.content === "string") {
		return message.content.trim();
	}
	if (Array.isArray(message.content)) {
		return message.content
			.filter((part) => part.type === "text")
			.map((part) => (part as { type: "text"; text: string }).text)
			.join("\n")
			.trim();
	}
	return "";
};

export const normalizeChatMessages = (
	messages: ChatCompletionMessageParam[] | undefined,
	systemContent?: string,
	options?: NormalizeChatMessageOptions,
): ChatCompletionMessageParam[] => {
	const list = Array.isArray(messages) ? messages : [];
	const systemMessages = list.filter((m) => m.role === "system");
	const nonSystem = list.filter((m) => m.role !== "system");
	const placement = options?.placement ?? "append";

	const toolById = new Map<string, ChatCompletionMessageParam[]>();
	const orphanTools: ChatCompletionMessageParam[] = [];

	const ordered = nonSystem.reduce<ChatCompletionMessageParam[]>(
		(acc, message) => {
			if (message.role === "tool") {
				const bucket = message.tool_call_id
					? (toolById.get(message.tool_call_id) ?? [])
					: orphanTools;
				bucket.push(message);
				if (message.tool_call_id) toolById.set(message.tool_call_id, bucket);
				return acc;
			}

			acc.push(message);
			if (message.role === "assistant" && message.tool_calls?.length) {
				message.tool_calls.forEach(({ id }) => {
					const bucket = toolById.get(id);
					if (bucket?.length) {
						acc.push(...bucket);
						toolById.delete(id);
					}
				});
			}
			return acc;
		},
		[],
	);

	toolById.forEach((bucket) => ordered.push(...bucket));
	if (orphanTools?.length) {
		logWarn("[NormalizeChatMessages] orphanTools", orphanTools);
	}

	const existingSystemParts = systemMessages
		.map((message) => getSystemContent(message))
		.filter(Boolean);
	const newSystemContent = systemContent?.trim();
	let systemParts: string[] = [];

	if (placement === "replace") {
		systemParts = newSystemContent ? [newSystemContent] : [];
	} else if (placement === "top") {
		systemParts = [newSystemContent, ...existingSystemParts].filter(
			Boolean,
		) as string[];
	} else {
		systemParts = [...existingSystemParts, newSystemContent].filter(
			Boolean,
		) as string[];
	}

	if (systemParts.length === 0) {
		return ordered;
	}

	return [{ role: "system", content: systemParts.join("\n\n") }, ...ordered];
};

export const BaseAnnotation = {
	messages: Annotation<ChatCompletionMessageParam[]>({
		value: (x, y) => normalizeChatMessages(y ?? x),
		default: () => [],
	}),
	response: Annotation<string>({
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

	static chat = {
		system: (
			messages: ChatCompletionMessageParam[],
			systemContent: string,
			options?: NormalizeChatMessageOptions,
		): ChatCompletionMessageParam[] =>
			normalizeChatMessages(messages, systemContent, options),
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
	protected chat = GraphBase.chat;

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
