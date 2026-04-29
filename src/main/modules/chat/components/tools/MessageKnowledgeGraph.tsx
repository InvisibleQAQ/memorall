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

interface StructMemRetrievedMemory {
	id: string;
	nodeType: string;
	text: string;
	attributes: Record<string, unknown>;
	relevanceScore: number;
}

interface StructMemRetrievalMetadata extends Record<string, unknown> {
	atomicMemories: StructMemRetrievedMemory[];
	synthesisMemories: StructMemRetrievedMemory[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const isStringArray = (value: unknown): value is string[] =>
	Array.isArray(value) && value.every((item) => typeof item === "string");

const isStructMemMemory = (
	value: unknown,
): value is StructMemRetrievedMemory => {
	if (!isRecord(value)) return false;
	return (
		typeof value.id === "string" &&
		typeof value.nodeType === "string" &&
		typeof value.text === "string" &&
		isRecord(value.attributes) &&
		typeof value.relevanceScore === "number"
	);
};

const compactLabel = (text: string, fallback: string): string => {
	const normalized = text.replace(/\s+/g, " ").trim();
	if (!normalized) return fallback;
	return normalized.length > 64 ? `${normalized.slice(0, 61)}...` : normalized;
};

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

export function isStructMemRetrievalMetadata(
	metadata: Record<string, unknown> | undefined,
): metadata is StructMemRetrievalMetadata {
	if (!metadata) return false;
	return (
		Array.isArray(metadata.atomicMemories) &&
		Array.isArray(metadata.synthesisMemories) &&
		metadata.atomicMemories.every(isStructMemMemory) &&
		metadata.synthesisMemories.every(isStructMemMemory)
	);
}

function buildStructMemSubgraph(metadata: StructMemRetrievalMetadata) {
	const atomicMemories = metadata.atomicMemories.slice(0, 60);
	const synthesisMemories = metadata.synthesisMemories.slice(0, 10);
	const memoryIds = new Set([
		...atomicMemories.map((memory) => memory.id),
		...synthesisMemories.map((memory) => memory.id),
	]);

	const nodes: KnowledgeGraphMetadata["nodes"] = [
		{
			id: "structmem-retrieval-root",
			nodeType: "structmem_retrieval",
			name: "StructMem Knowledge Retrieval",
			summary:
				"Retrieved StructMem event memories and synthesis memories for this response.",
			attributes: {
				structmem: true,
				atomicMemoryCount: metadata.atomicMemories.length,
				synthesisMemoryCount: metadata.synthesisMemories.length,
			},
			relevanceScore: 1,
		},
		...atomicMemories.map((memory) => ({
			id: memory.id,
			nodeType: memory.nodeType,
			name: compactLabel(
				memory.text,
				memory.nodeType.includes("relational")
					? "StructMem relational memory"
					: "StructMem factual memory",
			),
			summary: memory.text,
			attributes: memory.attributes,
			relevanceScore: memory.relevanceScore,
		})),
		...synthesisMemories.map((memory) => ({
			id: memory.id,
			nodeType: memory.nodeType,
			name: compactLabel(memory.text, "StructMem synthesis memory"),
			summary: memory.text,
			attributes: memory.attributes,
			relevanceScore: memory.relevanceScore,
		})),
	];

	const rootEdges: KnowledgeGraphMetadata["edges"] = [
		...atomicMemories.map((memory) => ({
			id: `structmem-root-${memory.id}`,
			sourceId: "structmem-retrieval-root",
			destinationId: memory.id,
			edgeType: "RETRIEVED_EVENT_MEMORY",
			factText: `Retrieved with score ${memory.relevanceScore.toFixed(3)}`,
			attributes: { structmem: true, role: "event_memory" },
			relevanceScore: memory.relevanceScore,
		})),
		...synthesisMemories.map((memory) => ({
			id: `structmem-root-${memory.id}`,
			sourceId: "structmem-retrieval-root",
			destinationId: memory.id,
			edgeType: "RETRIEVED_SYNTHESIS_MEMORY",
			factText: `Retrieved with score ${memory.relevanceScore.toFixed(3)}`,
			attributes: { structmem: true, role: "synthesis_memory" },
			relevanceScore: memory.relevanceScore,
		})),
	];

	const groundedEdges = synthesisMemories.flatMap((synthesis) => {
		const sourceEntryIds = [
			...(isStringArray(synthesis.attributes.sourceEntryIds)
				? synthesis.attributes.sourceEntryIds
				: []),
			...(isStringArray(synthesis.attributes.seedEntryIds)
				? synthesis.attributes.seedEntryIds
				: []),
		];

		return Array.from(new Set(sourceEntryIds))
			.filter((entryId) => memoryIds.has(entryId))
			.map((entryId) => ({
				id: `structmem-grounded-${synthesis.id}-${entryId}`,
				sourceId: synthesis.id,
				destinationId: entryId,
				edgeType: "GROUNDED_IN",
				factText: "Synthesis memory cites this event memory.",
				attributes: { structmem: true, role: "grounding" },
				relevanceScore: synthesis.relevanceScore,
			}));
	});

	return {
		nodes,
		edges: [...rootEdges, ...groundedEdges],
	};
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

export const structMemKnowledgeRetrievalRenderer: ActionRenderer = (
	item,
	isOpen,
) => {
	if (!isOpen || !isStructMemRetrievalMetadata(item.metadata)) return null;
	const graph = buildStructMemSubgraph(item.metadata);

	return (
		<div className="space-y-3">
			<MessageKnowledgeGraph nodes={graph.nodes} edges={graph.edges} />
			<ToolItemRawIO item={item} output={item.metadata} />
		</div>
	);
};
