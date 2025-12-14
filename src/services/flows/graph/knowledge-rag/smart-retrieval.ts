/**
 * Smart Hybrid Retrieval for Knowledge RAG
 *
 * Combines semantic search with intelligent graph expansion and completeness verification.
 *
 * Algorithm Phases:
 * 1. Semantic Seed Retrieval - Vector search for initial highly relevant nodes/edges
 * 2. Smart Graph Expansion - Multi-level expansion with semantic filtering
 * 3. Completeness Verification - Ensure all query components are covered
 * 4. Multi-Factor Re-Ranking - Combine semantic, structural, and coverage scores
 */

import type { AllServices } from "@/services/flows/interfaces/tool";
import type { IDatabaseService } from "@/services/database";
import type { BaseEmbedding } from "@/services/embedding";
import type { Node, Edge } from "@/services/database/types";
import type { KnowledgeRAGState } from "./state";
import { logInfo, logError, logWarn } from "@/utils/logger";
import { vectorSearchNodes, vectorSearchEdges } from "@/utils/vector-search";
import { and, or, inArray, sql } from "drizzle-orm";
import { getScopedGraphWhere } from "@/utils/scoped-graph-query";

// ============================================================================
// CONFIGURATION TYPES
// ============================================================================

/**
 * MMR (Maximal Marginal Relevance) diversity mode
 *
 * Controls the trade-off between relevance and diversity:
 * - focused: λ=0.8 (80% relevance, 20% diversity) - precise, may have redundancy
 * - balanced: λ=0.6 (60% relevance, 40% diversity) - good balance (DEFAULT)
 * - explore: λ=0.4 (40% relevance, 60% diversity) - maximum diversity
 * - custom: specify your own lambda value
 */
export type MMRMode = "focused" | "balanced" | "explore" | "custom";

/**
 * MMR configuration for diversity control
 */
export interface MMRConfig {
	/** Enable/disable MMR diversity algorithm */
	enabled: boolean;
	/** MMR mode preset (focused/balanced/explore/custom) */
	mode: MMRMode;
	/**
	 * Lambda parameter for custom mode (0-1)
	 * - 1.0 = pure relevance (no diversity)
	 * - 0.0 = pure diversity (ignore relevance)
	 * - 0.6 = balanced (recommended)
	 */
	lambda?: number;
	/**
	 * Candidate multiplier: fetch this many times nodeLimit candidates
	 * Higher = more diverse options but slower
	 * Default: 2 (fetch 40 candidates to select 20)
	 */
	candidateMultiplier?: number;
}

/**
 * Configuration for Smart Hybrid Retrieval
 */
export interface SmartRetrievalConfig {
	/** Phase 1: Semantic Seed Configuration */
	seed: {
		/** Maximum nodes to retrieve in initial semantic search */
		nodeLimit: number;
		/** Maximum edges to retrieve in initial semantic search */
		edgeLimit: number;
		/** Minimum similarity threshold for seed nodes */
		nodeThreshold: number;
		/** Minimum similarity threshold for seed edges */
		edgeThreshold: number;
		/** MMR diversity configuration for seed nodes */
		mmr?: MMRConfig;
	};

	/** Phase 2: Graph Expansion Configuration */
	expansion: {
		/** Maximum number of expansion levels */
		maxLevels: number;
		/** Similarity thresholds per level (should decay) */
		levelThresholds: number[];
		/** Maximum nodes to add per level */
		maxNodesPerLevel: number;
		/** Maximum edges to add per level */
		maxEdgesPerLevel: number;
	};

	/** Phase 3: Completeness Verification Configuration */
	completeness: {
		/** Minimum coverage ratio to consider complete (0-1) */
		threshold: number;
		/** Maximum iterations for gap-filling */
		maxIterations: number;
		/** Maximum nodes to retrieve per missing component */
		gapFillingLimit: number;
		/** Minimum word length to consider as query component */
		minComponentLength: number;
	};

	/** Phase 4: Re-Ranking Configuration */
	ranking: {
		/** Weight for semantic similarity score */
		semanticWeight: number;
		/** Weight for graph centrality score */
		centralityWeight: number;
		/** Weight for edge density score */
		densityWeight: number;
		/** Weight for coverage contribution score */
		coverageWeight: number;
	};

	/** Final output limits */
	output: {
		/** Maximum nodes in final result */
		maxNodes: number;
		/** Maximum edges in final result */
		maxEdges: number;
	};

	/** Topic-based retrieval configuration (for general context) */
	topic?: {
		/** Enable topic-based retrieval alongside task-based retrieval */
		enabled: boolean;
		/** Maximum nodes to retrieve for topic context */
		nodeLimit: number;
		/** Maximum edges to retrieve for topic context */
		edgeLimit: number;
		/** MMR mode for topic retrieval (should be exploratory) */
		mmrMode: MMRMode;
		/** How to merge with task results: relevance weighting (0-1, default 0.3) */
		relevanceWeight: number;
	};
}

/**
 * Default MMR configuration
 */
export const DEFAULT_MMR_CONFIG: MMRConfig = {
	enabled: true,
	mode: "balanced",
	lambda: 0.6,
	candidateMultiplier: 2,
};

/**
 * MMR mode presets with corresponding lambda values
 */
export const MMR_MODE_LAMBDAS: Record<Exclude<MMRMode, "custom">, number> = {
	focused: 0.8, // 80% relevance, 20% diversity
	balanced: 0.6, // 60% relevance, 40% diversity
	explore: 0.4, // 40% relevance, 60% diversity
};

/**
 * Default configuration with optimized parameters
 */
export const DEFAULT_SMART_CONFIG: SmartRetrievalConfig = {
	seed: {
		nodeLimit: 20,
		edgeLimit: 30,
		nodeThreshold: 0.5,
		edgeThreshold: 0.4,
		mmr: DEFAULT_MMR_CONFIG,
	},
	expansion: {
		maxLevels: 3,
		levelThresholds: [0.5, 0.35, 0.2], // Decay per level
		maxNodesPerLevel: 15,
		maxEdgesPerLevel: 25,
	},
	completeness: {
		threshold: 0.8,
		maxIterations: 2,
		gapFillingLimit: 5,
		minComponentLength: 3,
	},
	ranking: {
		semanticWeight: 0.5,
		centralityWeight: 0.2,
		densityWeight: 0.15,
		coverageWeight: 0.15,
	},
	output: {
		maxNodes: 50,
		maxEdges: 70,
	},
	topic: {
		enabled: true,
		nodeLimit: 10,
		edgeLimit: 15,
		mmrMode: "explore", // More diversity for topic context
		relevanceWeight: 0.3, // Lower weight for topic nodes vs task nodes
	},
};

