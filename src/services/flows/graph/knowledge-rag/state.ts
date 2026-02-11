import { Annotation } from "@langchain/langgraph/web";
import {
	type BaseStateBase,
	type ToolName,
	BaseAnnotation,
} from "@/services/flows/graph/graph.base";

export interface KnowledgeRAGConfig {
	/** Retrieval mode: standard (LLM-based), quick (fast semantic), smart (hybrid - default) */
	mode?: "standard" | "quick" | "smart";
	/** Response mode: simple (single LLM call) or agent (tool calling loop) */
	responseMode?: "simple" | "agent";
	/** Tools available for agent mode */
	tools?: `${ToolName}`[];
	/** Max iterations for agent mode (default: 10) */
	maxIterations?: number;
	maxGrowthLevels?: number;
	searchLimit?: number;
	/** Custom system prompt (overrides default). Use {context} placeholder for knowledge context. */
	systemPrompt?: string;
	/** Custom context prompt (overrides default RESPONSE_GENERATION_PROMPT). */
	contextPrompt?: string;
	/** Whether to retrieve knowledge context before responding (default: true) */
	enableContextRetrieval?: boolean;
	/** Whether to add citations to responses (default: true) */
	enableCitations?: boolean;
}

export const DEFAULT_KNOWLEDGE_RAG_SYSTEM_PROMPT = `
You are a knowledgeable assistant.
Use the provided system context and answer clearly, accurately, and with structured sections when useful.
`.trim();

/** Default predefined config values (used by service for defaults + UI for reset) */
export const DEFAULT_KNOWLEDGE_RAG_PREDEFINED_CONFIG = {
	systemPrompt: "",
	contextPrompt: "",
	tools: ["current_time", "js_execute"] as string[],
	enableContextRetrieval: true,
	enableCitations: true,
};

/** Type for the subset of KnowledgeRAGConfig that is user-configurable */
export type KnowledgeRAGPredefinedConfig =
	typeof DEFAULT_KNOWLEDGE_RAG_PREDEFINED_CONFIG;

/** Canonical config keys that map to flow_configs rows */
export const KNOWLEDGE_RAG_CONFIG_KEYS = [
	{ name: "systemPrompt", type: "string" },
	{ name: "contextPrompt", type: "string" },
	{ name: "tools", type: "array" },
	{ name: "enableContextRetrieval", type: "boolean" },
	{ name: "enableCitations", type: "boolean" },
] as const;

// Graph growth configuration
export interface GraphGrowthConfig {
	maxLevels: number;
	nodesPerLevel: number;
	edgesPerLevel: number;
}

export interface KnowledgeRAGState extends BaseStateBase {
	// Input
	graphId?: string;
	// Additional search contexts (for example selected topic metadata)
	contextQueries: string[];

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
	context: string;
}

export const KnowledgeRAGAnnotation = {
	...BaseAnnotation,
	graphId: Annotation<string | undefined>({
		value: (x, y) => y ?? x,
		default: () => undefined,
	}),
	contextQueries: Annotation<string[]>({
		value: (x, y) => y ?? x ?? [],
		default: () => [],
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
	context: Annotation<string>({
		value: (x, y) => y ?? x ?? "",
		default: () => "",
	}),
};
