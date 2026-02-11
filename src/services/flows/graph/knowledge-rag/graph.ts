import { END, START, StateGraph } from "@langchain/langgraph/web";
import {
	KnowledgeRAGAnnotation,
	DEFAULT_KNOWLEDGE_RAG_SYSTEM_PROMPT,
	type KnowledgeRAGConfig,
	type KnowledgeRAGState,
} from "./state";
import { GraphBase } from "@/services/flows/graph/graph.base";
import type { AllServices } from "@/services/flows/interfaces/tool";
import { logInfo } from "@/utils/logger";
import { flowRegistry } from "@/services/flows/flow-registry";
import { stepRegistry } from "@/services/flows/step-registry";

export class KnowledgeRAGFlow extends GraphBase<
	"context_retrieve" | "completion" | "citation",
	KnowledgeRAGState,
	AllServices
> {
	private mode: "standard" | "quick" | "smart";
	private responseMode: "simple" | "agent";

	constructor(services: AllServices, config: KnowledgeRAGConfig = {}) {
		super(services);

		// Determine modes
		this.mode = config.mode ?? "smart";
		this.responseMode = config.responseMode ?? "simple";

		const enableContextRetrieval = config.enableContextRetrieval !== false;
		const enableCitations = config.enableCitations !== false;

		// Prompt construct
		const agentPrompt = config.systemPrompt?.trim() || DEFAULT_KNOWLEDGE_RAG_SYSTEM_PROMPT;

		this.workflow = new StateGraph(KnowledgeRAGAnnotation);

		// Add citation node only if enabled
		if (enableCitations) {
			const citationStep = stepRegistry.getStep(
				"entities-facts-citation",
				services,
			);
			this.workflow.addNode("citation", citationStep.toNode());
		}

		const afterFinalResponse = enableCitations ? "citation" : undefined;

		// Add response node based on responseMode
		if (this.responseMode === "agent") {
			const agentCompletionStep = stepRegistry.getStep(
				"agent-completion",
				services,
			);
			this.workflow.addNode(
				"completion",
				agentCompletionStep.toNode<KnowledgeRAGState>({
					mapInput: (state) => {
						const responseMessages = this.chat.systemMessage(
							state.messages,
							agentPrompt,
							{
								placement: "top",
							},
						);
						return {
							tools: state.tools,
							messages: responseMessages,
							maxIterations: state.maxIterations,
						};
					},
					mapOutput: (output) => ({
						response: output.response,
						...(afterFinalResponse ? { next: afterFinalResponse } : {}),
					}),
				}),
			);
		} else {
			const chatCompletionStep = stepRegistry.getStep(
				"chat-completion",
				services,
			);
			this.workflow.addNode(
				"completion",
				chatCompletionStep.toNode<KnowledgeRAGState>({
					mapInput: (state) => {
						const responseMessages = this.chat.systemMessage(
							state.messages,
							agentPrompt,
							{
								placement: "top",
							},
						);
						return {
							tools: state.tools,
							messages: responseMessages,
							temperature: 0.2,
							stream: true,
						};
					},
					mapOutput: (output) => ({
						response: output.response,
						...(afterFinalResponse ? { next: afterFinalResponse } : {}),
					}),
				}),
			);
		}

		// Add retrieval nodes and edges based on mode
		if (enableContextRetrieval) {
			if (this.mode === "smart") {
				const contextSmartRetrieveStep = stepRegistry.getStep(
					"context-smart-retrieve",
					services,
				);
				this.workflow.addNode(
					"context_retrieve",
					contextSmartRetrieveStep.toNode<KnowledgeRAGState>({
						mapOutput: (output) => ({
							context: output.context,
							messages: output.messages,
							relevantNodes: output.relevantNodes ?? [],
							relevantEdges: output.relevantEdges ?? [],
						}),
					}),
				);
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
							context: output.context,
							messages: output.messages,
							relevantNodes: output.relevantNodes ?? [],
							relevantEdges: output.relevantEdges ?? [],
						}),
					}),
				);
			} else {
				const contextRetrieveKnowledgeStep = stepRegistry.getStep(
					"context-llm-retrieve",
					services,
				);
				this.workflow.addNode(
					"context_retrieve",
					contextRetrieveKnowledgeStep.toNode<KnowledgeRAGState>({
						mapOutput: (output) => ({
							context: output.context,
							messages: output.messages,
							relevantNodes: output.relevantNodes ?? [],
							relevantEdges: output.relevantEdges ?? [],
						}),
					}),
				);
			}
			this.workflow.addEdge(START, "context_retrieve");
			this.workflow.addEdge("context_retrieve", "completion");
		} else {
			// Skip context retrieval: START -> completion directly
			this.workflow.addEdge(START, "completion");
		}

		if (enableCitations) {
			this.workflow.addEdge("completion", "citation");
			this.workflow.addEdge("citation", END);
		} else {
			this.workflow.addEdge("completion", END);
		}

		this.compile();

		logInfo(
			`[KNOWLEDGE_RAG] Initialized with mode: ${this.mode}, responseMode: ${this.responseMode}, contextRetrieval: ${enableContextRetrieval}, citations: ${enableCitations}, tools: ${config.tools}`,
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