// ============================================================================
// INTERNAL TYPES
// ============================================================================

/**
 * Enhanced node with retrieval metadata
 */
interface EnhancedNode {
	id: string;
	nodeType: string;
	name: string;
	summary: string;
	attributes: Record<string, unknown>;
	embedding: number[] | null;

	// Retrieval metadata
	semanticScore: number;
	level: number;
	source: "seed" | "expansion" | "gap_filling";
	coverageContribution: number;

	// Graph metrics (computed in Phase 4)
	centralityScore?: number;
	edgeDensity?: number;
	finalScore?: number;
}

/**
 * Enhanced edge with retrieval metadata
 */
interface EnhancedEdge {
	id: string;
	sourceId: string;
	destinationId: string;
	edgeType: string;
	factText: string;
	attributes: Record<string, unknown>;
	embedding: number[] | null;

	// Retrieval metadata
	semanticScore: number;
	level: number;
	source: "seed" | "expansion";
	finalScore?: number;
}

/**
 * Query components extracted from user query
 */
interface QueryComponent {
	text: string;
	covered: boolean;
}

/**
 * Retrieval statistics for monitoring
 */
interface RetrievalStats {
	phase1: {
		seedNodes: number;
		seedEdges: number;
		avgNodeSimilarity: number;
		avgEdgeSimilarity: number;
	};
	phase2: {
		levelsExpanded: number;
		nodesPerLevel: number[];
		edgesPerLevel: number[];
		totalExpanded: number;
	};
	phase3: {
		components: number;
		coverage: number;
		iterations: number;
		gapsFilled: number;
	};
	phase4: {
		finalNodes: number;
		finalEdges: number;
		avgFinalScore: number;
	};
	topic?: {
		enabled: boolean;
		topicNodes: number;
		topicEdges: number;
		mergedNodes: number;
		mergedEdges: number;
		duplicatesRemoved: number;
	};
}

// ============================================================================
// MAIN CLASS
// ============================================================================

export class SmartRetrievalFlow {
	private config: SmartRetrievalConfig;
	private stats: RetrievalStats;

	constructor(
		private services: AllServices,
		config?: Partial<SmartRetrievalConfig>,
	) {
		// Merge with defaults
		this.config = this.mergeConfig(DEFAULT_SMART_CONFIG, config);
		this.stats = this.initStats();
	}

	/**
	 * Main retrieval node for LangGraph integration
	 */
	smartRetrieveNode = async (
		state: KnowledgeRAGState,
	): Promise<Partial<KnowledgeRAGState>> => {
		try {
			logInfo(
				`[SMART_RETRIEVAL] Starting smart hybrid retrieval for query: "${state.query}"`,
				{ graphId: state.graphId, coreContext: state.coreContext },
			);

			// Validate services
			const { database, embedding } = this.validateServices();
			const defaultEmbedding = await this.getDefaultEmbedding(embedding);

			// Execute 4-phase retrieval
			const result = await this.executeSmartRetrieval(
				state.query,
				state.graphId,
				state.coreContext,
				database,
				defaultEmbedding,
			);

			// Convert to state format
			const relevantNodes: KnowledgeRAGState["relevantNodes"] =
				result.nodes.map((node) => ({
					id: node.id,
					nodeType: node.nodeType,
					name: node.name,
					summary: node.summary,
					attributes: node.attributes,
					relevanceScore: node.finalScore ?? node.semanticScore,
				}));

			const relevantEdges: KnowledgeRAGState["relevantEdges"] =
				result.edges.map((edge) => ({
					id: edge.id,
					sourceId: edge.sourceId,
					destinationId: edge.destinationId,
					edgeType: edge.edgeType,
					factText: edge.factText,
					attributes: edge.attributes,
					relevanceScore: edge.finalScore ?? edge.semanticScore,
				}));

			logInfo("[SMART_RETRIEVAL] Retrieval complete", {
				nodes: relevantNodes.length,
				edges: relevantEdges.length,
				stats: this.stats,
			});

			return {
				relevantNodes,
				relevantEdges,
				extractedEntities: result.queryComponents.map((c) => c.text),
				queryIntent: "factual",
				next: "build_context",
				actions: [
					{
						id: crypto.randomUUID(),
						name: "smart_knowledge_retrieval",
						description: this.formatRetrievalDescription(),
						metadata: {
							mode: "smart_hybrid",
							stats: this.stats,
							coverage: this.stats.phase3.coverage,
						},
					},
				],
			};
		} catch (error) {
			logError("[SMART_RETRIEVAL] Retrieval failed:", error);
			throw error;
		}
	};

	// ============================================================================
	// PHASE 1: SEMANTIC SEED RETRIEVAL
	// ============================================================================

