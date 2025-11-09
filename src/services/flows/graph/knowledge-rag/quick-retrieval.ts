import type { AllServices } from "@/services/flows/interfaces/tool";
import { logInfo, logError } from "@/utils/logger";
import { and, or, inArray } from "drizzle-orm";
import { vectorSearchEdges, vectorSearchNodes } from "@/utils/vector-search";
import type { DatabaseService } from "@/services/database";
import { getScopedGraphWhere } from "@/utils/scoped-graph-query";
import type { BaseEmbedding } from "@/services/embedding";

import type {
	GraphGrowthConfig,
	KnowledgeRAGState,
	KnowledgeRAGConfig,
} from "./state";

export class QuickRetrievalContextFlow {
	private config: KnowledgeRAGConfig;
	constructor(
		private services: AllServices,
		config: KnowledgeRAGConfig = {},
	) {
		this.config = {
			quickMode: true,
			maxGrowthLevels: 3,
			searchLimit: 50,
			...config,
		};
	}

	private async performSemanticSearch(
		databaseService: DatabaseService,
		embeddingService: BaseEmbedding,
		query: string,
		limit: number,
		graphId?: string,
	): Promise<{
		nodes: KnowledgeRAGState["relevantNodes"];
		edges: KnowledgeRAGState["relevantEdges"];
	}> {
		// Search for semantically relevant nodes
		const nodeResults = await vectorSearchNodes(
			databaseService,
			embeddingService,
			[query],
			Math.floor(limit * 0.6), // 60% for nodes
			graphId, // Use topicId as graphFilter parameter
		);

		// Search for semantically relevant edges
		const edgeResults = await vectorSearchEdges(
			databaseService,
			embeddingService,
			[query],
			Math.floor(limit * 0.4), // 40% for edges
			graphId, // Use topicId as graphFilter parameter
		);

		// Convert to state format
		const nodes: KnowledgeRAGState["relevantNodes"] = nodeResults.map(
			(result) => ({
				id: String(result.item.id),
				nodeType: result.item.nodeType || "",
				name: result.item.name || "",
				summary: result.item.summary || "",
				attributes: (result.item.attributes || {}) as Record<string, unknown>,
				relevanceScore: result.similarity,
			}),
		);

		const edges: KnowledgeRAGState["relevantEdges"] = edgeResults
			.filter((result) => result.item.sourceId && result.item.destinationId) // Only include edges with valid IDs
			.map((result) => ({
				id: String(result.item.id),
				sourceId: String(result.item.sourceId),
				destinationId: String(result.item.destinationId),
				edgeType: result.item.edgeType || "",
				factText: result.item.factText || "",
				attributes: (result.item.attributes || {}) as Record<string, unknown>,
				relevanceScore: result.similarity,
			}));

		return { nodes, edges };
	}

	private async expandGraphLevel(
		databaseService: DatabaseService,
		nodeIds: string[],
		maxNodes: number,
		maxEdges: number,
		graphId?: string,
	): Promise<{
		newNodes: KnowledgeRAGState["relevantNodes"];
		newEdges: KnowledgeRAGState["relevantEdges"];
		nextLevelNodeIds: Set<string>;
	}> {
		if (nodeIds.length === 0) {
			return { newNodes: [], newEdges: [], nextLevelNodeIds: new Set() };
		}

		const result = await databaseService.use(async ({ db, schema }) => {
			// Find all edges connected to current nodes
			const connectedEdges = await db
				.select()
				.from(schema.edges)
				.where(
					and(
						or(
							inArray(schema.edges.sourceId, nodeIds),
							inArray(schema.edges.destinationId, nodeIds),
						),
						getScopedGraphWhere({ graphId }, schema.edges.graph),
					),
				)
				.limit(maxEdges);

			// Get all unique node IDs from the edges (excluding current nodes)
			const newNodeIds = new Set<string>();
			connectedEdges.forEach((edge) => {
				// Only process valid IDs
				if (edge.sourceId) {
					const sourceId = String(edge.sourceId);
					if (!nodeIds.includes(sourceId)) {
						newNodeIds.add(sourceId);
					}
				}
				if (edge.destinationId) {
					const destId = String(edge.destinationId);
					if (!nodeIds.includes(destId)) {
						newNodeIds.add(destId);
					}
				}
			});

			// Fetch the new nodes (limit to maxNodes)
			const newNodesArray = Array.from(newNodeIds).slice(0, maxNodes);
			const connectedNodes =
				newNodesArray.length > 0
					? await db
							.select()
							.from(schema.nodes)
							.where(inArray(schema.nodes.id, newNodesArray))
					: [];

			return { connectedEdges, connectedNodes, newNodeIds };
		});

		// Convert to state format
		const newNodes: KnowledgeRAGState["relevantNodes"] =
			result.connectedNodes.map((node) => ({
				id: String(node.id),
				nodeType: node.nodeType,
				name: node.name,
				summary: node.summary || "",
				attributes: (node.attributes || {}) as Record<string, unknown>,
				relevanceScore: 0.5, // Default for grown nodes
			}));

		const newEdges: KnowledgeRAGState["relevantEdges"] = result.connectedEdges
			.filter((edge) => edge.sourceId && edge.destinationId) // Only include edges with valid IDs
			.map((edge) => ({
				id: String(edge.id),
				sourceId: String(edge.sourceId),
				destinationId: String(edge.destinationId),
				edgeType: edge.edgeType,
				factText: edge.factText || "",
				attributes: (edge.attributes || {}) as Record<string, unknown>,
				relevanceScore: 0.5, // Default for grown edges
			}));

		return {
			newNodes,
			newEdges,
			nextLevelNodeIds: result.newNodeIds,
		};
	}

