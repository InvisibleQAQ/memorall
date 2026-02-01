import { Annotation } from "@langchain/langgraph/web";
import type { ChatCompletionTool } from "@/types/openai";
import {
	type BaseStateBase,
	BaseAnnotation,
} from "@/services/flows/graph/graph.base";

export interface KnowledgeRAGConfig {
	/** Retrieval mode: standard (LLM-based), quick (fast semantic), smart (hybrid - default) */
	mode?: "standard" | "quick" | "smart";
	/** Response mode: simple (single LLM call) or agent (tool calling loop) */
	responseMode?: "simple" | "agent";
	/** Tools available for agent mode */
	tools?: ChatCompletionTool[];
	/** Max iterations for agent mode (default: 10) */
	maxIterations?: number;
	maxGrowthLevels?: number;
	searchLimit?: number;
}

// Graph growth configuration
export interface GraphGrowthConfig {
	maxLevels: number;
	nodesPerLevel: number;
	edgesPerLevel: number;
}

export interface KnowledgeRAGState extends BaseStateBase {
	// Input
	query: string;
	graphId?: string;
	// Core context for general knowledge retrieval (topic name + description)
	coreContext?: string;

	// Agent config (from input)
	tools?: ChatCompletionTool[];
	maxIterations: number;

	// Query Analysis
	extractedEntities: string[];
	queryIntent: "factual" | "relationship" | "summary" | "exploration";

	// Knowledge Retrieval
	relevantNodes: Array<{
		id: string;
		nodeType: string;
		name: string;
		summary: string;
		attributes: Record<string, unknown>;
		relevanceScore: number;
	}>;

	relevantEdges: Array<{
		id: string;
		sourceId: string;
		destinationId: string;
		edgeType: string;
		factText: string;
		attributes: Record<string, unknown>;
		relevanceScore: number;
	}>;

	// Context Building
	knowledgeContext: string;
}

export const KnowledgeRAGAnnotation = {
	...BaseAnnotation,
	query: Annotation<string>({
		value: (x, y) => y ?? x ?? "",
		default: () => "",
	}),
	graphId: Annotation<string | undefined>({
		value: (x, y) => y ?? x,
		default: () => undefined,
	}),
	coreContext: Annotation<string | undefined>({
		value: (x, y) => y ?? x,
		default: () => undefined,
	}),
	tools: Annotation<ChatCompletionTool[] | undefined>({
		value: (x, y) => y ?? x,
		default: () => undefined,
	}),
	maxIterations: Annotation<number>({
		value: (x, y) => y ?? x,
		default: () => 10,
	}),
	extractedEntities: Annotation<string[]>({
		value: (x, y) => y ?? x ?? [],
		default: () => [],
	}),
	queryIntent: Annotation<KnowledgeRAGState["queryIntent"]>({
		value: (x, y) => y ?? x ?? "factual",
		default: () => "factual" as const,
	}),
	relevantNodes: Annotation<KnowledgeRAGState["relevantNodes"]>({
		value: (x, y) => y ?? x ?? [],
		default: () => [],
	}),
	relevantEdges: Annotation<KnowledgeRAGState["relevantEdges"]>({
		value: (x, y) => y ?? x ?? [],
		default: () => [],
	}),
	knowledgeContext: Annotation<string>({
		value: (x, y) => y ?? x ?? "",
		default: () => "",
	}),
};
