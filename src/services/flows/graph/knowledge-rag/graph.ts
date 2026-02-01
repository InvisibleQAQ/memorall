import { END, START, StateGraph } from "@langchain/langgraph/web";
import {
	KnowledgeRAGAnnotation,
	type KnowledgeRAGConfig,
	type KnowledgeRAGState,
} from "./state";
import { GraphBase } from "@/services/flows/graph/graph.base";
import type { AllServices } from "@/services/flows/interfaces/tool";
import type { ChatMessage } from "@/types/openai";
import { logError, logInfo } from "@/utils/logger";
import { flowRegistry } from "@/services/flows/flow-registry";
import { AgentGraph } from "@/services/flows/graph/agent";
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

	constructor(services: AllServices, config: KnowledgeRAGConfig = {}) {
		super(services);

		// Determine modes
		this.mode = config.mode ?? "smart";
		this.responseMode = config.responseMode ?? "simple";
		this.configTools = config.tools;

		this.workflow = new StateGraph(KnowledgeRAGAnnotation);

		const buildContextStep = stepRegistry.getStep('entities-facts-to-context', {})
		const citationStep = stepRegistry.getStep('entities-facts-citation', services)

		// Add common nodes
		this.workflow.addNode("build_context", (...args) => {
			return buildContextStep.execute(...args)
		});
		this.workflow.addNode("citation", (...args) => {
			return citationStep.execute(...args)
		});

		// Add response node based on responseMode
		if (this.responseMode === "agent") {
			this.workflow.addNode("agent_response", this.agentResponseNode);
		} else {
			this.workflow.addNode("generate_response", this.generateResponseNode);
		}

		// Add retrieval nodes and edges based on mode
		if (this.mode === "smart") {
			const smartRetrieveContextStep = stepRegistry.getStep('smart-retrieve', services)
			this.workflow.addNode(
				"smart_retrieve",
				(...args) => smartRetrieveContextStep.execute(...args),
			);
			this.workflow.addEdge(START, "smart_retrieve");
			this.workflow.addEdge("smart_retrieve", "build_context");
		} else if (this.mode === "quick") {
			const quickRetrieveContextStep = stepRegistry.getStep('quick-retrieve', services)
			this.workflow.addNode(
				"quick_retrieve",
				(...args) => quickRetrieveContextStep.execute(...args),
			);
			this.workflow.addEdge(START, "quick_retrieve");
			this.workflow.addEdge("quick_retrieve", "build_context");
		} else {
			const analyzeQueryStep = stepRegistry.getStep('analyze-query', services)
			const retrievalKnowledge = stepRegistry.getStep('retrieve-knowledge', services)
			this.workflow.addNode(
				"analyze_query",
				(...args) => analyzeQueryStep.execute(...args),
			);
			this.workflow.addNode(
				"retrieve_knowledge",
				(...args) => retrievalKnowledge.execute(...args),
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

		logInfo(`[KNOWLEDGE_RAG] Initialized with mode: ${this.mode}, responseMode: ${this.responseMode}`);
	}

	generateResponseNode = async (
		state: KnowledgeRAGState,
		_runConfig?: unknown,
	): Promise<Partial<KnowledgeRAGState>> => {
		const llm = this.services.llm;

		if (!llm.isReady()) {
			throw new Error("LLM service is not ready");
		}

		try {
			logInfo("[KNOWLEDGE_RAG] Generating final response");

			// Build system message with knowledge context
			const systemMessage: ChatMessage = {
				role: "system",
				content: RESPONSE_GENERATION_PROMPT.replace(
					"{context}",
					state.knowledgeContext,
				),
			};

			// Use full multimodal messages from input, prepending system message
			const messages: ChatMessage[] = [systemMessage, ...state.messages];

			const llmResponse = await llm.chatCompletions({
				messages,
				temperature: 0.2,
				stream: true,
			});

			let responseContent = "";
			if (Symbol.asyncIterator in llmResponse) {
				for await (const chunk of llmResponse) {
					responseContent += chunk.choices[0].delta.content || "";
					if (this.callbacks?.onNewChunk) {
						this.callbacks.onNewChunk(chunk);
					}
				}
			}

			return {
				finalMessage: responseContent,
				next: "citation",
			};
		} catch (error) {
			logError("[KNOWLEDGE_RAG] Response generation failed:", error);
			throw error;
		}
	};

	/**
	 * Agent response node: Execute AgentGraph as child graph
	 */
	agentResponseNode = async (
		state: KnowledgeRAGState,
		_runConfig?: unknown,
	): Promise<Partial<KnowledgeRAGState>> => {
		try {
			logInfo("[KNOWLEDGE_RAG] Executing agent workflow for response");

			// Build system message with knowledge context
			const systemMessage: ChatMessage = {
				role: "system",
				content: RESPONSE_GENERATION_PROMPT.replace(
					"{context}",
					state.knowledgeContext,
				),
			};

			// Create AgentGraph instance
			const agentGraph = new AgentGraph(this.services);

			// Set callbacks to forward chunks
			if (this.callbacks) {
				agentGraph.setCallbacks(this.callbacks);
			}

			// Prepare input for agent - prepend system message
			const agentInput = {
				messages: [systemMessage, ...state.messages],
				tools: state.tools ?? this.configTools,
				maxIterations: state.maxIterations,
				steps: [],
			};

			// Stream the agent graph execution
			const stream = await agentGraph.stream(agentInput);

			let finalMessage = "";
			const allActions: KnowledgeRAGState["actions"] = [];

			for await (const partial of stream) {
				// Extract finalMessage and actions from agent state
				for (const key of Object.keys(partial)) {
					const value = partial[key as keyof typeof partial] as Record<string, unknown>;
					if (value?.finalMessage) {
						finalMessage = value.finalMessage as string;
					}
				}
			}

			logInfo("[KNOWLEDGE_RAG] Agent workflow completed", {
				responseLength: finalMessage.length,
				actionsCount: allActions.length,
			});

			return {
				finalMessage,
				next: "citation",
				actions: [
					{
						id: crypto.randomUUID(),
						name: "agent_response",
						description: "Generated response using agent workflow",
						metadata: { responseLength: finalMessage.length },
					},
					...allActions,
				],
			};
		} catch (error) {
			logError("[KNOWLEDGE_RAG] Agent response failed:", error);
			throw error;
		}
	};
}

// Self-register the flow
flowRegistry.register({
	flowType: "knowledge-rag",
	factory: (services) => new KnowledgeRAGFlow(services),
});

// Extend global FlowTypeRegistry for type-safe flow creation
declare global {
	interface FlowTypeRegistry {
		"knowledge-rag": {
			services: AllServices;
			flow: KnowledgeRAGFlow;
		};
	}
}