	private async growKnowledgeGraph(
		databaseService: DatabaseService,
		initialNodes: KnowledgeRAGState["relevantNodes"],
		initialEdges: KnowledgeRAGState["relevantEdges"],
		config: GraphGrowthConfig,
		graphId?: string,
	): Promise<{
		nodes: KnowledgeRAGState["relevantNodes"];
		edges: KnowledgeRAGState["relevantEdges"];
	}> {
		const allNodes = new Map<string, KnowledgeRAGState["relevantNodes"][0]>();
		const allEdges = new Map<string, KnowledgeRAGState["relevantEdges"][0]>();

		// Add initial results
		initialNodes.forEach((node) => allNodes.set(node.id, node));
		initialEdges.forEach((edge) => allEdges.set(edge.id, edge));

		let currentLevelNodeIds = new Set(initialNodes.map((n) => n.id));

		// Grow the graph level by level
		for (let level = 0; level < config.maxLevels; level++) {
			logInfo(
				`[KNOWLEDGE_RAG] Growing graph level ${level + 1}/${config.maxLevels}`,
			);

			if (currentLevelNodeIds.size === 0) break;

			const { newNodes, newEdges, nextLevelNodeIds } =
				await this.expandGraphLevel(
					databaseService,
					Array.from(currentLevelNodeIds),
					config.nodesPerLevel,
					config.edgesPerLevel,
					graphId,
				);

			// Add new nodes and edges
			newNodes.forEach((node) => {
				if (!allNodes.has(node.id)) {
					allNodes.set(node.id, {
						...node,
						relevanceScore: Math.max(0.1, 0.8 - level * 0.2),
					});
				}
			});

			newEdges.forEach((edge) => {
				if (!allEdges.has(edge.id)) {
					allEdges.set(edge.id, {
						...edge,
						relevanceScore: Math.max(0.1, 0.8 - level * 0.2),
					});
				}
			});

			currentLevelNodeIds = nextLevelNodeIds;
		}

		return {
			nodes: Array.from(allNodes.values()).sort(
				(a, b) => b.relevanceScore - a.relevanceScore,
			),
			edges: Array.from(allEdges.values()).sort(
				(a, b) => b.relevanceScore - a.relevanceScore,
			),
		};
	}

	quickRetrieveNode = async (
		state: KnowledgeRAGState,
	): Promise<Partial<KnowledgeRAGState>> => {
		try {
			logInfo(
				`[KNOWLEDGE_RAG] Quick mode: Starting semantic search and graph growth for graphId: ${state.graphId}`,
			);

			const databaseService = this.services.database;
			const embeddingService = this.services.embedding;

			if (!databaseService) {
				throw new Error("Database service not available");
			}

			if (!embeddingService) {
				throw new Error("Embedding service not available");
			}

			// Get default embedding
			const defaultEmbedding = await embeddingService.get("default");
			if (!defaultEmbedding || !defaultEmbedding.isReady()) {
				throw new Error("Default embedding not ready");
			}

			// Step 1: Semantic search for initial nodes and edges
			const initialResults = await this.performSemanticSearch(
				databaseService,
				defaultEmbedding,
				state.query,
				this.config.searchLimit || 50,
				state.graphId,
			);

			// Step 2: Grow the graph from initial results
			const grownResults = await this.growKnowledgeGraph(
				databaseService,
				initialResults.nodes,
				initialResults.edges,
				{
					maxLevels: this.config.maxGrowthLevels || 3,
					nodesPerLevel: 20,
					edgesPerLevel: 30,
				},
				state.graphId,
			);

			logInfo("[KNOWLEDGE_RAG] Quick mode results:", {
				initialNodes: initialResults.nodes.length,
				initialEdges: initialResults.edges.length,
				grownNodes: grownResults.nodes.length,
				grownEdges: grownResults.edges.length,
				growthLevels: this.config.maxGrowthLevels,
			});

			return {
				relevantNodes: grownResults.nodes,
				relevantEdges: grownResults.edges,
				extractedEntities: [], // Not used in quick mode
				queryIntent: "factual", // Default intent for quick mode
				next: "build_context",
				actions: [
					{
						id: crypto.randomUUID(),
						name: "quick_knowledge_retrieval",
						description: `Found ${grownResults.nodes.length} nodes and ${grownResults.edges.length} relationships using semantic search and ${this.config.maxGrowthLevels} levels of graph growth`,
						metadata: {
							mode: "quick",
							initialNodeCount: initialResults.nodes.length,
							initialEdgeCount: initialResults.edges.length,
							grownNodeCount: grownResults.nodes.length,
							grownEdgeCount: grownResults.edges.length,
							growthLevels: this.config.maxGrowthLevels,
						},
					},
				],
			};
		} catch (error) {
			logError("[KNOWLEDGE_RAG] Quick retrieve failed:", error);
			throw error;
		}
	};
}
