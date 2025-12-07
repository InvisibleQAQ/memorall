import { END, START, StateGraph } from "@langchain/langgraph/web";
import {
	KnowledgeRAGAnnotation,
	type KnowledgeRAGConfig,
	type KnowledgeRAGState,
} from "./state";
import { GraphBase } from "@/services/flows/interfaces/graph.base";
import type { AllServices } from "@/services/flows/interfaces/tool";
import type { ChatMessage } from "@/types/openai";
import { logError, logInfo } from "@/utils/logger";
import { flowRegistry } from "../../flow-registry";
import { RetrievalContextFlow } from "./retrieval";
import { QuickRetrievalContextFlow } from "./quick-retrieval";

const RESPONSE_GENERATION_PROMPT = `
You are a knowledgeable assistant that can answer questions using a knowledge graph.

User Query: {query}

Available Knowledge Context:
{context}

Using the provided knowledge context, provide a comprehensive and accurate answer to the user's query.
If the knowledge graph doesn't contain enough information to fully answer the question, mention what information is available and what might be missing.
Structure your answer in clear sections when appropriate.
`;

const CITATION_PROMPT = `
You are tasked with identifying which knowledge sources were used in each line of an answer.

Answer with Line Numbers:
{answer}

Knowledge Sources Available:
{sources}

Instructions:
1. For each line that uses knowledge sources, identify which nodes and edges were used
2. Return ONLY line numbers with their citations in this exact format:
   Line X: [Label](#citations:node/{uuid}), [Label](#citation:edge/{uuid})
3. Use actual UUIDs from the knowledge sources list
4. Only include lines that need citations - skip lines that don't use knowledge sources
5. CRITICAL: For nodes, the link MUST start with "#": [Label](#citations:node/{uuid})
6. CRITICAL: For edges, the link MUST start with "#": [Label](#citation:edge/{uuid})
7. IMPORTANT: The "#" symbol at the start of the link is REQUIRED - DO NOT omit it
8. IMPORTANT: DO NOT add citations to table rows (lines starting with "|") - tables should remain citation-free
9. IMPORTANT: DO NOT add citations to table separator lines (lines with "---" or "|---|")
10. IMPORTANT: For tables, add citations on the line AFTER the table ends (after the last row)
11. Do not include any explanation or the original text - ONLY line numbers and citations

Example format (notice the "#" at the start of each link):
Line 1: [React](#citations:node/abc-123)
Line 3: [uses](#citation:edge/def-456), [JavaScript](#citations:node/ghi-789)

Example for tables:
Line 15: [Table Data](#citations:node/abc-123), [Source](#citation:edge/def-456)
(Where line 15 is the line AFTER the table ends, not the table rows themselves)

REMINDER:
- Every citation link MUST start with "#" - this is mandatory!
- Skip all table lines (any line containing "|" for table formatting)
- Cite tables on the line immediately after the table ends
`;

export class KnowledgeRAGFlow extends GraphBase<
	| "analyze_query"
	| "retrieve_knowledge"
	| "quick_retrieve"
	| "build_context"
	| "generate_response"
	| "citation",
	KnowledgeRAGState,
	AllServices
