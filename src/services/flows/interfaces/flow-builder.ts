import type {
	Flow,
	FlowState,
	FlowStep,
	FlowConnection,
} from "@/services/database/types";
import type { CatalogService, CatalogStep } from "../flow-builder-catalog";

export interface FlowLayoutNode {
	stepId: string;
	position: { x: number; y: number };
	isStart?: boolean;
	isEnd?: boolean;
}

export interface FlowLayout {
	nodes: FlowLayoutNode[];
}

export interface FlowDefinition {
	flow: Flow;
	states: FlowState[];
	steps: FlowStep[];
	connections: FlowConnection[];
	layout?: FlowLayout;
}

export interface FlowDraftInput {
	name: string;
	description?: string;
	status?: string;
	serviceKeys?: string[];
	metadata?: Record<string, unknown>;
}

export interface FlowStateInput {
	name: string;
	type: string;
	metadata?: Record<string, unknown>;
}

export interface FlowStepInput {
	catalogStepId: string;
	name: string;
	type: string;
	isStart?: boolean;
	isEnd?: boolean;
	position: { x: number; y: number };
	metadata?: Record<string, unknown>;
}

export interface FlowConnectionInput {
	sourceStepId: string;
	targetStepId: string;
	metadata?: Record<string, unknown>;
}

/** In-memory catalog - not stored in DB */
export interface FlowCatalog {
	services: CatalogService[];
	steps: CatalogStep[];
}