	/**
	 * Phase 1: Retrieve initial seeds using pure semantic search
	 *
	 * With MMR enabled:
	 * 1. Fetch candidateMultiplier × nodeLimit candidates
	 * 2. Apply MMR to select diverse nodeLimit results
	 * 3. Ensures diversity while maintaining relevance
	 */
	private async phase1_SemanticSeed(
		query: string,
		graphId: string | undefined,
		database: IDatabaseService,
		embedding: BaseEmbedding,
	): Promise<{
		nodes: EnhancedNode[];
		edges: EnhancedEdge[];
		queryEmbedding: number[];
	}> {
		logInfo("[SMART_RETRIEVAL][P1] Starting semantic seed retrieval");

		// Get query embedding
		const queryEmbedding = await embedding.textToVector(query);

		// Determine how many candidates to fetch
		const mmrConfig = this.config.seed.mmr ?? DEFAULT_MMR_CONFIG;
		const candidateMultiplier = mmrConfig.enabled
			? (mmrConfig.candidateMultiplier ?? 2)
			: 1;

		const nodeCandidateLimit = this.config.seed.nodeLimit * candidateMultiplier;
		const targetNodeCount = this.config.seed.nodeLimit;

		logInfo(`[SMART_RETRIEVAL][P1] Fetching candidates`, {
			mmrEnabled: mmrConfig.enabled,
			mmrMode: mmrConfig.enabled ? mmrConfig.mode : "disabled",
			targetNodes: targetNodeCount,
			candidateNodes: nodeCandidateLimit,
		});

		// Search for semantically relevant nodes (fetch more if MMR enabled)
		const nodeResults = await vectorSearchNodes(
			database,
			embedding,
			[query],
			nodeCandidateLimit,
			graphId,
		);

		// Search for semantically relevant edges (no MMR for edges currently)
		const edgeResults = await vectorSearchEdges(
			database,
			embedding,
			[query],
			this.config.seed.edgeLimit,
			graphId,
		);

		// Filter by threshold and convert to enhanced format
		const nodeCandidates: EnhancedNode[] = nodeResults
			.filter((result) => result.similarity >= this.config.seed.nodeThreshold)
			.map((result) =>
				this.toEnhancedNode(result.item, result.similarity, 0, "seed"),
			);

		const edges: EnhancedEdge[] = edgeResults
			.filter((result) => result.similarity >= this.config.seed.edgeThreshold)
			.map((result) =>
				this.toEnhancedEdge(result.item, result.similarity, 0, "seed"),
			);

		// Apply MMR to node candidates if enabled
		let nodes: EnhancedNode[];
		if (mmrConfig.enabled && nodeCandidates.length > targetNodeCount) {
			nodes = this.applyMMRToNodes(
				nodeCandidates,
				queryEmbedding,
				targetNodeCount,
				mmrConfig,
			);
		} else {
			// MMR disabled or not enough candidates, just take top-K
			nodes = nodeCandidates.slice(0, targetNodeCount);
		}

		// Update stats
		this.stats.phase1 = {
			seedNodes: nodes.length,
			seedEdges: edges.length,
			avgNodeSimilarity: this.average(nodes.map((n) => n.semanticScore)),
			avgEdgeSimilarity: this.average(edges.map((e) => e.semanticScore)),
		};

		logInfo("[SMART_RETRIEVAL][P1] Seed retrieval complete", {
			nodes: nodes.length,
			edges: edges.length,
			candidates: nodeCandidates.length,
			mmrApplied: mmrConfig.enabled && nodeCandidates.length > targetNodeCount,
			avgNodeSim: this.stats.phase1.avgNodeSimilarity.toFixed(3),
			avgEdgeSim: this.stats.phase1.avgEdgeSimilarity.toFixed(3),
		});

		return { nodes, edges, queryEmbedding };
	}

	// ============================================================================
	// PHASE 2: SMART GRAPH EXPANSION
	// ============================================================================

	/**
	 * Phase 2: Expand graph intelligently with semantic filtering
	 */
	private async phase2_SmartExpansion(
		initialNodes: EnhancedNode[],
		initialEdges: EnhancedEdge[],
		queryEmbedding: number[],
		graphId: string | undefined,
		database: IDatabaseService,
	): Promise<{
		nodes: EnhancedNode[];
		edges: EnhancedEdge[];
	}> {
		logInfo("[SMART_RETRIEVAL][P2] Starting smart graph expansion");

		const allNodes = new Map<string, EnhancedNode>();
		const allEdges = new Map<string, EnhancedEdge>();

		// Add initial seeds
		initialNodes.forEach((node) => allNodes.set(node.id, node));
		initialEdges.forEach((edge) => allEdges.set(edge.id, edge));

		const nodesPerLevel: number[] = [];
		const edgesPerLevel: number[] = [];

		// Expand level by level
		for (let level = 1; level <= this.config.expansion.maxLevels; level++) {
			const threshold = this.config.expansion.levelThresholds[level - 1] ?? 0.2;

			logInfo(
				`[SMART_RETRIEVAL][P2] Expanding level ${level}/${this.config.expansion.maxLevels}`,
				{
					threshold,
					currentNodes: allNodes.size,
				},
			);

			// Get nodes from previous level
			const currentLevelNodes = Array.from(allNodes.values()).filter(
				(n) => n.level === level - 1,
			);

			if (currentLevelNodes.length === 0) {
				logInfo(
					`[SMART_RETRIEVAL][P2] No nodes at level ${level - 1}, stopping expansion`,
				);
				break;
			}

			// Expand from current level
			const expansion = await this.expandGraphLevel(
				currentLevelNodes.map((n) => n.id),
				queryEmbedding,
				threshold,
				level,
				graphId,
				database,
			);

			// Add new nodes (avoid duplicates)
			let newNodesCount = 0;
			expansion.nodes.forEach((node) => {
				if (!allNodes.has(node.id)) {
					allNodes.set(node.id, node);
					newNodesCount++;
				}
			});

			// Add new edges (avoid duplicates)
			let newEdgesCount = 0;
			expansion.edges.forEach((edge) => {
				if (!allEdges.has(edge.id)) {
					allEdges.set(edge.id, edge);
					newEdgesCount++;
				}
			});

			nodesPerLevel.push(newNodesCount);
			edgesPerLevel.push(newEdgesCount);

			logInfo(`[SMART_RETRIEVAL][P2] Level ${level} complete`, {
				newNodes: newNodesCount,
				newEdges: newEdgesCount,
				totalNodes: allNodes.size,
			});

			// Early stopping if no new nodes added
			if (newNodesCount === 0) {
				logInfo(`[SMART_RETRIEVAL][P2] No new nodes added, stopping expansion`);
				break;
			}
		}

		// Update stats
		this.stats.phase2 = {
			levelsExpanded: nodesPerLevel.length,
			nodesPerLevel,
			edgesPerLevel,
			totalExpanded: allNodes.size - this.stats.phase1.seedNodes,
		};

		logInfo("[SMART_RETRIEVAL][P2] Graph expansion complete", {
			totalNodes: allNodes.size,
			totalEdges: allEdges.size,
			levelsExpanded: nodesPerLevel.length,
		});

		return {
			nodes: Array.from(allNodes.values()),
			edges: Array.from(allEdges.values()),
		};
	}

