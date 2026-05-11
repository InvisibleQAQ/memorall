import type * as d3 from "d3";
import type { Node, Edge } from "@/services/database/types";

export interface D3Node extends d3.SimulationNodeDatum {
	id: string;
	name: string;
	nodeType: string;
	summary?: string;
	group: number;
	radius: number;
	originalX?: number;
	originalY?: number;
}

export interface D3Edge {
	source: string | D3Node;
	target: string | D3Node;
	id: string;
	edgeType: string;
	factText?: string;
	weight: number;
}

export interface GraphData {
	nodes: D3Node[];
	edges: D3Edge[];
}

export interface ConnectedEdge {
	edge: D3Edge;
	connectedNode: D3Node;
	direction: "incoming" | "outgoing";
}

export interface D3KnowledgeGraphProps {
	selectedPageId?: string;
	selectedNodeId?: string;
	graphData?: { nodes: Node[]; edges: Edge[] };
	width?: number;
	height?: number;
	variant?: "default" | "inline";
	onNodeDeleted?: () => void;
	onEdgeDeleted?: (edgeId: string) => Promise<void> | void;
	onNodeSelect?: (nodeId: string | null) => void;
}
