import type { AllServices } from "@/services/flows/interfaces/tool";
import { logInfo, logError } from "@/utils/logger";
import { and, eq, like, or, desc } from "drizzle-orm";
import {
	combineSearchResultsWithTrigram,
	trigramSearchEdges,
	trigramSearchNodes,
} from "@/utils/trigram-search";
import {
	vectorSearchEdges,
	vectorSearchNodes,
	type VectorSearchResult,
} from "@/utils/vector-search";
import type { Edge, Node } from "@/services/database";
import { getScopedGraphWhere } from "@/utils/scoped-graph-query";
import type { ChatCompletionResponse, ChatMessage } from "@/types/openai";

import type { KnowledgeRAGState } from "./state";

const QUERY_ANALYSIS_PROMPT = `
You are an expert at analyzing user queries for knowledge graph retrieval.

Analyze the user query and extract:
1. Key entities mentioned (people, places, concepts, organizations)
2. Query intent: "factual" (seeking facts), "relationship" (asking about connections), "summary" (wanting overview), "exploration" (browsing/discovery)

User Query: {query}

Respond in this exact JSON format:
{
  "entities
  "intent": "factual|relationship|summary|exploration"
}
`;

export class RetrievalContextFlow {
	constructor(private services: AllServices) {}

	analyzeQueryNode = async (
		state: KnowledgeRAGState,
	): Promise<Partial<KnowledgeRAGState>> => {
		const llm = this.services.llm;

		if (!llm.isReady()) {
			throw new Error("LLM service is not ready");
		}

		try {
			logInfo("[KNOWLEDGE_RAG] Analyzing query:", state.query);

			// WebLLM requires last message to be from user or tool role
			const messages: ChatMessage[] = [
				{ role: "system", content: QUERY_ANALYSIS_PROMPT },
				{ role: "user", content: state.query },
			];

			const llmResponse = (await llm.chatCompletions({
				messages,
				temperature: 0.1,
				stream: false,
			})) as ChatCompletionResponse;

			const responseContent = llmResponse.choices[0].message.content || "";

			// Parse JSON response
			let analysisResult: { entities: string[]; intent: string } | undefined;
			try {
				const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
				if (jsonMatch) {
					analysisResult = JSON.parse(jsonMatch[0]);
				} else {
					throw new Error("No JSON found in response");
				}
			} catch (parseError) {
				logError(
					"[KNOWLEDGE_RAG] Failed to parse analysis response:",
					parseError,
				);
				// Fallback to simple entity extraction
				analysisResult = {
					entities: state.query.split(" ").filter((word) => word.length > 3),
					intent: "factual",
				};
			}

			return {
				extractedEntities: analysisResult?.entities || [],
				queryIntent: (analysisResult?.intent ||
					"factual") as KnowledgeRAGState["queryIntent"],
				next: "retrieve_knowledge",
				actions: [
					{
						id: crypto.randomUUID(),
						name: "query_analysis",
						description: `Extracted ${analysisResult?.entities?.map((e) => `"${e}"`).join(", ")} entities with "${analysisResult?.intent}" intent`,
						metadata: {
							entities: analysisResult?.entities,
							intent: analysisResult?.intent,
						},
					},
				],
			};
		} catch (error) {
			logError("[KNOWLEDGE_RAG] Query analysis failed:", error);
			throw error;
		}
	};

