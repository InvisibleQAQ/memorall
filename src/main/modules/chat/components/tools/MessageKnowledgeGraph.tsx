import type { ActionRenderer } from "@/main/modules/chat/components/types";
import { MessageKnowledgeGraph } from "@/main/modules/chat/components/MessageKnowledgeGraph";
import { ToolItemRawIO } from "./ToolCommon";

interface KnowledgeGraphMetadata extends Record<string, unknown> {
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

export function isKnowledgeGraphMetadata(
	metadata: Record<string, unknown> | undefined,
): metadata is KnowledgeGraphMetadata {
	if (!metadata) {
		return false;
	}

	let hasNodes = false;
	if (Array.isArray(metadata.nodes)) {
		const invalidNodes = metadata.nodes.filter((node: unknown) => {
			if (typeof node !== "object" || node === null) {
				return true;
			}
			const nodeObj = node as Record<string, unknown>;
			const checks = {
				hasId: "id" in nodeObj,
				hasName: "name" in nodeObj,
				idIsString: typeof nodeObj.id === "string",
				nameIsString: typeof nodeObj.name === "string",
			};
			return !Object.values(checks).every(Boolean);
		});
		hasNodes = invalidNodes.length === 0;
	}

	let hasEdges = false;
	if (Array.isArray(metadata.edges)) {
		const invalidEdges = metadata.edges.filter((edge: unknown) => {
			if (typeof edge !== "object" || edge === null) {
				return true;
			}
			const edgeObj = edge as Record<string, unknown>;
			const checks = {
				hasId: "id" in edgeObj,
				hasSourceId: "sourceId" in edgeObj,
				hasDestinationId: "destinationId" in edgeObj,
				hasEdgeType: "edgeType" in edgeObj,
				idIsString: typeof edgeObj.id === "string",
				sourceIdIsString: typeof edgeObj.sourceId === "string",
				destinationIdIsString: typeof edgeObj.destinationId === "string",
				edgeTypeIsString: typeof edgeObj.edgeType === "string",
			};
			return !Object.values(checks).every(Boolean);
		});
		hasEdges = invalidEdges.length === 0;
	}

	return hasNodes && hasEdges;
}

export const messageKnowledgeGraphRenderer: ActionRenderer = (item, isOpen) => {
	if (!isOpen || !isKnowledgeGraphMetadata(item.metadata)) return null;
	return (
		<div className="space-y-3">
			<MessageKnowledgeGraph
				nodes={item.metadata.nodes}
				edges={item.metadata.edges}
			/>
			<ToolItemRawIO item={item} output={item.metadata} />
		</div>
	);
};
