import { Annotation } from "@langchain/langgraph/web";
import { BaseAnnotation, type BaseStateBase } from "../graph.base";

export interface AgentState extends BaseStateBase {
	/** Maximum iterations to prevent infinite loops */
	maxIterations: number;
	/** Current iteration count */
	currentIteration: number;
}

export const AgentAnnotation = Annotation.Root({
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
