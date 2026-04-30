export type GrowType = "knowledge-graph" | "structmem";
export type RecallType = "smart" | "quick" | "llm" | "structmem";

export const GROW_TYPES: GrowType[] = ["knowledge-graph", "structmem"];

export const RECALL_TYPES_BY_GROW: Record<GrowType, RecallType[]> = {
	"knowledge-graph": ["smart", "quick", "llm"],
	structmem: ["structmem"],
};

export const DEFAULT_GROW_TYPE: GrowType = "knowledge-graph";
export const DEFAULT_RECALL_TYPE: RecallType = "smart";

export function getValidRecallTypes(growType: GrowType): RecallType[] {
	return RECALL_TYPES_BY_GROW[growType];
}

export function isRecallTypeValidForGrow(
	growType: GrowType,
	recallType: RecallType,
): boolean {
	return RECALL_TYPES_BY_GROW[growType].includes(recallType);
}
