/**
 * Flow Config Builder
 *
 * Provides two public functions:
 *
 *   buildDefaultFlowConfig(graphType)
 *     Returns the canonical default UnifiedFlowConfig for a graph type.
 *     Steps are ordered by the GRAPH_STEP_ORDER table; their config slots are
 *     pre-filled with the defaults declared in each step's StepMeta.
 *
 *   mergeWithDefaultConfig(saved, graphType)
 *     Overlays a persisted (potentially partial) config onto the canonical
 *     default.  Steps added to the catalog after a config was saved will
 *     appear with their defaults automatically — no migration needed.
 *
 * Design note: the canonical ordering lives here, not in individual graph
 * files, so that adding a new graph type only requires a new entry in
 * GRAPH_STEP_ORDER rather than changes scattered across the codebase.
 */

import { stepRegistry } from "./step-registry";
import { getFeatureCatalogSteps } from "./flow-builder-catalog";
import type {
	UnifiedFlowConfig,
	StepInstanceConfig,
} from "./interfaces/flow-config";

// ---------------------------------------------------------------------------
// Default system prompt for knowledge-rag add-system step
// ---------------------------------------------------------------------------

export const DEFAULT_KNOWLEDGE_RAG_SYSTEM_PROMPT = `
You are a knowledgeable assistant.
Use the provided system context and answer clearly, accurately, and with structured sections when useful.
If tools or feature-enabled capabilities are available, use them repeatedly when needed to fully solve the user's requirement.
Do not stop after a single attempt if the result is incomplete, ambiguous, or failed. Continue with follow-up tool use, retries, and verification until the task is actually resolved or you have a concrete blocking reason.
`.trim();

const DEFAULT_AGENT_COMPLETION_TOOLS = ["current_time", "js_execute"] as const;

// ---------------------------------------------------------------------------
// Canonical step ordering per graph type
// ---------------------------------------------------------------------------

/**
 * Defines the execution order for every step slot in a graph type.
 * Feature steps (catalog type="feature") are inserted at the position
 * indicated by the FEATURE_SLOT sentinel — they stay in the relative
 * order they appear in the catalog.
 *
 * To add a new graph type: add its entry here.
 * To add a new core step to an existing graph: add it in the right position.
 */
const FEATURE_SLOT = "__features__" as const;

type StepSlot = string | typeof FEATURE_SLOT;

const GRAPH_STEP_ORDER = {
	"knowledge-rag": [
		"add-system",
		"context-smart-retrieve",
		"context-quick-retrieve",
		"context-llm-retrieve",
		FEATURE_SLOT,
		"agent-completion",
		"chat-completion",
		"entities-facts-citation",
	],
	agent: ["add-system", FEATURE_SLOT, "agent-completion"],
} as const satisfies Record<string, readonly StepSlot[]>;

export type FlowGraphType = keyof typeof GRAPH_STEP_ORDER;

const DEFAULT_GRAPH_TYPE: FlowGraphType = "knowledge-rag";

function isFlowGraphType(value: string): value is FlowGraphType {
	return value in GRAPH_STEP_ORDER;
}

