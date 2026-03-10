import {
	Annotation,
	END,
	START,
	StateGraph,
	type LangGraphRunnableConfig,
} from "@langchain/langgraph/web";
import type {
	ChatCompletionMessageParam,
	ChatCompletionMessageToolCall,
	ChatCompletionTool,
} from "@/types/openai";
import {
	toolRegistry,
	convertToolsToOpenAI,
} from "@/services/flows/tool-registry";
import type { BaseTool } from "@/services/flows/interfaces/tool";
import { logWarn } from "@/utils/logger";
import {
	FLOW_RUN_LIFECYCLE_CONFIG_KEY,
	createFlowRunLifecycle,
	getFlowRunLifecycle,
	type FlowRunFinishCallback,
	type FlowRunLifecycle,
} from "@/services/flows/runtime/run-lifecycle";

export type ToolName = `${keyof ToolTypeRegistry & string}`;

export interface CombinedTool {
	executor: BaseTool;
	tool: ChatCompletionTool;
}

export interface BaseStateBase {
	messages: ChatCompletionMessageParam[];
	response?: string;
	tools: ToolName[];
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

	// Pre-collect all tool messages by tool_call_id so assistant messages
	// can pull them regardless of ordering in the input array.
	const toolById = new Map<string, ChatCompletionMessageParam[]>();
	const orphanTools: ChatCompletionMessageParam[] = [];

	for (const message of nonSystem) {
		if (message.role === "tool") {
			const bucket = message.tool_call_id
				? (toolById.get(message.tool_call_id) ?? [])
				: orphanTools;
			bucket.push(message);
			if (message.tool_call_id) toolById.set(message.tool_call_id, bucket);
		}
	}

