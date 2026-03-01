import { create } from "zustand";
import { serviceManager } from "@/services";
import { toolRegistry } from "@/services/flows/tool-registry";
import {
	DEFAULT_KNOWLEDGE_RAG_PREDEFINED_CONFIG,
	type KnowledgeRAGPredefinedConfig,
} from "@/services/flows/graph/knowledge-rag/state";
import { DEFAULT_CONTEXT_SYSTEM_PROMPT } from "@/services/flows/steps/knowledge-retrieval/context-to-system";
import { logError } from "@/utils/logger";
import type { FeatureCatalogMetadata } from "@/services/flows/flow-builder-catalog";

// ---------------------------------------------------------------------------
// Feature definition types
// ---------------------------------------------------------------------------

/**
 * A 'config' feature maps to a boolean field in KnowledgeRAGPredefinedConfig.
 * Its enabled state lives in draftConfig, NOT in draftFeatures.
 * nameKey / descKey are i18n keys resolved by the UI layer.
 */
export interface ConfigFeatureDefinition {
	type: "config";
	/** Stable unique id. */
	name: string;
	/** i18n key for the display name. */
	nameKey: string;
	/** i18n key for the description. */
	descKey: string;
	/** The KnowledgeRAGPredefinedConfig boolean field this feature maps to. */
	configKey: "enableContextRetrieval" | "enableCitations";
	/**
	 * If present, this feature exposes an additional configurable prompt field
	 * whose value also lives in draftConfig.
	 */
	promptField?: {
		field: "contextPrompt";
		labelKey: string;
		hintKey: string;
		defaultValue: string;
	};
	tools: string[];
	systemPrompt: string;
}

/**
 * A 'catalog' feature is a registered flow step.
 * Its enabled state lives in draftFeatures keyed by `name`.
 */
export interface CatalogFeatureDefinition {
	type: "catalog";
	/** Step name — also used as the draftFeatures key. */
	name: string;
	description: string;
	tools: string[];
	systemPrompt: string;
	customizable: boolean;
}

export type AgentFeatureDefinition =
	| ConfigFeatureDefinition
	| CatalogFeatureDefinition;

// ---------------------------------------------------------------------------
// Per-graph built-in feature registry
// Each graph type declares its built-in config features in order.
// "agent" has no built-in config features — just a customisable tools list.
// ---------------------------------------------------------------------------
const GRAPH_BUILTIN_FEATURES: Record<string, ConfigFeatureDefinition[]> = {
	"knowledge-rag": [
		{
			type: "config",
			name: "rag-knowledge",
			nameKey: "agentSettings.contextRetrieval",
			descKey: "agentSettings.contextRetrievalDesc",
			configKey: "enableContextRetrieval",
			promptField: {
				field: "contextPrompt",
				labelKey: "agentSettings.contextPrompt",
				hintKey: "agentSettings.contextPromptHint",
				defaultValue: DEFAULT_CONTEXT_SYSTEM_PROMPT,
			},
			tools: [],
			systemPrompt: "",
		},
		{
			type: "config",
			name: "citations",
			nameKey: "agentSettings.citations",
			descKey: "agentSettings.citationsDesc",
			configKey: "enableCitations",
			tools: [],
			systemPrompt: "",
		},
	],
	// Pure agent: no RAG / citation config features — tools are configured directly.
	agent: [],
};