	/**
	 * Expand graph by one level with semantic filtering
	 */
	private async expandGraphLevel(
		nodeIds: string[],
		queryEmbedding: number[],
		threshold: number,
		level: number,
		graphId: string | undefined,
		database: IDatabaseService,
	): Promise<{
		nodes: EnhancedNode[];
		edges: EnhancedEdge[];
	}> {
		if (nodeIds.length === 0) {
			return { nodes: [], edges: [] };
		}

		const result = await database.use(async ({ db, schema }) => {
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
				.limit(this.config.expansion.maxEdgesPerLevel);

			// Get unique node IDs from edges (excluding current nodes)
			const newNodeIds = new Set<string>();
			connectedEdges.forEach((edge) => {
				if (edge.sourceId && !nodeIds.includes(edge.sourceId)) {
					newNodeIds.add(edge.sourceId);
				}
				if (edge.destinationId && !nodeIds.includes(edge.destinationId)) {
					newNodeIds.add(edge.destinationId);
				}
			});

			// Fetch the new nodes
			const newNodesArray = Array.from(newNodeIds).slice(
				0,
				this.config.expansion.maxNodesPerLevel,
			);

			const connectedNodes =
				newNodesArray.length > 0
					? await db
							.select()
							.from(schema.nodes)
							.where(inArray(schema.nodes.id, newNodesArray))
					: [];

			return { connectedEdges, connectedNodes };
		});

		// Filter nodes by semantic relevance
		const nodes: EnhancedNode[] = [];
		for (const node of result.connectedNodes) {
			const semanticScore = await this.calculateSemanticSimilarity(
				node,
				queryEmbedding,
			);

			// Only keep if above threshold
			if (semanticScore >= threshold) {
				nodes.push(
					this.toEnhancedNode(node, semanticScore, level, "expansion"),
				);
			}
		}

		// Convert edges
		const edges: EnhancedEdge[] = result.connectedEdges
			.filter((edge) => edge.sourceId && edge.destinationId)
			.map((edge) => this.toEnhancedEdge(edge, 0.5, level, "expansion"));

		return { nodes, edges };
	}

	// ============================================================================
	// PHASE 3: COMPLETENESS VERIFICATION
	// ============================================================================

	/**
	 * Phase 3: Verify completeness and fill gaps
	 */
	private async phase3_CompletenessCheck(
		nodes: EnhancedNode[],
		edges: EnhancedEdge[],
		query: string,
		graphId: string | undefined,
		database: IDatabaseService,
		embedding: BaseEmbedding,
	): Promise<{
		nodes: EnhancedNode[];
		edges: EnhancedEdge[];
		queryComponents: QueryComponent[];
	}> {
		logInfo("[SMART_RETRIEVAL][P3] Starting completeness verification");

		// Extract query components
		const queryComponents = this.extractQueryComponents(query);

		let currentNodes = [...nodes];
		let currentEdges = [...edges];
		let iterations = 0;
		let totalGapsFilled = 0;

		while (iterations < this.config.completeness.maxIterations) {
			iterations++;

			// Check coverage
			const coverage = this.checkCoverage(currentNodes, queryComponents);
			const coverageRatio = coverage.covered / coverage.total;

			logInfo(
				`[SMART_RETRIEVAL][P3] Coverage check (iteration ${iterations})`,
				{
					covered: coverage.covered,
					total: coverage.total,
					ratio: coverageRatio.toFixed(2),
				},
			);

			// If complete, stop
			if (coverageRatio >= this.config.completeness.threshold) {
				logInfo("[SMART_RETRIEVAL][P3] Coverage threshold met, stopping");
				break;
			}

			// Fill gaps for missing components
			const missingComponents = queryComponents.filter((c) => !c.covered);
			logInfo(
				`[SMART_RETRIEVAL][P3] Filling gaps for ${missingComponents.length} components`,
			);

			for (const component of missingComponents) {
				const gapResults = await this.fillGap(
					component.text,
					graphId,
					database,
					embedding,
				);

				// Add gap-filling nodes
				gapResults.nodes.forEach((node) => {
					const exists = currentNodes.find((n) => n.id === node.id);
					if (!exists) {
						currentNodes.push(node);
						totalGapsFilled++;
					} else {
						// Boost coverage contribution for existing node
						exists.coverageContribution = 1.0;
					}
				});

				// Mark component as covered
				component.covered = true;
			}

			// Early stop if no gaps filled
			if (totalGapsFilled === 0 && iterations > 1) {
				logWarn("[SMART_RETRIEVAL][P3] No gaps filled, stopping iterations");
				break;
			}
		}

		// Final coverage check
		const finalCoverage = this.checkCoverage(currentNodes, queryComponents);
		const finalRatio = finalCoverage.covered / finalCoverage.total;

		// Update stats
		this.stats.phase3 = {
			components: queryComponents.length,
			coverage: finalRatio,
			iterations,
			gapsFilled: totalGapsFilled,
		};

		logInfo("[SMART_RETRIEVAL][P3] Completeness verification complete", {
			finalCoverage: finalRatio.toFixed(2),
			iterations,
			gapsFilled: totalGapsFilled,
		});

		return {
			nodes: currentNodes,
			edges: currentEdges,
			queryComponents,
		};
	}