> {
	private quickMode: boolean;
	private retrieveContext: RetrievalContextFlow;
	private quickRetrieveContext: QuickRetrievalContextFlow;

	constructor(services: AllServices, config: KnowledgeRAGConfig = {}) {
		super(services);
		this.quickMode = config.quickMode || false;
		this.workflow = new StateGraph(KnowledgeRAGAnnotation);
		this.retrieveContext = new RetrievalContextFlow(services);
		this.quickRetrieveContext = new QuickRetrievalContextFlow(services, config);

		// Add common nodes
		this.workflow.addNode("build_context", this.buildContextNode);
		this.workflow.addNode("generate_response", this.generateResponseNode);
		this.workflow.addNode("citation", this.citationNode);

		// Add nodes and edges based on configuration
		if (this.quickMode) {
			// Quick mode: skip query analysis and go straight to semantic search
			this.workflow.addNode(
				"quick_retrieve",
				this.quickRetrieveContext.quickRetrieveNode,
			);
			this.workflow.addEdge(START, "quick_retrieve");
			this.workflow.addEdge("quick_retrieve", "build_context");
		} else {
			// Standard mode: use LLM analysis
			this.workflow.addNode(
				"analyze_query",
				this.retrieveContext.analyzeQueryNode,
			);
			this.workflow.addNode(
				"retrieve_knowledge",
				this.retrieveContext.retrieveKnowledgeNode,
			);
			this.workflow.addEdge(START, "analyze_query");
			this.workflow.addEdge("analyze_query", "retrieve_knowledge");
			this.workflow.addEdge("retrieve_knowledge", "build_context");
		}

		this.workflow.addEdge("build_context", "generate_response");
		this.workflow.addEdge("generate_response", "citation");
		this.workflow.addEdge("citation", END);

		// Compile the workflow
		this.compile();
	}

	buildContextNode = async (
		state: KnowledgeRAGState,
	): Promise<Partial<KnowledgeRAGState>> => {
		try {
			logInfo(
				"[KNOWLEDGE_RAG] Building knowledge context in natural language format",
			);

			if (!state.relevantNodes?.length || !state.relevantEdges?.length) {
				return {
					knowledgeContext: "",
					next: "generate_response",
					actions: [],
				};
			}

			// 1. Build definitions section - entity names and summaries
			const definitions = state.relevantNodes
				.map((node) => `${node.name}: ${node.summary}.`)
				.join("\n");

			// 2. Build facts section - entity connections with fact text
			const facts = state.relevantEdges
				.map((edge) => {
					const sourceName =
						state.relevantNodes.find((n) => n.id === edge.sourceId)?.name ||
						"Unknown";
					const destName =
						state.relevantNodes.find((n) => n.id === edge.destinationId)
							?.name || "Unknown";
					return `${sourceName} ${edge.edgeType} ${destName}, ${edge.factText}.`;
				})
				.join("\n");

			// 3. Build natural language context
			const knowledgeContext = `
${definitions.trim() ? `<definitions>${definitions}</definitions>` : ""}
${facts.trim() ? `<facts>${facts}</facts>` : ""}`;

			logInfo("[KNOWLEDGE_RAG] Built natural language context:", {
				definitionsLength: definitions.length,
				factsLength: facts.length,
				nodesCount: state.relevantNodes.length,
				edgesCount: state.relevantEdges.length,
			});

			return {
				knowledgeContext,
				next: "generate_response",
				actions: [
					{
						id: crypto.randomUUID(),
						name: "knowledge_graph",
						description: `Retrieved ${state.relevantNodes.length} nodes and ${state.relevantEdges.length} edges`,
						metadata: {
							nodes: state.relevantNodes,
							edges: state.relevantEdges,
						},
					},
					{
						id: crypto.randomUUID(),
						name: "context_knowledge",
						description: knowledgeContext,
						metadata: {},
					},
				],
			};
		} catch (error) {
			logError("[KNOWLEDGE_RAG] Context building failed:", error);
			throw error;
		}
	};

	generateResponseNode = async (
		state: KnowledgeRAGState,
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
					"{query}",
					state.query,
				).replace("{context}", state.knowledgeContext),
			};

			// Use full multimodal messages from input, prepending system message
			const messages: ChatMessage[] = [systemMessage, ...state.messages];

			const llmResponse = await llm.chatCompletions({
				messages,
				temperature: 0.3,
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
				actions: [
					{
						id: crypto.randomUUID(),
						name: "response_generation",
						description: "Generated knowledge-based response",
						metadata: { responseLength: responseContent.length },
					},
				],
			};
		} catch (error) {
			logError("[KNOWLEDGE_RAG] Response generation failed:", error);
			throw error;
		}
	};

	citationNode = async (
		state: KnowledgeRAGState,
	): Promise<Partial<KnowledgeRAGState>> => {
		const llm = this.services.llm;

		if (
			(!state.relevantNodes?.length && !state.relevantEdges?.length) ||
			!llm.isReady()
		) {
			return {
				finalMessage: state.finalMessage,
				actions: [],
			};
		}

		try {
			logInfo("[KNOWLEDGE_RAG] Adding citations to response");

			// Split answer into lines and number them
			const answerLines = state.finalMessage.split("\n");
			const numberedAnswer = answerLines
				.map((line, index) => `Line ${index + 1}: ${line}`)
				.join("\n");

			// Build sources list using actual UUIDs
			const sourcesList = [
				"Nodes:",
				...state.relevantNodes.map(
					(node) => `- ${node.name} (UUID: ${node.id})`,
				),
				"",
				"Edges:",
				...state.relevantEdges.map(
					(edge) => `- ${edge.edgeType}: ${edge.factText} (UUID: ${edge.id})`,
				),
			].join("\n");

			// Build system message with citation instructions
			const systemMessage: ChatMessage = {
				role: "system",
				content: CITATION_PROMPT.replace("{answer}", numberedAnswer).replace(
					"{sources}",
					sourcesList,
				),
			};

			// Use minimal messages for citation task
			const messages: ChatMessage[] = [
				systemMessage,
				{
					role: "user",
					content:
						"Identify citations for each line that uses knowledge sources.",
				},
			];

			// NO STREAMING - just get the citations directly
			const llmResponse = await llm.chatCompletions({
				messages,
				temperature: 0.1,
				stream: false,
			});

			const citationResponse =
				"choices" in llmResponse
					? llmResponse.choices[0].message.content || ""
					: "";

			// Parse line-based citations
			// Format: "Line X: [Label](#citations:node/uuid), [Label](#citation:edge/uuid)"
			const lineCitations = new Map<number, string>();
			const linePattern = /Line\s+(\d+):\s*(.+?)(?=\n|$)/gi;
			let match;

			while ((match = linePattern.exec(citationResponse)) !== null) {
				const lineNum = parseInt(match[1], 10);
				const citations = match[2].trim();
				lineCitations.set(lineNum, citations);
			}

			// Merge citations back into original answer
			const citedLines = answerLines.map((line, index) => {
				const lineNum = index + 1;
				const citations = lineCitations.get(lineNum);
				if (citations) {
					// Add citations at the end of the line
					return `${line} ${citations}`;
				}
				return line;
			});

			const citedResponse = citedLines.join("\n");

			return {
				finalMessage: citedResponse,
				actions: [
					{
						id: crypto.randomUUID(),
						name: "citation",
						description: "Added citations to response",
						metadata: {
							citationCount: (
								citedResponse.match(/\]\(citation[s]?:(node|edge)\//g) || []
							).length,
							citedLines: lineCitations.size,
						},
					},
				],
			};
		} catch (error) {
			logError("[KNOWLEDGE_RAG] Citation failed:", error);
			// Return original response if citation fails
			return {
				finalMessage: state.finalMessage,
				actions: [
					{
						id: crypto.randomUUID(),
						name: "citation_fallback",
						description: "Citation failed, returning original response",
						metadata: { error: String(error) },
					},
				],
			};
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
