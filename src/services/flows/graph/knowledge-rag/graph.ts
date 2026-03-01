import { END, START, StateGraph } from "@langchain/langgraph/web";
import {
	KnowledgeRAGAnnotation,
	DEFAULT_KNOWLEDGE_RAG_SYSTEM_PROMPT,
	type KnowledgeRAGConfig,
	type KnowledgeRAGState,
} from "./state";
import { GraphBase } from "@/services/flows/graph/graph.base";
import type { AllServices } from "@/services/flows/interfaces/tool";
import { logInfo, logWarn } from "@/utils/logger";
import { flowRegistry } from "@/services/flows/flow-registry";
import { chatFlowRegistry } from "@/services/flows/chat-flow-registry";
import { stepRegistry } from "@/services/flows/step-registry";
import { getFeatureCatalogSteps } from "@/services/flows/flow-builder-catalog";
import type { ToolName } from "@/services/flows/graph/graph.base";

export class KnowledgeRAGFlow extends GraphBase<
	string,
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
		const featureFlags = config.featureFlags ?? {};

		// Prompt construct
		const agentPrompt =
			config.systemPrompt?.trim() || DEFAULT_KNOWLEDGE_RAG_SYSTEM_PROMPT;

		this.workflow = new StateGraph(KnowledgeRAGAnnotation);

		// Collect enabled feature step names from catalog
		const enabledFeatureNodes: string[] = [];
		const catalogFeatures = getFeatureCatalogSteps();
		for (const catalogStep of catalogFeatures) {
			if (!featureFlags[catalogStep.name]) continue;
			if (!stepRegistry.hasStep(catalogStep.name)) {
				logWarn(
					`[KNOWLEDGE_RAG] Feature step "${catalogStep.name}" not found in registry, skipping`,
				);
				continue;
			}

			const featureStep = stepRegistry.getStepByName<
				{
					messages: KnowledgeRAGState["messages"];
					tools: KnowledgeRAGState["tools"];
				},
				{
					messages?: KnowledgeRAGState["messages"];
					tools?: KnowledgeRAGState["tools"];
				}
			>(catalogStep.name);
			const nodeName = `feature_${catalogStep.name}`;
			this.workflow.addNode(
				nodeName,
				featureStep.toNode<KnowledgeRAGState>({
					mapInput: (state) => ({
						messages: state.messages,
						tools: state.tools,
					}),
					mapOutput: (output) => ({
						...(output.messages ? { messages: output.messages } : {}),
						...(output.tools ? { tools: output.tools } : {}),
					}),
				}),
			);
			enabledFeatureNodes.push(nodeName);
		}

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

		// Build edge chain: START -> [context_retrieve?] -> [features...] -> completion -> [citation?] -> END
		// Determine the node before completion (features run after retrieval, before completion)
		let preCompletionNode: string | typeof START;

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
			preCompletionNode = "context_retrieve";
		} else {
			preCompletionNode = START;
		}

		// Chain feature nodes: preCompletionNode -> feature1 -> feature2 -> ... -> completion
		if (enabledFeatureNodes.length > 0) {
			this.workflow.addEdge(preCompletionNode, enabledFeatureNodes[0]);
			for (let i = 0; i < enabledFeatureNodes.length - 1; i++) {
				this.workflow.addEdge(
					enabledFeatureNodes[i],
					enabledFeatureNodes[i + 1],
				);
			}
			this.workflow.addEdge(
				enabledFeatureNodes[enabledFeatureNodes.length - 1],
				"completion",
			);
		} else {
			this.workflow.addEdge(preCompletionNode, "completion");
		}

		if (enableCitations) {
			this.workflow.addEdge("completion", "citation");
			this.workflow.addEdge("citation", END);
		} else {
			this.workflow.addEdge("completion", END);
		}

		this.compile();

		const enabledFeatures = enabledFeatureNodes.map((n) =>
			n.replace("feature_", ""),
		);
		logInfo(
			`[KNOWLEDGE_RAG] Initialized with mode: ${this.mode}, responseMode: ${this.responseMode}, contextRetrieval: ${enableContextRetrieval}, citations: ${enableCitations}, tools: ${config.tools}, features: [${enabledFeatures.join(", ")}]`,
		);
	}
}

// Self-register the flow
flowRegistry.register({
	flowType: "knowledge-rag",
	factory: (services, config) => new KnowledgeRAGFlow(services, config),
});

// Register as a chat-capable flow so process-chat.ts can create it generically
chatFlowRegistry.register("knowledge-rag", (services, config, featureFlags) => {
	const graph = new KnowledgeRAGFlow(services, {
		responseMode: "agent",
		systemPrompt: config.systemPrompt || undefined,
		contextPrompt: config.contextPrompt || undefined,
		enableContextRetrieval: config.enableContextRetrieval,
		enableCitations: config.enableCitations,
		tools: config.tools as `${ToolName}`[],
		featureFlags,
	});
	return {
		graph,
		getInitialState: (ctx) => ({
			messages: ctx.messages,
			graphId: ctx.topicId,
			contextQueries: ctx.contextQueries,
			tools: (config.tools ?? []) as `${ToolName}`[],
		}),
	};
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