	// Second pass: order non-tool messages and insert tool results after their assistant
	const ordered = nonSystem.reduce<ChatCompletionMessageParam[]>(
		(acc, message) => {
			if (message.role === "tool") {
				return acc; // handled via buckets above
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

	// Append any remaining tool messages that didn't match an assistant
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
	tools: Annotation<ToolName[]>({
		value: (x, y) => y ?? x,
		default: () => [],
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
type LangGraphStreamValue<T> = Awaited<LangGraphStreamResult<T>>;

const wrapStreamWithLifecycle = <TStream extends AsyncIterable<unknown>>(
	stream: TStream,
	onDrain: () => Promise<void>,
): TStream => {
	let drained = false;

	const drainOnce = async (): Promise<void> => {
		if (drained) {
			return;
		}
		drained = true;
		await onDrain();
	};

	const createIterator = (): AsyncIterator<unknown> => {
		const iterator = stream[Symbol.asyncIterator]();

		return {
			next: async (value?: unknown) => {
				try {
					const result = await iterator.next(value);
					if (result.done) {
						await drainOnce();
					}
					return result;
				} catch (error) {
					await drainOnce();
					throw error;
				}
			},
			return: async (value?: unknown) => {
				try {
					if (typeof iterator.return === "function") {
						return await iterator.return(value);
					}
					return {
						done: true,
						value,
					};
				} finally {
					await drainOnce();
				}
			},
			throw: async (error?: unknown) => {
				try {
					if (typeof iterator.throw === "function") {
						return await iterator.throw(error);
					}
					throw error;
				} finally {
					await drainOnce();
				}
			},
		};
	};

	return new Proxy(stream as object, {
		get(target, property, receiver) {
			if (property === Symbol.asyncIterator) {
				return createIterator;
			}

			const value = Reflect.get(target, property, receiver);
			return typeof value === "function" ? value.bind(target) : value;
		},
	}) as TStream;
};

export class GraphBase<N extends string, T extends BaseStateBase, S = unknown> {
	protected workflow!: StateGraph<T, T, unknown, N | typeof START | typeof END>;
	protected app!: CompiledGraph<T>;
	protected services!: S;
	public abortController = new AbortController();

	constructor(services: S) {
		this.services = services;
	}

	static chat = {
		systemMessage: (
			messages: ChatCompletionMessageParam[],
			systemContent: string,
			options?: NormalizeChatMessageOptions,
		): ChatCompletionMessageParam[] =>
			normalizeChatMessages(messages, systemContent, options),
		assistantMessage: (
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
		toolMessage: (
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
		lastMessage: (messages: ChatCompletionMessageParam[]) =>
			messages[messages.length - 1],
		getToolCallMessage: (
			messages: ChatCompletionMessageParam[],
			toolCallId: string,
		) =>
			messages.find(
				(message) =>
					message.role === "tool" && message.tool_call_id === toolCallId,
			),
		addTool: (current: ToolName[], ...names: ToolName[]): ToolName[] => [
			...current,
			...names.filter((n) => !current.includes(n)),
		],
		removeTool: (current: ToolName[], ...names: ToolName[]): ToolName[] =>
			current.filter((n) => !names.includes(n)),
		replaceTool: (
			current: ToolName[],
			oldName: ToolName,
			newName: ToolName,
		): ToolName[] => current.map((n) => (n === oldName ? newName : n)),
		clearTools: (): ToolName[] => [],
		combineTools: (
			toolNames: readonly ToolName[],
			services?: unknown,
		): CombinedTool[] => {
			const executors = toolRegistry.getTools(toolNames, services);
			const openaiTools = convertToolsToOpenAI(executors);
			return executors.map((executor, i) => ({
				executor,
				tool: openaiTools[i],
			}));
		},
	};

	protected chat = GraphBase.chat;

	protected getRunLifecycle(
		runConfig?: LangGraphRunnableConfig,
	): FlowRunLifecycle | undefined {
		return getFlowRunLifecycle(runConfig);
	}

	protected onFinish(
		runConfig: LangGraphRunnableConfig | undefined,
		key: string,
		callback: FlowRunFinishCallback,
	): void {
		this.getRunLifecycle(runConfig)?.onFinish(key, callback);
	}

	private withRunLifecycle<
		TOptions extends { configurable?: object } | undefined,
	>(options: TOptions, runLifecycle: FlowRunLifecycle): TOptions {
		return {
			...(options ?? {}),
			configurable: {
				...(options?.configurable ?? {}),
				[FLOW_RUN_LIFECYCLE_CONFIG_KEY]: runLifecycle,
			},
		} as TOptions;
	}

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
		const existingLifecycle = getFlowRunLifecycle(options);
		const runLifecycle = existingLifecycle ?? createFlowRunLifecycle();
		const ownsLifecycle = !existingLifecycle;

		return (async () => {
			try {
				return await this.app.invoke(
					arg,
					this.withRunLifecycle(options, runLifecycle),
				);
			} finally {
				if (ownsLifecycle) {
					await runLifecycle.drain();
				}
			}
		})() as LangGraphInvokeResult<T>;
	}

	async stream(
		input: Partial<T>,
		options?: LangGraphStreamOptions<T>,
	): LangGraphStreamResult<T> {
		const arg = input as Parameters<typeof this.app.stream>[0];
		const existingLifecycle = getFlowRunLifecycle(options);
		const runLifecycle = existingLifecycle ?? createFlowRunLifecycle();
		const ownsLifecycle = !existingLifecycle;

		try {
			const stream = await this.app.stream(
				arg,
				this.withRunLifecycle(options, runLifecycle),
			);
			const wrappedStream = ownsLifecycle
				? wrapStreamWithLifecycle(stream as AsyncIterable<unknown>, () =>
						runLifecycle.drain(),
					)
				: stream;

			return wrappedStream as LangGraphStreamValue<T>;
		} catch (error) {
			if (ownsLifecycle) {
				await runLifecycle.drain();
			}
			throw error;
		}
	}

	getGraph() {
		return this.app.getGraph();
	}
}