export function normalizeFlowGraphType(
	graphType: string | undefined,
): FlowGraphType {
	return graphType && isFlowGraphType(graphType)
		? graphType
		: DEFAULT_GRAPH_TYPE;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createDefaultStepId(
	graphType: FlowGraphType,
	name: string,
	occurrence: number,
): string {
	const safeName = name.replace(/[^a-z0-9_-]/gi, "_");
	return `${graphType}__${safeName}__${occurrence}`;
}

/** Build the initial config value for a step slot. */
function buildStepInstance(
	name: string,
	graphType: FlowGraphType,
	occurrence: number,
): StepInstanceConfig {
	const meta = stepRegistry.getMeta(name);
	const config: Record<string, unknown> = {};

	for (const param of meta?.configParams ?? []) {
		if (param.default !== undefined) {
			config[param.key] = param.default;
		}
	}

	// Special case: seed the default system prompt for add-system in knowledge-rag
	if (name === "add-system" && graphType === "knowledge-rag") {
		config.content = DEFAULT_KNOWLEDGE_RAG_SYSTEM_PROMPT;
	}

	// Preserve the legacy default toolset for agent-based chat flows.
	if (name === "agent-completion") {
		config.tools = [...DEFAULT_AGENT_COMPLETION_TOOLS];
	}

	return {
		id: createDefaultStepId(graphType, name, occurrence),
		name,
		enabled: meta?.enabledByDefault ?? false,
		config: Object.keys(config).length > 0 ? config : undefined,
	};
}

/** Resolve the ordered step names for a graph type, inserting feature steps. */
function resolveStepOrder(graphType: FlowGraphType): string[] {
	const slots = GRAPH_STEP_ORDER[graphType];

	const featureNames = getFeatureCatalogSteps()
		.filter((s) => !s.graphTypes || s.graphTypes.includes(graphType))
		.map((s) => s.name);

	const result: string[] = [];
	for (const slot of slots) {
		if (slot === FEATURE_SLOT) {
			result.push(...featureNames);
		} else {
			result.push(slot);
		}
	}

	return result;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build the canonical default UnifiedFlowConfig for a graph type.
 *
 * Only steps that are registered in the step registry are included —
 * steps present in the order table but not yet registered are skipped
 * gracefully (supports lazy loading / partial builds in tests).
 */
export function buildDefaultFlowConfig(graphType: string): UnifiedFlowConfig {
	const normalizedGraphType = normalizeFlowGraphType(graphType);
	const orderedNames = resolveStepOrder(normalizedGraphType);
	const stepCounts = new Map<string, number>();

	const steps: StepInstanceConfig[] = orderedNames
		.filter((name) => stepRegistry.hasStep(name))
		.map((name) => {
			const occurrence = (stepCounts.get(name) ?? 0) + 1;
			stepCounts.set(name, occurrence);
			return buildStepInstance(name, normalizedGraphType, occurrence);
		});

	return { graphType: normalizedGraphType, steps };
}

/**
 * Merge a persisted (potentially partial or stale) config onto the
 * canonical default for the given graph type.
 *
 * Matching strategy (in priority order):
 *   1. Match by id — exact instance match.
 *   2. Match by name, preserving relative occurrence order for duplicates.
 *
 * Steps present in the saved config but absent from the current catalog
 * are silently dropped — they no longer exist in the system.
 *
 * Steps present in the catalog but absent from the saved config are kept
 * with their defaults — this is the "no migration needed" guarantee.
 */
export function mergeWithDefaultConfig(
	saved: Partial<UnifiedFlowConfig>,
	graphType: string,
): UnifiedFlowConfig {
	const normalizedGraphType = normalizeFlowGraphType(
		typeof saved.graphType === "string" ? saved.graphType : graphType,
	);
	const base = buildDefaultFlowConfig(normalizedGraphType);
	const stepIndexesById = new Map(
		base.steps.map((step, index) => [step.id, index] as const),
	);
	const stepIndexesByName = new Map<string, number[]>();
	const matchedIndexes = new Set<number>();

	base.steps.forEach((step, index) => {
		const indexes = stepIndexesByName.get(step.name) ?? [];
		indexes.push(index);
		stepIndexesByName.set(step.name, indexes);
	});

	for (const savedStep of saved.steps ?? []) {
		const byIdIndex =
			typeof savedStep.id === "string"
				? stepIndexesById.get(savedStep.id)
				: undefined;
		if (byIdIndex !== undefined && !matchedIndexes.has(byIdIndex)) {
			Object.assign(base.steps[byIdIndex], savedStep);
			matchedIndexes.add(byIdIndex);
			continue;
		}

		const byNameIndexes = stepIndexesByName.get(savedStep.name) ?? [];
		const nextIndex = byNameIndexes.find((index) => !matchedIndexes.has(index));
		if (nextIndex !== undefined) {
			Object.assign(base.steps[nextIndex], savedStep);
			matchedIndexes.add(nextIndex);
		}
	}

	return { graphType: normalizedGraphType, steps: base.steps };
}

/**
 * Convert an old-format KnowledgeRAGPredefinedConfig (pre-refactor) to
 * UnifiedFlowConfig.  Called by the service layer when it detects a stored
 * config that pre-dates this architecture.
 *
 * Keeping this here (close to buildDefaultFlowConfig) makes it easy to
 * update if the old format ever changes — and easy to delete once all
 * stored configs have been migrated.
 */
export function convertLegacyKnowledgeRAGConfig(old: {
	systemPrompt?: string;
	contextPrompt?: string;
	tools?: string[];
	enableContextRetrieval?: boolean;
	enableCitations?: boolean;
	featureFlags?: Record<string, boolean>;
	graphType?: string;
}): UnifiedFlowConfig {
	const graphType = normalizeFlowGraphType(old.graphType);
	const base = buildDefaultFlowConfig(graphType);

	const setEnabled = (name: string, enabled: boolean) => {
		const step = base.steps.find((s) => s.name === name);
		if (step) step.enabled = enabled;
	};

	const setConfig = (name: string, patch: Record<string, unknown>) => {
		const step = base.steps.find((s) => s.name === name);
		if (step) step.config = { ...(step.config ?? {}), ...patch };
	};

	// Map old top-level flags → step enabled state
	setEnabled("context-smart-retrieve", old.enableContextRetrieval ?? true);
	setEnabled("entities-facts-citation", old.enableCitations ?? true);

	// Map old feature flags → step enabled state
	for (const [name, enabled] of Object.entries(old.featureFlags ?? {})) {
		setEnabled(name, enabled);
	}

	// Map old system prompt → add-system config
	if (old.systemPrompt !== undefined) {
		setConfig("add-system", {
			content: old.systemPrompt || DEFAULT_KNOWLEDGE_RAG_SYSTEM_PROMPT,
		});
	}

	// Map old tools → agent-completion config
	if (old.tools !== undefined) {
		setConfig("agent-completion", { tools: old.tools });
	}

	return base;
}