// ---------------------------------------------------------------------------
// Helper: build featureDefinitions for a given graphType
// ---------------------------------------------------------------------------
function buildFeatureDefinitions(graphType: string): AgentFeatureDefinition[] {
	const builtinFeatures: ConfigFeatureDefinition[] =
		GRAPH_BUILTIN_FEATURES[graphType] ?? [];

	const catalog = serviceManager.flowBuilderService.getCatalog();
	const catalogFeatures: CatalogFeatureDefinition[] = catalog.steps
		.filter(
			(step) =>
				step.type === "feature" &&
				(step.graphTypes?.includes(graphType) ?? false),
		)
		.map((step) => {
			const meta = step.metadata as Partial<FeatureCatalogMetadata>;
			return {
				type: "catalog" as const,
				name: step.name,
				description: meta.description ?? step.name,
				tools: Array.isArray(meta.tools) ? meta.tools.map(String) : [],
				systemPrompt:
					typeof meta.systemPrompt === "string" ? meta.systemPrompt : "",
				customizable: Boolean(meta.customizable),
			};
		});

	return [...builtinFeatures, ...catalogFeatures];
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

type FeatureFlags = Record<string, boolean>;

const createDefaultFeatureFlags = (names: string[]): FeatureFlags =>
	Object.fromEntries(names.map((n) => [n, false])) as FeatureFlags;

interface AgentConfigState {
	savedConfig: KnowledgeRAGPredefinedConfig;
	draftConfig: KnowledgeRAGPredefinedConfig;
	savedFeatures: FeatureFlags;
	draftFeatures: FeatureFlags;
	/**
	 * Ordered list of ALL features for the current graph type.
	 * Config features come first (built-in), then catalog features.
	 * This is the single source of truth for the features UI.
	 */
	featureDefinitions: AgentFeatureDefinition[];
	availableTools: string[];
	currentFlowId: string | null;
	currentGraphType: "knowledge-rag" | "agent";

	isOpen: boolean;
	isLoading: boolean;
	isSaving: boolean;
	isDirty: boolean;
	error: string | null;

	open: (flowId?: string | null) => void;
	close: () => void;
	initialize: (flowId?: string | null) => Promise<void>;
	updateField: <K extends keyof KnowledgeRAGPredefinedConfig>(
		field: K,
		value: KnowledgeRAGPredefinedConfig[K],
	) => void;
	/** Switch base graph type and rebuild feature definitions accordingly. */
	setGraphType: (graphType: "knowledge-rag" | "agent") => void;
	toggleFeature: (featureName: string) => void;
	toggleTool: (toolName: string) => void;
	save: () => Promise<void>;
	revert: () => void;
	resetToDefaults: () => void;
}

const computeDirty = (
	saved: KnowledgeRAGPredefinedConfig,
	draft: KnowledgeRAGPredefinedConfig,
	savedFeatures: FeatureFlags,
	draftFeatures: FeatureFlags,
): boolean =>
	JSON.stringify(saved) !== JSON.stringify(draft) ||
	JSON.stringify(savedFeatures) !== JSON.stringify(draftFeatures);

export const useAgentConfigStore = create<AgentConfigState>((set, get) => ({
	savedConfig: { ...DEFAULT_KNOWLEDGE_RAG_PREDEFINED_CONFIG },
	draftConfig: { ...DEFAULT_KNOWLEDGE_RAG_PREDEFINED_CONFIG },
	savedFeatures: {},
	draftFeatures: {},
	featureDefinitions: [],
	availableTools: [],
	currentFlowId: null,
	currentGraphType: "knowledge-rag",

	isOpen: false,
	isLoading: false,
	isSaving: false,
	isDirty: false,
	error: null,

	open: (flowId) => {
		const state = get();
		if (!state.isOpen) {
			set({ isOpen: true });
			if (!state.isLoading) {
				state.initialize(flowId ?? state.currentFlowId);
			}
		} else if (flowId && flowId !== state.currentFlowId && !state.isLoading) {
			state.initialize(flowId);
		}
	},

	close: () => set({ isOpen: false }),

	initialize: async (flowId) => {
		set({ isLoading: true, error: null });
		try {
			const targetFlowId = flowId ?? get().currentFlowId;

			// Load saved config for this flow
			const config = (
				targetFlowId
					? await serviceManager.flowBuilderService.getFlowConfig({
							flowId: targetFlowId,
						})
					: await serviceManager.flowBuilderService.getFlowConfig({
							predefinedFlow: "knowledge-rag",
						})
			) as KnowledgeRAGPredefinedConfig;

			// Derive graph type from stored config (falls back to "knowledge-rag")
			const graphType: "knowledge-rag" | "agent" =
				config.graphType === "agent" ? "agent" : "knowledge-rag";

			const featureDefinitions = buildFeatureDefinitions(graphType);

			// Feature flags only track catalog features (config features use draftConfig)
			const catalogFeatures = featureDefinitions.filter(
				(f) => f.type === "catalog",
			);
			const defaultFeatures = createDefaultFeatureFlags(
				catalogFeatures.map((f) => f.name),
			);
			const featureFlags = targetFlowId
				? await serviceManager.flowBuilderService.getFlowFeatureFlags({
						flowId: targetFlowId,
					})
				: await serviceManager.flowBuilderService.getFlowFeatureFlags({
						predefinedFlow: "knowledge-rag",
					});

			const available = toolRegistry.getRegisteredToolNames();

			set({
				savedConfig: config,
				draftConfig: { ...config },
				savedFeatures: { ...defaultFeatures, ...featureFlags },
				draftFeatures: { ...defaultFeatures, ...featureFlags },
				featureDefinitions,
				availableTools: available,
				currentFlowId: targetFlowId ?? null,
				currentGraphType: graphType,
				isDirty: false,
				isLoading: false,
			});
		} catch (err) {
			logError("[AgentConfigStore] Failed to initialize:", err);
			set({
				error: err instanceof Error ? err.message : "Failed to load config",
				isLoading: false,
			});
		}
	},

	updateField: (field, value) => {
		const draft = { ...get().draftConfig, [field]: value };
		set({
			draftConfig: draft,
			isDirty: computeDirty(
				get().savedConfig,
				draft,
				get().savedFeatures,
				get().draftFeatures,
			),
		});
	},

	setGraphType: (graphType) => {
		const featureDefinitions = buildFeatureDefinitions(graphType);

		// Rebuild feature flags for catalog features of the new graph type
		const catalogFeatures = featureDefinitions.filter(
			(f) => f.type === "catalog",
		);
		const defaultFeatures = createDefaultFeatureFlags(
			catalogFeatures.map((f) => f.name),
		);

		const draft = { ...get().draftConfig, graphType };
		set({
			draftConfig: draft,
			draftFeatures: defaultFeatures,
			featureDefinitions,
			currentGraphType: graphType,
			isDirty: computeDirty(
				get().savedConfig,
				draft,
				get().savedFeatures,
				defaultFeatures,
			),
		});
	},

	toggleFeature: (featureName) => {
		const next = {
			...get().draftFeatures,
			[featureName]: !get().draftFeatures[featureName],
		};
		set({
			draftFeatures: next,
			isDirty: computeDirty(
				get().savedConfig,
				get().draftConfig,
				get().savedFeatures,
				next,
			),
		});
	},

	toggleTool: (toolName) => {
		const current = get().draftConfig.tools;
		const next = current.includes(toolName)
			? current.filter((t) => t !== toolName)
			: [...current, toolName];
		const draft = { ...get().draftConfig, tools: next };
		set({
			draftConfig: draft,
			isDirty: computeDirty(
				get().savedConfig,
				draft,
				get().savedFeatures,
				get().draftFeatures,
			),
		});
	},

	save: async () => {
		set({ isSaving: true, error: null });
		try {
			const { draftConfig, draftFeatures } = get();
			const targetFlowId = get().currentFlowId;
			if (targetFlowId) {
				await serviceManager.flowBuilderService.saveFlowConfig(
					{ flowId: targetFlowId },
					draftConfig,
				);
				await serviceManager.flowBuilderService.saveFlowFeatureFlags(
					{ flowId: targetFlowId },
					draftFeatures,
				);
			} else {
				await serviceManager.flowBuilderService.saveFlowConfig(
					{ predefinedFlow: "knowledge-rag" },
					draftConfig,
				);
				await serviceManager.flowBuilderService.saveFlowFeatureFlags(
					{ predefinedFlow: "knowledge-rag" },
					draftFeatures,
				);
			}
			set({
				savedConfig: { ...draftConfig },
				savedFeatures: { ...draftFeatures },
				isDirty: false,
				isSaving: false,
			});
		} catch (err) {
			logError("[AgentConfigStore] Failed to save:", err);
			set({
				error: err instanceof Error ? err.message : "Failed to save config",
				isSaving: false,
			});
		}
	},

	revert: () => {
		const savedConfig = get().savedConfig;
		const graphType: "knowledge-rag" | "agent" =
			savedConfig.graphType === "agent" ? "agent" : "knowledge-rag";
		const featureDefinitions = buildFeatureDefinitions(graphType);
		set({
			draftConfig: { ...savedConfig },
			draftFeatures: { ...get().savedFeatures },
			featureDefinitions,
			currentGraphType: graphType,
			isDirty: false,
		});
	},

	resetToDefaults: () => {
		const draft = { ...DEFAULT_KNOWLEDGE_RAG_PREDEFINED_CONFIG };
		const featureDefinitions = buildFeatureDefinitions("knowledge-rag");
		const catalogNames = featureDefinitions
			.filter((f) => f.type === "catalog")
			.map((f) => f.name);
		const featureFlags = createDefaultFeatureFlags(catalogNames);
		set({
			draftConfig: draft,
			draftFeatures: featureFlags,
			featureDefinitions,
			currentGraphType: "knowledge-rag",
			isDirty: computeDirty(
				get().savedConfig,
				draft,
				get().savedFeatures,
				featureFlags,
			),
		});
	},
}));
