import { END, START, StateGraph } from "@langchain/langgraph/web";
import {
	KnowledgeRAGAnnotation,
	type KnowledgeRAGConfig,
	type KnowledgeRAGState,
} from "./state";
import { GraphBase } from "@/services/flows/graph/graph.base";
import type { AllServices } from "@/services/flows/interfaces/tool";
import { logInfo } from "@/utils/logger";
import { flowRegistry } from "@/services/flows/flow-registry";
import { stepRegistry } from "@/services/flows/step-registry";

const RESPONSE_GENERATION_PROMPT = `
You are a knowledgeable assistant that can answer questions using a knowledge graph.

Available Knowledge Context:
{context}

Using the provided knowledge context, provide a comprehensive and accurate answer to the user's query.
If the knowledge graph doesn't contain enough information to fully answer the question, mention what information is available and what might be missing.
Following below order of information:
1. If information to answer available in knowledge graph use it to answer the question.
2. If information to answer not available in knowledge graph use your general knowledge to answer the question.
Structure your answer in clear sections when appropriate.
`;

export class KnowledgeRAGFlow extends GraphBase<
	| "analyze_query"
	| "retrieve_knowledge"
	| "quick_retrieve"
	| "smart_retrieve"
	| "build_context"
	| "generate_response"
	| "agent_response"
	| "citation",
	KnowledgeRAGState,
	AllServices
> {
	private mode: "standard" | "quick" | "smart";
	private responseMode: "simple" | "agent";
	private configTools?: KnowledgeRAGConfig["tools"];
	private chatCompletionStep!: ReturnType<
		typeof stepRegistry.getStep<"chat-completion">
	>;
	private agentCompletionStep!: ReturnType<
		typeof stepRegistry.getStep<"agent-completion">
	>;

	constructor(services: AllServices, config: KnowledgeRAGConfig = {}) {
		super(services);

		// Determine modes
		this.mode = config.mode ?? "smart";
		this.responseMode = config.responseMode ?? "simple";
		this.configTools = config.tools;

		this.workflow = new StateGraph(KnowledgeRAGAnnotation);

		const buildContextStep = stepRegistry.getStep(
			"entities-facts-to-context",
			{},
		);
		const citationStep = stepRegistry.getStep(
			"entities-facts-citation",
			services,
		);
		this.chatCompletionStep = stepRegistry.getStep("chat-completion", services);
		this.agentCompletionStep = stepRegistry.getStep(
			"agent-completion",
			services,
		);

		// Add common nodes
		this.workflow.addNode("build_context", buildContextStep.toNode());
		this.workflow.addNode("citation", citationStep.toNode());

		// Add response node based on responseMode
		if (this.responseMode === "agent") {
			this.workflow.addNode(
				"agent_response",
				this.agentCompletionStep.toNode<KnowledgeRAGState>({
					mapInput: (state) => {
						const systemMessage = RESPONSE_GENERATION_PROMPT.replace(
							"{context}",
							state.knowledgeContext,
						);
						return {
							messages: this.chat.system(state.messages, systemMessage),
							tools: state.tools ?? this.configTools,
							maxIterations: state.maxIterations,
						};
					},
					mapOutput: (output) => ({
						finalMessage: output.finalMessage,
						next: "citation",
					}),
				}),
			);
		} else {
			this.workflow.addNode(
				"generate_response",
				this.chatCompletionStep.toNode<KnowledgeRAGState>({
					mapInput: (state) => {
						const systemMessage = RESPONSE_GENERATION_PROMPT.replace(
							"{context}",
							state.knowledgeContext,
						);
						return {
							messages: this.chat.system(state.messages, systemMessage),
							temperature: 0.2,
							stream: true,
						};
					},
					mapOutput: (output) => ({
						finalMessage: output.finalMessage,
						next: "citation",
					}),
				}),
			);
		}

		// Add retrieval nodes and edges based on mode
		if (this.mode === "smart") {
			const smartRetrieveContextStep = stepRegistry.getStep(
				"smart-retrieve",
				services,
			);
			this.workflow.addNode(
				"smart_retrieve",
				smartRetrieveContextStep.toNode(),
			);
			this.workflow.addEdge(START, "smart_retrieve");
			this.workflow.addEdge("smart_retrieve", "build_context");
		} else if (this.mode === "quick") {
			const quickRetrieveContextStep = stepRegistry.getStep(
				"quick-retrieve",
				services,
			);
			this.workflow.addNode(
				"quick_retrieve",
				quickRetrieveContextStep.toNode(),
			);
			this.workflow.addEdge(START, "quick_retrieve");
			this.workflow.addEdge("quick_retrieve", "build_context");
		} else {
			const analyzeQueryStep = stepRegistry.getStep("analyze-query", services);
			const retrievalKnowledge = stepRegistry.getStep(
				"retrieve-knowledge",
				services,
			);
			this.workflow.addNode("analyze_query", analyzeQueryStep.toNode());
			this.workflow.addNode(
				"retrieve_knowledge",
				retrievalKnowledge.toNode(),
			);
			this.workflow.addEdge(START, "analyze_query");
			this.workflow.addEdge("analyze_query", "retrieve_knowledge");
			this.workflow.addEdge("retrieve_knowledge", "build_context");
		}

		// Add edges based on responseMode
		if (this.responseMode === "agent") {
			this.workflow.addEdge("build_context", "agent_response");
			this.workflow.addEdge("agent_response", "citation");
		} else {
			this.workflow.addEdge("build_context", "generate_response");
			this.workflow.addEdge("generate_response", "citation");
		}
		this.workflow.addEdge("citation", END);

		this.compile();

		logInfo(
			`[KNOWLEDGE_RAG] Initialized with mode: ${this.mode}, responseMode: ${this.responseMode}`,
		);
	}
}

// Self-register the flow
flowRegistry.register({
	flowType: "knowledge-rag",
	factory: (services, config) => new KnowledgeRAGFlow(services, config),
});

// Extend global FlowTypeRegistry for type-safe flow creation
declare global {
	interface FlowTypeRegistry {
		"knowledge-rag": {
			services: AllServices;
			config: KnowledgeRAGConfig;
			flow: KnowledgeRAGFlow;
		};
	}
}
