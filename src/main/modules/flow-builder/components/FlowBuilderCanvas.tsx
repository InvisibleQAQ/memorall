import React, { useMemo, useCallback } from "react";
import {
	ReactFlow,
	Background,
	Controls,
	MiniMap,
	type Node,
	type Edge,
	type NodeChange,
	type EdgeChange,
	type Connection,
	type OnNodesChange,
	type NodeTypes,
	type EdgeTypes,
} from "@xyflow/react";
import { useTranslation } from "react-i18next";
import { flowNodeTypes } from "./FlowStepNode";
import { FlowDeletableEdge } from "./FlowDeletableEdge";
import type { FlowNodeData } from "@/main/stores/flow-builder";

interface FlowBuilderCanvasProps {
	nodes: Node<FlowNodeData>[];
	edges: Edge[];
	selectedFlowId: string | null;
	onNodesChange: OnNodesChange<Node<FlowNodeData>>;
	onEdgesChange: (changes: EdgeChange[]) => void;
	onConnect: (connection: Connection) => void;
	onNodeClick: (nodeId: string) => void;
	onDropStep: (stepId: string, position: { x: number; y: number }) => void;
}

const FlowBuilderCanvasInner: React.FC<FlowBuilderCanvasProps> = ({
	nodes,
	edges,
	selectedFlowId,
	onNodesChange,
	onEdgesChange,
	onConnect,
	onNodeClick,
	onDropStep,
}) => {
	const { t } = useTranslation();

	const nodeTypes: NodeTypes = useMemo(() => flowNodeTypes, []);
	const edgeTypes: EdgeTypes = useMemo(
		() => ({
			deletable: FlowDeletableEdge,
		}),
		[],
	);

	const handleEdgeDelete = useCallback(
		(edgeId: string) => {
			const removeChange: EdgeChange = { id: edgeId, type: "remove" };
			onEdgesChange([removeChange]);
		},
		[onEdgesChange],
	);

	const decoratedEdges = useMemo(
		() =>
			edges.map((edge) => ({
				...edge,
				type: edge.type ?? "deletable",
				data: { ...(edge.data ?? {}), onDelete: handleEdgeDelete },
			})),
		[edges, handleEdgeDelete],
	);

	const handleIsValidConnection = useCallback(
		(connection: { source?: string | null; target?: string | null }) => {
			if (connection.source === "__end__") return false;
			if (connection.target === "__start__") return false;
			return true;
		},
		[],
	);

	const handleNodeClick = useCallback(
		(_: React.MouseEvent, node: Node) => {
			onNodeClick(node.id);
		},
		[onNodeClick],
	);

	const handleDrop = useCallback(
		(event: React.DragEvent<HTMLDivElement>) => {
			event.preventDefault();
			const stepId = event.dataTransfer.getData("application/flow-step");
			if (!stepId) return;

			const bounds = event.currentTarget.getBoundingClientRect();
			const position = {
				x: event.clientX - bounds.left,
				y: event.clientY - bounds.top,
			};

			onDropStep(stepId, position);
		},
		[onDropStep],
	);

	const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
		event.preventDefault();
		event.dataTransfer.dropEffect = "move";
	}, []);

	return (
		<section
			className="relative min-h-0 h-full max-h-full"
			onDrop={handleDrop}
			onDragOver={handleDragOver}
		>
			<ReactFlow
				className="h-full w-full"
				nodes={nodes}
				edges={decoratedEdges}
				nodeTypes={nodeTypes}
				edgeTypes={edgeTypes}
				onNodesChange={onNodesChange}
				onEdgesChange={onEdgesChange}
				onConnect={onConnect}
				isValidConnection={handleIsValidConnection}
				onNodeClick={handleNodeClick}
				fitView
			>
				<Background />
				<Controls />
				<MiniMap />
			</ReactFlow>
			{!selectedFlowId && (
				<div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground bg-background/80">
					{t("flowBuilder.selectOrCreateFlow", {
						defaultValue: "Select or create a flow to start building.",
					})}
				</div>
			)}
		</section>
	);
};

// Memoize to prevent re-renders when unrelated state changes
export const FlowBuilderCanvas = React.memo(FlowBuilderCanvasInner, (prev, next) => {
	// Only re-render if nodes, edges, or selectedFlowId changed
	return (
		prev.nodes === next.nodes &&
		prev.edges === next.edges &&
		prev.selectedFlowId === next.selectedFlowId &&
		prev.onNodesChange === next.onNodesChange &&
		prev.onEdgesChange === next.onEdgesChange &&
		prev.onConnect === next.onConnect &&
		prev.onNodeClick === next.onNodeClick &&
		prev.onDropStep === next.onDropStep
	);
});
