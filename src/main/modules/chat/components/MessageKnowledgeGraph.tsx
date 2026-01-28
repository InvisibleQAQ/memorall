import React, { useMemo } from "react";
import { D3KnowledgeGraph } from "@/main/modules/knowledge/components/D3KnowledgeGraph";
import type { Node, Edge } from "@/services/database/types";

// Match the exact types from KnowledgeRAGState
interface MessageKnowledgeGraphProps {
	nodes: Array<{
		id: string;
		nodeType: string;
		name: string;
		summary: string;
		attributes: Record<string, unknown>;
		relevanceScore: number;
	}>;
	edges: Array<{
		id: string;
		sourceId: string;
		destinationId: string;
		edgeType: string;
		factText: string;
		attributes: Record<string, unknown>;
		relevanceScore: number;
	}>;
}

export const MessageKnowledgeGraph: React.FC<MessageKnowledgeGraphProps> = ({
	nodes,
	edges,
}) => {
	// Convert the action nodes/edges to database Node/Edge format
	const graphData = useMemo(() => {
		const dbNodes: Node[] = nodes.map((node) => ({
			id: node.id,
			nodeType: node.nodeType,
			name: node.name,
			summary: node.summary || null,
			attributes: node.attributes,
			nameEmbeddingSmall: null,
			nameEmbedding: null,
			nameEmbeddingLarge: null,
			graph: "",
			createdAt: new Date(),
			updatedAt: new Date(),
		}));

		const dbEdges: Edge[] = edges.map((edge) => ({
			id: edge.id,
			sourceId: edge.sourceId,
			destinationId: edge.destinationId,
			edgeType: edge.edgeType,
			factText: edge.factText || null,
			validAt: null,
			invalidAt: null,
			attributes: edge.attributes,
			isCurrent: true,
			provenanceWeightCache: null,
			provenanceCountCache: null,
			factEmbeddingSmall: null,
			factEmbedding: null,
			factEmbeddingLarge: null,
			typeEmbeddingSmall: null,
			typeEmbedding: null,
			typeEmbeddingLarge: null,
			graph: "",
			recordedAt: new Date(),
			createdAt: new Date(),
			updatedAt: new Date(),
		}));

		return { nodes: dbNodes, edges: dbEdges };
	}, [nodes, edges]);

	return (
		<div className="w-full rounded-lg overflow-hidden bg-background/50 border border-border">
			<D3KnowledgeGraph graphData={graphData} width={600} height={400} />
		</div>
	);
};
