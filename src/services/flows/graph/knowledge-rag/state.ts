import { Annotation } from "@langchain/langgraph/web";
import type { ChatMessage, ChatCompletionTool } from "@/types/openai";
import {
	type BaseStateBase,
	BaseAnnotation,
} from "@/services/flows/interfaces/graph.base";

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
	messages: ChatMessage[];
	query: string;
	graphId?: string;

	// Core context for general knowledge retrieval (topic name + description)
	coreContext?: string;

	// Agent config (from input)
	tools?: ChatCompletionTool[];
	maxIterations: number;
	currentIteration: number;

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

	// Steps for tracking progress
	steps: Array<{
		role: "assistant" | "tool" | "user";
		content: string | null;
		tool_calls?: Array<{
			id: string;
			type: "function";
			function: { name: string; arguments: string };
		}>;
		tool_call_id?: string;
	}>;

	// Flow control
	next?:
		| "analyze_query"
		| "retrieve_knowledge"
		| "build_context"
		| "generate_response"
		| "agent_response"
		| "execute_tools"
		| "citation";
}

export const KnowledgeRAGAnnotation = {
	...BaseAnnotation,
	messages: Annotation<ChatMessage[]>({
		value: (x, y) => y ?? x ?? [],
		default: () => [],
	}),
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
	currentIteration: Annotation<number>({
		value: (x, y) => y ?? x,
		default: () => 0,
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
	steps: Annotation<KnowledgeRAGState["steps"]>({
		value: (x, y) => {
			if (!x) return y ?? [];
			if (!y) return x;
			return x.concat(y);
		},
		default: () => [],
	}),
	next: Annotation<KnowledgeRAGState["next"]>({
		value: (x, y) => y ?? x,
		default: () => undefined,
	}),
};
