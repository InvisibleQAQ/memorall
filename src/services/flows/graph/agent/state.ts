import { Annotation } from "@langchain/langgraph/web";
import {
	BaseAnnotation,
	type BaseStateBase,
} from "../../interfaces/graph.base";
import type {
	ChatCompletionMessageParam,
	ChatCompletionMessageToolCall,
} from "@/types/openai";

export interface AgentStep {
	role: "assistant" | "tool";
	content: string | null;
	tool_calls?: ChatCompletionMessageToolCall[];
	tool_call_id?: string;
}

export interface AgentState extends BaseStateBase {
	/** Input messages from user */
	messages: ChatCompletionMessageParam[];
	/** Intermediate steps (assistant responses and tool results) */
	steps: AgentStep[];
	/** Maximum iterations to prevent infinite loops */
	maxIterations: number;
	/** Current iteration count */
	currentIteration: number;
}

export const AgentAnnotation = Annotation.Root({
	messages: Annotation<AgentState["messages"]>({
		value: (x, y) => x.concat(y),
		default: () => [],
	}),
	steps: Annotation<AgentState["steps"]>({
		value: (x, y) => x.concat(y),
		default: () => [],
	}),
	maxIterations: Annotation<number>({
		value: (x, y) => y ?? x,
		default: () => 10,
	}),
	currentIteration: Annotation<number>({
		value: (x, y) => y ?? x,
		default: () => 0,
	}),
	...BaseAnnotation,
});
