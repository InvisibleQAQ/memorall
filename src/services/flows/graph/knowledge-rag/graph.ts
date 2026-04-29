import { END, START, StateGraph } from "@langchain/langgraph/web";
import {
	DEFAULT_KNOWLEDGE_RAG_SYSTEM_PROMPT,
	KnowledgeRAGAnnotation,
	type KnowledgeRAGState,
} from "./state";
import { GraphBase } from "@/services/flows/graph/graph.base";
import type { AllServices } from "@/services/flows/interfaces/tool";
import { logInfo } from "@/utils/logger";
import { flowRegistry, FEATURE_SLOT } from "@/services/flows/flow-registry";
import { chatFlowRegistry } from "@/services/flows/chat-flow-registry";
import type { UnifiedFlowConfig } from "@/services/flows/interfaces/flow-config";

/**
 * Knowledge RAG Flow
 *
 * A config-driven graph that chains whatever steps are enabled in
 * UnifiedFlowConfig.steps in order.  The constructor has zero knowledge of
 * specific step names — retrieval, features, completion, and citations are
 * all just entries in the steps array.
 *
 * Topology: START → step__<id1> → step__<id2> → … → END
 */
export class KnowledgeRAGFlow extends GraphBase<
	string,
	KnowledgeRAGState,
	AllServices
> {
	constructor(services: AllServices, config: UnifiedFlowConfig) {
		super(services);

		this.workflow = new StateGraph(KnowledgeRAGAnnotation);

		const nodeNames = this.addStepNodes(this.workflow, config, services);

		if (nodeNames.length === 0) {
			throw new Error(
				"[KnowledgeRAGFlow] No enabled steps in config — cannot build graph",
			);
		}

		// Linear chain: START → node[0] → node[1] → … → END
		this.chainNodes(this.workflow, [START, ...nodeNames, END]);

		this.compile();

		logInfo(
			`[KNOWLEDGE_RAG] Initialized with ${nodeNames.length} step(s): [${config.steps
				.filter((s) => s.enabled)
				.map((s) => s.name)
				.join(", ")}]`,
		);
	}
}

// ---------------------------------------------------------------------------
// Self-registration
// ---------------------------------------------------------------------------

flowRegistry.register({
	flowType: "knowledge-rag",
	stepDefaults: {
		"add-system": { content: DEFAULT_KNOWLEDGE_RAG_SYSTEM_PROMPT },
	},
	stepOrder: [
		"add-system",
		"context-smart-retrieve",
		"context-quick-retrieve",
		"context-llm-retrieve",
		"structmem-retrieve",
		FEATURE_SLOT,
		"agent-completion",
		"chat-completion",
		"entities-facts-citation",
	],
	factory: (services, config) =>
		new KnowledgeRAGFlow(services, config as UnifiedFlowConfig),
});

// Chat flow registry — used by process-chat.ts via chatFlowRegistry.create(…)
chatFlowRegistry.register("knowledge-rag", (services, config) => {
	const graph = new KnowledgeRAGFlow(services, config);
	return {
		graph,
		getInitialState: (ctx) => ({
			messages: ctx.messages,
			graphId: ctx.topicId,
			contextQueries: ctx.contextQueries,
			// tools starts empty; feature steps accumulate into state,
			// and agent-completion merges config.tools on top at runtime.
			tools: [],
		}),
	};
});

// Extend global FlowTypeRegistry for type-safe flow creation
declare global {
	interface FlowTypeRegistry {
		"knowledge-rag": {
			services: AllServices;
			config: UnifiedFlowConfig;
			flow: KnowledgeRAGFlow;
		};
	}
}