	retrieveKnowledgeNode = async (
		state: KnowledgeRAGState,
	): Promise<Partial<KnowledgeRAGState>> => {
		const database = this.services.database;
		const embedding = this.services.embedding;

		try {
			let relevantNodes: KnowledgeRAGState["relevantNodes"] = [];
			let relevantEdges: KnowledgeRAGState["relevantEdges"] = [];

			const TOTAL_NODE_LIMIT = 15;
			const TOTAL_EDGE_LIMIT = 20;
			const WEIGHTS = {
				sqlPercentage: 60,
				trigramPercentage: 40,
				vectorPercentage: 0,
			};

			// 1. SQL search for nodes
			const sqlNodes = await database.use(async ({ db, schema }) => {
				if (state.extractedEntities.length === 0) return [];

				const entitySearchConditions = state.extractedEntities.map((entity) =>
					or(
						like(schema.nodes.name, `%${entity}%`),
						like(schema.nodes.summary, `%${entity}%`),
					),
				);

				// Add topic filter if provided
				const whereConditions = and(
					or(...entitySearchConditions),
					getScopedGraphWhere(state, schema.nodes.graph),
				);

				return await db
					.select({
						id: schema.nodes.id,
						nodeType: schema.nodes.nodeType,
						name: schema.nodes.name,
						summary: schema.nodes.summary,
						attributes: schema.nodes.attributes,
						nameEmbedding: schema.nodes.nameEmbedding,
						createdAt: schema.nodes.createdAt,
						updatedAt: schema.nodes.updatedAt,
					})
					.from(schema.nodes)
					.where(whereConditions)
					.orderBy(desc(schema.nodes.createdAt))
					.limit(Math.floor((TOTAL_NODE_LIMIT * WEIGHTS.sqlPercentage) / 100));
			});

			// 2. SQL search for edges
			const sqlEdges = await database.use(async ({ db, schema }) => {
				if (state.extractedEntities.length === 0) return [];

				const factSearchConditions = state.extractedEntities.map((entity) =>
					like(schema.edges.factText, `%${entity}%`),
				);

				// Add topic filter if provided
				const whereConditions = and(
					or(...factSearchConditions),
					getScopedGraphWhere(state, schema.edges.graph),
				);

				return await db
					.select({
						id: schema.edges.id,
						sourceId: schema.edges.sourceId,
						destinationId: schema.edges.destinationId,
						edgeType: schema.edges.edgeType,
						factText: schema.edges.factText,
						validAt: schema.edges.validAt,
						invalidAt: schema.edges.invalidAt,
						recordedAt: schema.edges.recordedAt,
						attributes: schema.edges.attributes,
						isCurrent: schema.edges.isCurrent,
						provenanceWeightCache: schema.edges.provenanceWeightCache,
						provenanceCountCache: schema.edges.provenanceCountCache,
						factEmbedding: schema.edges.factEmbedding,
						typeEmbedding: schema.edges.typeEmbedding,
						graph: schema.edges.graph,
						createdAt: schema.edges.createdAt,
						updatedAt: schema.edges.updatedAt,
					})
					.from(schema.edges)
					.where(whereConditions)
					.orderBy(desc(schema.edges.createdAt))
					.limit(Math.floor((TOTAL_EDGE_LIMIT * WEIGHTS.sqlPercentage) / 100));
			});

			// 3. Trigram search for nodes
			let trigramNodeResults: Awaited<ReturnType<typeof trigramSearchNodes>> =
				[];
			if (state.extractedEntities.length > 0) {
				try {
					trigramNodeResults = await trigramSearchNodes(
						database,
						state.extractedEntities,
						Math.floor((TOTAL_NODE_LIMIT * WEIGHTS.trigramPercentage) / 100),
						{ threshold: 0.1 },
						state.graphId,
					);
				} catch (error) {
					logError("[KNOWLEDGE_RAG] Trigram search for nodes failed:", error);
				}
			}

			// 4. Trigram search for edges
			let trigramEdgeResults: Awaited<ReturnType<typeof trigramSearchEdges>> =
				[];
			if (state.extractedEntities.length > 0) {
				try {
					trigramEdgeResults = await trigramSearchEdges(
						database,
						state.extractedEntities,
						Math.floor((TOTAL_EDGE_LIMIT * WEIGHTS.trigramPercentage) / 100),
						{ threshold: 0.1 },
						state.graphId,
					);
				} catch (error) {
					logError("[KNOWLEDGE_RAG] Trigram search for edges failed:", error);
				}
			}

			// 5. Fallback to vector search if both SQL and trigram fail or have insufficient results
			let vectorNodes: VectorSearchResult<Node>[] = [];
			let vectorEdges: VectorSearchResult<Edge>[] = [];
			const combinedNodeResults = sqlNodes.length + trigramNodeResults.length;
			const combinedEdgeResults = sqlEdges.length + trigramEdgeResults.length;

			if (
				(combinedNodeResults < TOTAL_NODE_LIMIT * 0.5 ||
					combinedEdgeResults < TOTAL_EDGE_LIMIT * 0.5) &&
				embedding
			) {
				try {
					const defaultEmbedding = await embedding.get("default");
					if (defaultEmbedding && defaultEmbedding.isReady()) {
						// Vector search for nodes
						if (combinedNodeResults < TOTAL_NODE_LIMIT * 0.5) {
							const nodeLimit = Math.min(
								TOTAL_NODE_LIMIT - combinedNodeResults,
								Math.floor(TOTAL_NODE_LIMIT * 0.4),
							);
							vectorNodes = await vectorSearchNodes(
								database,
								defaultEmbedding,
								state.extractedEntities,
								nodeLimit,
								state.graphId,
							);
						}

						// Vector search for edges
						if (combinedEdgeResults < TOTAL_EDGE_LIMIT * 0.5) {
							const edgeLimit = Math.min(
								TOTAL_EDGE_LIMIT - combinedEdgeResults,
								Math.floor(TOTAL_EDGE_LIMIT * 0.4),
							);
							vectorEdges = await vectorSearchEdges(
								database,
								defaultEmbedding,
								state.extractedEntities,
								edgeLimit,
								state.graphId,
							);
						}
					}
				} catch (embeddingError) {
					logError(
						"[KNOWLEDGE_RAG] Vector search fallback failed:",
						embeddingError,
					);
				}
			}

			// 6. Combine results using trigram combiner
			const combinedNodes = combineSearchResultsWithTrigram(
				sqlNodes,
				vectorNodes.map((node) => ({
					item: node as unknown as (typeof sqlNodes)[0],
					similarity:
						"similarity" in node && typeof node.similarity === "number"
							? node.similarity
							: 0,
				})),
				trigramNodeResults,
				WEIGHTS,
				TOTAL_NODE_LIMIT,
				(node) => node.id!,
			);

			const combinedEdges = combineSearchResultsWithTrigram(
				sqlEdges,
				vectorEdges.map((edge) => ({
					item: edge as unknown as (typeof sqlEdges)[0],
					similarity:
						"similarity" in edge && typeof edge.similarity === "number"
							? edge.similarity
							: 0,
				})),
				trigramEdgeResults,
				WEIGHTS,
				TOTAL_EDGE_LIMIT,
				(edge) => edge.id!,
			);

			// 4. Process and score nodes
			relevantNodes = combinedNodes.map((node) => {
				let relevanceScore = 0;

				// Text-based relevance
				// Text-based relevance
				state.extractedEntities.forEach((entity) => {
					const entityLower = entity.toLowerCase();
					if (`${node.name}`.toLowerCase().includes(entityLower)) {
						relevanceScore += 3;
					}
					if (`${node.summary}`.toLowerCase().includes(entityLower)) {
						relevanceScore += 2;
					}
				});

				return {
					id: `${node.id}`,
					nodeType: node.nodeType ? `${node.nodeType}` : "",
					name: node.name ? `${node.name}` : "",
					summary: node.summary ? `${node.summary}` : "",
					attributes: (node.attributes as Record<string, unknown>) || {},
					relevanceScore,
				};
			});

			// 5. Get missing nodes for complete fact context
			const edgeNodeIds = [
				...new Set([
					...combinedEdges.map((edge) => edge.sourceId),
					...combinedEdges.map((edge) => edge.destinationId),
				]),
			].filter((id) => id !== null && id !== undefined && id !== ""); // Filter out invalid IDs

			const missingNodeIds = edgeNodeIds.filter(
				(id) => !relevantNodes.find((node) => node.id === id),
			);

			if (missingNodeIds.length > 0) {
				const missingNodes = await database.use(async ({ db, schema }) => {
					return await db
						.select({
							id: schema.nodes.id,
							nodeType: schema.nodes.nodeType,
							name: schema.nodes.name,
							summary: schema.nodes.summary,
							attributes: schema.nodes.attributes,
						})
						.from(schema.nodes)
						.where(or(...missingNodeIds.map((id) => eq(schema.nodes.id, id!))));
				});

				const additionalNodes = missingNodes.map((node) => ({
					id: node.id,
					nodeType: node.nodeType,
					name: node.name,
					summary: node.summary || "",
					attributes: (node.attributes as Record<string, unknown>) || {},
					relevanceScore: 1,
				}));

				relevantNodes = [...relevantNodes, ...additionalNodes];
			}

			// 6. Process edges
			relevantEdges = combinedEdges.map((edge) => {
				let relevanceScore = 0;

				// Score based on fact text relevance
				state.extractedEntities.forEach((entity) => {
					if (edge.factText?.toLowerCase().includes(entity.toLowerCase())) {
						relevanceScore += 2;
					}
				});

				// Boost score if both source and destination are relevant nodes
				const allNodeIds = relevantNodes.map((node) => node.id);
				const sourceRelevant = allNodeIds.includes(`${edge.sourceId}`);
				const destRelevant = allNodeIds.includes(`${edge.destinationId}`);
				if (sourceRelevant && destRelevant) {
					relevanceScore += 3;
				} else if (sourceRelevant || destRelevant) {
					relevanceScore += 1;
				}

				return {
					id: `${edge.id}`,
					sourceId: edge.sourceId ? `${edge.sourceId}` : "",
					destinationId: edge.destinationId ? `${edge.destinationId}` : "",
					edgeType: edge.edgeType ? `${edge.edgeType}` : "",
					factText: edge.factText ? `${edge.factText}` : "",
					attributes: (edge.attributes as Record<string, unknown>) || {},
					relevanceScore,
				};
			});

			// Sort by relevance
			relevantNodes.sort((a, b) => b.relevanceScore - a.relevanceScore);
			relevantEdges.sort((a, b) => b.relevanceScore - a.relevanceScore);

			logInfo("[KNOWLEDGE_RAG] Retrieved knowledge:", {
				nodes: relevantNodes.length,
				edges: relevantEdges.length,
				sqlNodes: sqlNodes.length,
				trigramNodes: trigramNodeResults.length,
				vectorNodes: vectorNodes.length,
				sqlEdges: sqlEdges.length,
				trigramEdges: trigramEdgeResults.length,
				vectorEdges: vectorEdges.length,
			});

			return {
				relevantNodes,
				relevantEdges,
				next: "build_context",
				actions: [
					{
						id: crypto.randomUUID(),
						name: "knowledge_retrieval",
						description: `Found ${relevantNodes.length} nodes and ${relevantEdges.length} relationships (${sqlNodes.length}+${trigramNodeResults.length}+${vectorNodes.length} nodes, ${sqlEdges.length}+${trigramEdgeResults.length}+${vectorEdges.length} edges)`,
						metadata: {
							nodeCount: relevantNodes.length,
							edgeCount: relevantEdges.length,
							sqlNodeCount: sqlNodes.length,
							trigramNodeCount: trigramNodeResults.length,
							vectorNodeCount: vectorNodes.length,
							sqlEdgeCount: sqlEdges.length,
							trigramEdgeCount: trigramEdgeResults.length,
							vectorEdgeCount: vectorEdges.length,
						},
					},
				],
			};
		} catch (error) {
			logError("[KNOWLEDGE_RAG] Knowledge retrieval failed:", error);
			throw error;
		}
	};
}
