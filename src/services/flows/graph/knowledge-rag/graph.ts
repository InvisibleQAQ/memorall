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
	| "context_retrieve"
	| "final_response"
	| "emit_context"
	| "citation",
	KnowledgeRAGState,
	AllServices
> {
	private mode: "standard" | "quick" | "smart";
	private responseMode: "simple" | "agent";
	private configTools?: KnowledgeRAGConfig["tools"];

	constructor(services: AllServices, config: KnowledgeRAGConfig = {}) {
		super(services);

		// Determine modes
		this.mode = config.mode ?? "smart";
		this.responseMode = config.responseMode ?? "simple";
		this.configTools = config.tools;

		this.workflow = new StateGraph(KnowledgeRAGAnnotation);

		const citationStep = stepRegistry.getStep(
			"entities-facts-citation",
			services,
		);
		const chatCompletionStep = stepRegistry.getStep("chat-completion", services);
		const agentCompletionStep = stepRegistry.getStep(
			"agent-completion",
			services,
		);
		const emitContextStep = stepRegistry.getStep("add-system", {})

		// Add citation node
		this.workflow.addNode("citation", citationStep.toNode());
		this.workflow.addNode("emit_context", emitContextStep.toNode<KnowledgeRAGState>({
			mapInput: (state) => {
				const systemMessage = RESPONSE_GENERATION_PROMPT.replace(
					"{context}",
					state.knowledgeContext,
				);
				return {
					messages: this.chat.system(state.messages, systemMessage),
					content: state.knowledgeContext,
				}
			}
		}));

		// Add response node based on responseMode
		if (this.responseMode === "agent") {
			this.workflow.addNode(
				"final_response",
				agentCompletionStep.toNode<KnowledgeRAGState>({
					mapInput: (state) => {
						return {
							messages: state.messages,
							tools: state.tools ?? this.configTools,
							maxIterations: state.maxIterations,
						};
					},
					mapOutput: (output) => ({
						response: output.response,
						next: "citation",
					}),
				}),
			);
		} else {
			this.workflow.addNode(
				"final_response",
				chatCompletionStep.toNode<KnowledgeRAGState>({
					mapInput: (state) => {
						return {
							messages: state.messages,
							temperature: 0.2,
							stream: true,
						};
					},
					mapOutput: (output) => ({
						response: output.response,
						next: "citation",
					}),
				}),
			);
		}

		// Add retrieval nodes and edges based on mode
		// Each mode uses a combined step (retrieve + build_context in one)
		if (this.mode === "smart") {
			const contextSmartRetrieveStep = stepRegistry.getStep(
				"context-smart-retrieve",
				services,
			);
			this.workflow.addNode(
				"context_retrieve",
				contextSmartRetrieveStep.toNode<KnowledgeRAGState>({
					mapOutput: (output) => ({
						knowledgeContext: output.context,
						relevantNodes: output.relevantNodes ?? [],
						relevantEdges: output.relevantEdges ?? [],
					}),
				}),
			);
			this.workflow.addEdge(START, "context_retrieve");
			this.workflow.addEdge("context_retrieve", 'emit_context');
		} else if (this.mode === "quick") {
			const contextQuickRetrieveStep = stepRegistry.getStep(
				"context-quick-retrieve",
				services,
				{
					maxGrowthLevels: config.maxGrowthLevels,
					searchLimit: config.searchLimit,
				},
			);
			this.workflow.addNode(
				"context_retrieve",
				contextQuickRetrieveStep.toNode<KnowledgeRAGState>({
					mapOutput: (output) => ({
						knowledgeContext: output.context,
						relevantNodes: output.relevantNodes ?? [],
						relevantEdges: output.relevantEdges ?? [],
					}),
				}),
			);
			this.workflow.addEdge(START, "context_retrieve");
			this.workflow.addEdge("context_retrieve", 'emit_context');
		} else {
			const contextRetrieveKnowledgeStep = stepRegistry.getStep(
				"context-llm-retrieve",
				services,
			);
			this.workflow.addNode(
				"context_retrieve",
				contextRetrieveKnowledgeStep.toNode<KnowledgeRAGState>({
					mapOutput: (output) => ({
						knowledgeContext: output.context,
						relevantNodes: output.relevantNodes ?? [],
						relevantEdges: output.relevantEdges ?? [],
					}),
				}),
			);
			this.workflow.addEdge(START, "context_retrieve");
			this.workflow.addEdge("context_retrieve", 'emit_context');
		}

		// Common edges
		this.workflow.addEdge('emit_context', "final_response");
		this.workflow.addEdge('final_response', "citation");
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