	/**
	 * Extract key components from query
	 */
	private extractQueryComponents(query: string): QueryComponent[] {
		// Simple tokenization and filtering
		const words = query
			.toLowerCase()
			.split(/\s+/)
			.filter((word) => {
				// Remove punctuation
				const cleaned = word.replace(/[^\w]/g, "");
				// Filter by length and common stop words
				return (
					cleaned.length >= this.config.completeness.minComponentLength &&
					!this.isStopWord(cleaned)
				);
			});

		// Also extract multi-word phrases (bigrams, trigrams)
		const phrases: string[] = [];
		for (let i = 0; i < words.length - 1; i++) {
			phrases.push(`${words[i]} ${words[i + 1]}`);
			if (i < words.length - 2) {
				phrases.push(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
			}
		}

		// Combine and deduplicate
		const components = [...new Set([...words, ...phrases])].map((text) => ({
			text,
			covered: false,
		}));

		return components;
	}

	/**
	 * Check if word is a common stop word
	 */
	private isStopWord(word: string): boolean {
		const stopWords = new Set([
			"the",
			"a",
			"an",
			"and",
			"or",
			"but",
			"in",
			"on",
			"at",
			"to",
			"for",
			"of",
			"with",
			"by",
			"from",
			"is",
			"are",
			"was",
			"were",
			"be",
			"been",
			"being",
			"have",
			"has",
			"had",
			"do",
			"does",
			"did",
			"will",
			"would",
			"should",
			"could",
			"may",
			"might",
			"can",
			"what",
			"when",
			"where",
			"who",
			"which",
			"how",
			"why",
			"this",
			"that",
			"these",
			"those",
		]);
		return stopWords.has(word);
	}

	/**
	 * Check coverage of query components
	 */
	private checkCoverage(
		nodes: EnhancedNode[],
		queryComponents: QueryComponent[],
	): { covered: number; total: number } {
		let covered = 0;

		for (const component of queryComponents) {
			const isFound = nodes.some(
				(node) =>
					node.name.toLowerCase().includes(component.text) ||
					node.summary.toLowerCase().includes(component.text),
			);

			if (isFound) {
				component.covered = true;
				covered++;
			}
		}

		return { covered, total: queryComponents.length };
	}

	/**
	 * Fill gap for missing component
	 */
	private async fillGap(
		component: string,
		graphId: string | undefined,
		database: IDatabaseService,
		embedding: BaseEmbedding,
	): Promise<{ nodes: EnhancedNode[] }> {
		// Targeted search for this specific component
		const results = await vectorSearchNodes(
			database,
			embedding,
			[component],
			this.config.completeness.gapFillingLimit,
			graphId,
		);

		const nodes: EnhancedNode[] = results.map((result) => {
			const node = this.toEnhancedNode(
				result.item,
				result.similarity,
				-1, // Special level for gap-filling
				"gap_filling",
			);
			node.coverageContribution = 1.0; // High coverage value
			return node;
		});

		return { nodes };
	}

	// ============================================================================
	// PHASE 4: MULTI-FACTOR RE-RANKING
	// ============================================================================

	/**
	 * Phase 4: Re-rank using multiple factors
	 */
	private async phase4_ReRanking(
		nodes: EnhancedNode[],
		edges: EnhancedEdge[],
	): Promise<{
		nodes: EnhancedNode[];
		edges: EnhancedEdge[];
	}> {
		logInfo("[SMART_RETRIEVAL][P4] Starting multi-factor re-ranking");

		// Calculate graph metrics
		const graphMetrics = this.calculateGraphMetrics(nodes, edges);

		// Calculate final scores for nodes
		const scoredNodes = nodes.map((node) => {
			const centrality = graphMetrics.centrality.get(node.id) ?? 0;
			const density = graphMetrics.density.get(node.id) ?? 0;

			const finalScore =
				node.semanticScore * this.config.ranking.semanticWeight +
				centrality * this.config.ranking.centralityWeight +
				density * this.config.ranking.densityWeight +
				node.coverageContribution * this.config.ranking.coverageWeight;

			return {
				...node,
				centralityScore: centrality,
				edgeDensity: density,
				finalScore,
			};
		});

		// Sort by final score
		scoredNodes.sort((a, b) => (b.finalScore ?? 0) - (a.finalScore ?? 0));

		// Take top N nodes
		const topNodes = scoredNodes.slice(0, this.config.output.maxNodes);

		// Filter edges to only include those connecting top nodes
		const topNodeIds = new Set(topNodes.map((n) => n.id));
		const filteredEdges = edges.filter(
			(edge) =>
				topNodeIds.has(edge.sourceId) && topNodeIds.has(edge.destinationId),
		);

		// Sort edges by semantic score and take top N
		filteredEdges.sort((a, b) => b.semanticScore - a.semanticScore);
		const topEdges = filteredEdges.slice(0, this.config.output.maxEdges);

		// Update stats
		const avgScore = this.average(topNodes.map((n) => n.finalScore ?? 0));
		this.stats.phase4 = {
			finalNodes: topNodes.length,
			finalEdges: topEdges.length,
			avgFinalScore: avgScore,
		};

		logInfo("[SMART_RETRIEVAL][P4] Re-ranking complete", {
			nodes: topNodes.length,
			edges: topEdges.length,
			avgScore: avgScore.toFixed(3),
		});

		return {
			nodes: topNodes,
			edges: topEdges,
		};
	}

	/**
	 * Calculate graph metrics (centrality and density)
	 */
	private calculateGraphMetrics(
		nodes: EnhancedNode[],
		edges: EnhancedEdge[],
	): {
		centrality: Map<string, number>;
		density: Map<string, number>;
	} {
		const centrality = new Map<string, number>();
		const density = new Map<string, number>();

		// Build adjacency list
		const adjacency = new Map<string, Set<string>>();
		nodes.forEach((node) => adjacency.set(node.id, new Set()));

		edges.forEach((edge) => {
			adjacency.get(edge.sourceId)?.add(edge.destinationId);
			adjacency.get(edge.destinationId)?.add(edge.sourceId);
		});

		// Calculate simple degree centrality (normalized)
		const maxDegree = Math.max(
			...Array.from(adjacency.values()).map((neighbors) => neighbors.size),
			1,
		);

		nodes.forEach((node) => {
			const degree = adjacency.get(node.id)?.size ?? 0;
			centrality.set(node.id, degree / maxDegree);
		});

		// Calculate edge density (edges per node in subgraph)
		const totalNodes = nodes.length;
		nodes.forEach((node) => {
			const connectedEdges = edges.filter(
				(e) => e.sourceId === node.id || e.destinationId === node.id,
			);
			density.set(node.id, connectedEdges.length / totalNodes);
		});

		return { centrality, density };
	}

	// ============================================================================
	// TOPIC-BASED RETRIEVAL & MERGING
	// ============================================================================

	/**
	 * Retrieve core context knowledge using provided context query
	 * Uses exploratory MMR mode for diverse, less fact-heavy results
	 */
	private async retrieveCoreContext(
		coreContext: string,
		graphId: string | undefined,
		database: IDatabaseService,
		embedding: BaseEmbedding,
	): Promise<{
		nodes: EnhancedNode[];
		edges: EnhancedEdge[];
	}> {
		if (!this.config.topic?.enabled) {
			return { nodes: [], edges: [] };
		}

		logInfo("[SMART_RETRIEVAL][CORE] Retrieving core context knowledge", {
			contextQuery: coreContext.substring(0, 100),
			nodeLimit: this.config.topic.nodeLimit,
			mmrMode: this.config.topic.mmrMode,
		});

		// Embed core context for semantic search
		const contextEmbedding = await embedding.textToVector(coreContext);

		// Fetch candidates with exploratory MMR
		const candidateMultiplier = 2;
		const nodeCandidateLimit =
			this.config.topic.nodeLimit * candidateMultiplier;

		const nodeResults = await vectorSearchNodes(
			database,
			embedding,
			[coreContext],
			nodeCandidateLimit,
			graphId,
		);

		const edgeResults = await vectorSearchEdges(
			database,
			embedding,
			[coreContext],
			this.config.topic.edgeLimit,
			graphId,
		);

		// Convert to enhanced nodes
		const nodeCandidates: EnhancedNode[] = nodeResults
			.filter((result) => result.similarity >= 0.3) // Lower threshold for topic
			.map((result) =>
				this.toEnhancedNode(result.item, result.similarity, -2, "seed"),
			);

		// Apply exploratory MMR for maximum diversity
		const mmrConfig: MMRConfig = {
			enabled: true,
			mode: this.config.topic.mmrMode,
			candidateMultiplier: 2,
		};

		let nodes: EnhancedNode[];
		if (nodeCandidates.length > this.config.topic.nodeLimit) {
			nodes = this.applyMMRToNodes(
				nodeCandidates,
				contextEmbedding,
				this.config.topic.nodeLimit,
				mmrConfig,
			);
		} else {
			nodes = nodeCandidates.slice(0, this.config.topic.nodeLimit);
		}

		// Mark all core context nodes with lower weight
		nodes.forEach((node) => {
			node.coverageContribution = this.config.topic!.relevanceWeight;
		});

		const edges: EnhancedEdge[] = edgeResults
			.filter((result) => result.similarity >= 0.25)
			.slice(0, this.config.topic.edgeLimit)
			.map((result) =>
				this.toEnhancedEdge(result.item, result.similarity, -2, "seed"),
			);

		logInfo("[SMART_RETRIEVAL][CORE] Core context knowledge retrieved", {
			nodes: nodes.length,
			edges: edges.length,
			avgSimilarity: this.average(nodes.map((n) => n.semanticScore)).toFixed(3),
		});

		return { nodes, edges };
	}

	/**
	 * Merge task-based and core context knowledge
	 * Removes duplicates and balances relevance
	 */
	private mergeKnowledgeSets(
		taskNodes: EnhancedNode[],
		taskEdges: EnhancedEdge[],
		topicNodes: EnhancedNode[],
		topicEdges: EnhancedEdge[],
	): {
		nodes: EnhancedNode[];
		edges: EnhancedEdge[];
		duplicatesRemoved: number;
	} {
		const nodeMap = new Map<string, EnhancedNode>();
		const edgeMap = new Map<string, EnhancedEdge>();

		// Add task nodes first (higher priority)
		taskNodes.forEach((node) => nodeMap.set(node.id, node));

		// Add topic nodes (only if not already present)
		let duplicateNodes = 0;
		topicNodes.forEach((node) => {
			if (nodeMap.has(node.id)) {
				duplicateNodes++;
				// Boost coverage contribution for nodes that appear in both
				const existing = nodeMap.get(node.id)!;
				existing.coverageContribution = Math.max(
					existing.coverageContribution,
					0.5,
				);
			} else {
				nodeMap.set(node.id, node);
			}
		});

		// Add task edges first
		taskEdges.forEach((edge) => edgeMap.set(edge.id, edge));

		// Add topic edges (only if not already present)
		let duplicateEdges = 0;
		topicEdges.forEach((edge) => {
			if (!edgeMap.has(edge.id)) {
				edgeMap.set(edge.id, edge);
			} else {
				duplicateEdges++;
			}
		});

		const mergedNodes = Array.from(nodeMap.values());
		const mergedEdges = Array.from(edgeMap.values());

		logInfo("[SMART_RETRIEVAL][MERGE] Merged task and topic knowledge", {
			taskNodes: taskNodes.length,
			topicNodes: topicNodes.length,
			mergedNodes: mergedNodes.length,
			duplicateNodes,
			duplicateEdges,
		});

		return {
			nodes: mergedNodes,
			edges: mergedEdges,
			duplicatesRemoved: duplicateNodes + duplicateEdges,
		};
	}

	// ============================================================================
	// ORCHESTRATION
	// ============================================================================

	/**
	 * Execute the full 4-phase smart retrieval with optional core context
	 */
	private async executeSmartRetrieval(
		query: string,
		graphId: string | undefined,
		coreContext: string | undefined,
		database: IDatabaseService,
		embedding: BaseEmbedding,
	): Promise<{
		nodes: EnhancedNode[];
		edges: EnhancedEdge[];
		queryComponents: QueryComponent[];
	}> {
		// TASK-BASED RETRIEVAL (always performed)
		// Phase 1: Semantic Seed Retrieval
		const phase1 = await this.phase1_SemanticSeed(
			query,
			graphId,
			database,
			embedding,
		);

		// Phase 2: Smart Graph Expansion
		const phase2 = await this.phase2_SmartExpansion(
			phase1.nodes,
			phase1.edges,
			phase1.queryEmbedding,
			graphId,
			database,
		);

		// Phase 3: Completeness Verification
		const phase3 = await this.phase3_CompletenessCheck(
			phase2.nodes,
			phase2.edges,
			query,
			graphId,
			database,
			embedding,
		);

		// CORE CONTEXT RETRIEVAL (only if coreContext provided and enabled)
		let finalNodes = phase3.nodes;
		let finalEdges = phase3.edges;

		if (coreContext && this.config.topic?.enabled) {
			try {
				logInfo("[SMART_RETRIEVAL] Performing dual retrieval (task + core)", {
					coreContext: coreContext.substring(0, 100),
				});

				const coreKnowledge = await this.retrieveCoreContext(
					coreContext,
					graphId,
					database,
					embedding,
				);

				// Merge task and core knowledge
				const merged = this.mergeKnowledgeSets(
					phase3.nodes,
					phase3.edges,
					coreKnowledge.nodes,
					coreKnowledge.edges,
				);

				finalNodes = merged.nodes;
				finalEdges = merged.edges;

				// Update topic stats
				this.stats.topic = {
					enabled: true,
					topicNodes: coreKnowledge.nodes.length,
					topicEdges: coreKnowledge.edges.length,
					mergedNodes: merged.nodes.length,
					mergedEdges: merged.edges.length,
					duplicatesRemoved: merged.duplicatesRemoved,
				};

				logInfo("[SMART_RETRIEVAL] Dual retrieval complete", {
					taskOnly: phase3.nodes.length,
					coreAdded: coreKnowledge.nodes.length,
					finalMerged: merged.nodes.length,
				});
			} catch (error) {
				logError(
					"[SMART_RETRIEVAL] Topic retrieval failed, using task-only results:",
					error,
				);
				// Continue with task-only results
				this.stats.topic = {
					enabled: false,
					topicNodes: 0,
					topicEdges: 0,
					mergedNodes: 0,
					mergedEdges: 0,
					duplicatesRemoved: 0,
				};
			}
		} else {
			logInfo(
				"[SMART_RETRIEVAL] Task-only retrieval (no graphId or topic disabled)",
			);
			this.stats.topic = {
				enabled: false,
				topicNodes: 0,
				topicEdges: 0,
				mergedNodes: 0,
				mergedEdges: 0,
				duplicatesRemoved: 0,
			};
		}

		// Phase 4: Multi-Factor Re-Ranking (on merged results)
		const phase4 = await this.phase4_ReRanking(finalNodes, finalEdges);

		return {
			nodes: phase4.nodes,
			edges: phase4.edges,
			queryComponents: phase3.queryComponents,
		};
	}

	// ============================================================================
	// MMR (MAXIMAL MARGINAL RELEVANCE) IMPLEMENTATION
	// ============================================================================

	/**
	 * Get effective lambda value based on MMR configuration
	 */
	private getMMRLambda(mmrConfig: MMRConfig): number {
		if (mmrConfig.mode === "custom") {
			// Use custom lambda if provided, otherwise default to balanced
			return mmrConfig.lambda ?? MMR_MODE_LAMBDAS.balanced;
		}
		// Use preset lambda for the mode
		return MMR_MODE_LAMBDAS[mmrConfig.mode];
	}

	/**
	 * Apply MMR (Maximal Marginal Relevance) to select diverse results
	 *
	 * Algorithm:
	 * 1. Start with empty selected set
	 * 2. For each iteration:
	 *    a. For each candidate, calculate MMR score:
	 *       MMR = λ × Sim(candidate, query) - (1-λ) × max(Sim(candidate, selected))
	 *    b. Select candidate with highest MMR score
	 *    c. Remove from candidates, add to selected
	 * 3. Repeat until target count reached
	 *
	 * @param candidates - Pool of candidates with embeddings and similarity scores
	 * @param queryEmbedding - Query embedding for relevance calculation
	 * @param targetCount - Number of results to select
	 * @param lambda - Trade-off parameter (0-1): higher = more relevance, lower = more diversity
	 * @returns Selected diverse results
	 */
	private applyMMR<
		T extends { embedding: number[] | null; semanticScore: number },
	>(
		candidates: T[],
		queryEmbedding: number[],
		targetCount: number,
		lambda: number,
	): T[] {
		if (candidates.length <= targetCount) {
			// Not enough candidates, return all
			return candidates;
		}

		const selected: T[] = [];
		const remaining = [...candidates];

		// Select first item (highest similarity to query)
		remaining.sort((a, b) => b.semanticScore - a.semanticScore);
		selected.push(remaining.shift()!);

		// Iteratively select remaining items
		while (selected.length < targetCount && remaining.length > 0) {
			let bestMMRScore = -Infinity;
			let bestIndex = -1;

			// Calculate MMR score for each remaining candidate
			for (let i = 0; i < remaining.length; i++) {
				const candidate = remaining[i];

				// Skip if no embedding
				if (!candidate.embedding) {
					continue;
				}

				// Relevance: similarity to query (already computed)
				const relevance = candidate.semanticScore;

				// Diversity: max similarity to already selected items
				let maxSimilarityToSelected = 0;
				for (const selectedItem of selected) {
					if (!selectedItem.embedding) continue;

					const similarity = this.cosineSimilarity(
						candidate.embedding,
						selectedItem.embedding,
					);
					maxSimilarityToSelected = Math.max(
						maxSimilarityToSelected,
						similarity,
					);
				}

				// MMR score: balance relevance and diversity
				const mmrScore =
					lambda * relevance - (1 - lambda) * maxSimilarityToSelected;

				if (mmrScore > bestMMRScore) {
					bestMMRScore = mmrScore;
					bestIndex = i;
				}
			}

			// Select best candidate
			if (bestIndex >= 0) {
				selected.push(remaining.splice(bestIndex, 1)[0]);
			} else {
				// No valid candidate found (no embeddings), break
				break;
			}
		}

		return selected;
	}

	/**
	 * Apply MMR to node candidates if enabled
	 */
	private applyMMRToNodes(
		nodes: EnhancedNode[],
		queryEmbedding: number[],
		targetCount: number,
		mmrConfig: MMRConfig,
	): EnhancedNode[] {
		if (!mmrConfig.enabled) {
			// MMR disabled, return top-K by similarity
			return nodes.slice(0, targetCount);
		}

		const lambda = this.getMMRLambda(mmrConfig);

		logInfo(
			`[SMART_RETRIEVAL][MMR] Applying MMR to ${nodes.length} candidates`,
			{
				mode: mmrConfig.mode,
				lambda,
				targetCount,
			},
		);

		const diverseNodes = this.applyMMR(
			nodes,
			queryEmbedding,
			targetCount,
			lambda,
		);

		logInfo(
			`[SMART_RETRIEVAL][MMR] Selected ${diverseNodes.length} diverse nodes`,
			{
				avgSimilarity: this.average(
					diverseNodes.map((n) => n.semanticScore),
				).toFixed(3),
			},
		);

		return diverseNodes;
	}

	// ============================================================================
	// HELPER METHODS
	// ============================================================================

	/**
	 * Validate required services
	 */
	private validateServices(): {
		database: IDatabaseService;
		embedding: AllServices["embedding"];
	} {
		const { database, embedding } = this.services;

		if (!database) {
			throw new Error("[SMART_RETRIEVAL] Database service not available");
		}

		if (!embedding) {
			throw new Error("[SMART_RETRIEVAL] Embedding service not available");
		}

		return { database, embedding };
	}

	/**
	 * Get default embedding model
	 */
	private async getDefaultEmbedding(
		embeddingService: AllServices["embedding"],
	): Promise<BaseEmbedding> {
		const defaultEmbedding = await embeddingService.get("default");

		if (!defaultEmbedding || !defaultEmbedding.isReady()) {
			throw new Error("[SMART_RETRIEVAL] Default embedding not ready");
		}

		return defaultEmbedding;
	}

	/**
	 * Calculate semantic similarity between node and query
	 */
	private async calculateSemanticSimilarity(
		node: Node,
		queryEmbedding: number[],
	): Promise<number> {
		// Get node embedding (try different sizes)
		const nodeEmbedding =
			node.nameEmbedding ?? node.nameEmbeddingSmall ?? node.nameEmbeddingLarge;

		if (!nodeEmbedding || !Array.isArray(nodeEmbedding)) {
			// No embedding available, return low score
			return 0.1;
		}

		// Ensure same dimensions
		if (nodeEmbedding.length !== queryEmbedding.length) {
			logWarn(
				`[SMART_RETRIEVAL] Embedding dimension mismatch: node=${nodeEmbedding.length}, query=${queryEmbedding.length}`,
			);
			return 0.1;
		}

		// Calculate cosine similarity
		return this.cosineSimilarity(nodeEmbedding, queryEmbedding);
	}

	/**
	 * Cosine similarity between two vectors
	 */
	private cosineSimilarity(a: number[], b: number[]): number {
		if (a.length !== b.length) return 0;

		let dotProduct = 0;
		let normA = 0;
		let normB = 0;

		for (let i = 0; i < a.length; i++) {
			dotProduct += a[i] * b[i];
			normA += a[i] * a[i];
			normB += b[i] * b[i];
		}

		const denominator = Math.sqrt(normA) * Math.sqrt(normB);
		return denominator === 0 ? 0 : dotProduct / denominator;
	}

	/**
	 * Convert database Node to EnhancedNode
	 */
	private toEnhancedNode(
		node: Node,
		semanticScore: number,
		level: number,
		source: EnhancedNode["source"],
	): EnhancedNode {
		return {
			id: node.id,
			nodeType: node.nodeType,
			name: node.name,
			summary: node.summary ?? "",
			attributes: (node.attributes as Record<string, unknown>) ?? {},
			embedding:
				(node.nameEmbedding as number[]) ??
				(node.nameEmbeddingSmall as number[]) ??
				null,
			semanticScore,
			level,
			source,
			coverageContribution: 0,
		};
	}

	/**
	 * Convert database Edge to EnhancedEdge
	 */
	private toEnhancedEdge(
		edge: Edge,
		semanticScore: number,
		level: number,
		source: EnhancedEdge["source"],
	): EnhancedEdge {
		return {
			id: edge.id,
			sourceId: edge.sourceId,
			destinationId: edge.destinationId,
			edgeType: edge.edgeType,
			factText: edge.factText ?? "",
			attributes: (edge.attributes as Record<string, unknown>) ?? {},
			embedding: (edge.factEmbedding as number[]) ?? null,
			semanticScore,
			level,
			source,
		};
	}

	/**
	 * Calculate average of numbers
	 */
	private average(numbers: number[]): number {
		if (numbers.length === 0) return 0;
		return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
	}

	/**
	 * Merge configuration with defaults
	 */
	private mergeConfig(
		defaults: SmartRetrievalConfig,
		overrides?: Partial<SmartRetrievalConfig>,
	): SmartRetrievalConfig {
		if (!overrides) return defaults;

		return {
			seed: {
				...defaults.seed,
				...overrides.seed,
				// Deep merge MMR config
				mmr: overrides.seed?.mmr
					? {
							...defaults.seed.mmr,
							...overrides.seed.mmr,
						}
					: defaults.seed.mmr,
			},
			expansion: { ...defaults.expansion, ...overrides.expansion },
			completeness: { ...defaults.completeness, ...overrides.completeness },
			ranking: { ...defaults.ranking, ...overrides.ranking },
			output: { ...defaults.output, ...overrides.output },
			topic: overrides.topic
				? { ...defaults.topic, ...overrides.topic }
				: defaults.topic,
		};
	}

	/**
	 * Initialize statistics
	 */
	private initStats(): RetrievalStats {
		return {
			phase1: {
				seedNodes: 0,
				seedEdges: 0,
				avgNodeSimilarity: 0,
				avgEdgeSimilarity: 0,
			},
			phase2: {
				levelsExpanded: 0,
				nodesPerLevel: [],
				edgesPerLevel: [],
				totalExpanded: 0,
			},
			phase3: {
				components: 0,
				coverage: 0,
				iterations: 0,
				gapsFilled: 0,
			},
			phase4: {
				finalNodes: 0,
				finalEdges: 0,
				avgFinalScore: 0,
			},
		};
	}

	/**
	 * Format retrieval description for actions
	 */
	private formatRetrievalDescription(): string {
		const { phase1, phase2, phase3, phase4, topic } = this.stats;

		const lines = [
			`Smart Hybrid Retrieval: ${phase4.finalNodes} nodes, ${phase4.finalEdges} edges`,
			`• Phase 1: ${phase1.seedNodes} seed nodes (avg sim: ${phase1.avgNodeSimilarity.toFixed(2)})`,
			`• Phase 2: ${phase2.levelsExpanded} levels, +${phase2.totalExpanded} nodes`,
			`• Phase 3: ${(phase3.coverage * 100).toFixed(0)}% coverage, ${phase3.gapsFilled} gaps filled`,
		];

		// Add topic info if enabled
		if (topic?.enabled) {
			lines.push(
				`• Topic: +${topic.topicNodes} context nodes, ${topic.duplicatesRemoved} duplicates removed`,
			);
		}

		lines.push(`• Phase 4: avg score ${phase4.avgFinalScore.toFixed(2)}`);

		return lines.join("\n");
	}
}
