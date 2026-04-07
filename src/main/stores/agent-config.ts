import { create } from "zustand";
import { serviceManager } from "@/services";
import { toolRegistry } from "@/services/flows/tool-registry";
import { buildDefaultFlowConfig } from "@/services/flows/build-flow-config";
import {
	DEFAULT_KNOWLEDGE_RAG_PREDEFINED_CONFIG,
	type KnowledgeRAGPredefinedConfig,
} from "@/services/flows/graph/knowledge-rag/state";
import { DEFAULT_AGENT_SYSTEM_PROMPT } from "@/services/flows/graph/agent/state";
import { DEFAULT_KNOWLEDGE_RAG_SYSTEM_PROMPT } from "@/services/flows/graph/knowledge-rag/state";
import type { UnifiedFlowConfig } from "@/services/flows/interfaces/flow-config";
import { DEFAULT_CONTEXT_SYSTEM_PROMPT } from "@/services/flows/steps/knowledge-retrieval/context-to-system";
import { logError } from "@/utils/logger";
import type { FeatureCatalogMetadata } from "@/services/flows/flow-builder-catalog";

// ---------------------------------------------------------------------------
// Feature definition types
// ---------------------------------------------------------------------------

/**
 * A built-in config feature maps to a field in KnowledgeRAGPredefinedConfig.
 *
 * configKey "enableContextRetrieval" | "enableCitations" → boolean toggle.
 *   May expose a secondary promptField config.
 *
 * configKey "tools" → the agent-node feature.
 *   No boolean toggle; renders the tool list.
 *   toolScope "unclaimed" = tools not owned by any catalog feature step.
 *   toolScope "all"       = all registered tools.
 */
export interface ConfigFeatureDefinition {
	type: "config";
	name: string;
	nameKey: string;
	descKey: string;
	configKey: "enableContextRetrieval" | "enableCitations" | "tools";
	promptField?: {
		field: "contextPrompt";
		labelKey: string;
		hintKey: string;
		defaultValue: string;
	};
	toolScope?: "all" | "unclaimed";
	tools: string[];
	systemPrompt: string;
}

/** A catalog feature step. Toggle state lives in draftFeatures[name]. */
export interface CatalogFeatureDefinition {
	type: "catalog";
	name: string;
	/** Human-readable display name (English fallback). */
	displayName: string;
	/** i18n key for the display name. */
	nameKey?: string;
	description: string;
	/** i18n key for the description. */
	descriptionKey?: string;
	tools: string[];
	systemPrompt: string;
	customizable: boolean;
}

export type AgentFeatureDefinition =
	| ConfigFeatureDefinition
	| CatalogFeatureDefinition;

// ---------------------------------------------------------------------------
// Graph registry — exported so the component can render the selector without
// hardcoding graph ids.  Add entries here when new graph types arrive.
// ---------------------------------------------------------------------------
export const GRAPH_REGISTRY = [
	{
		id: "knowledge-rag" as const,
		nameKey: "agentSettings.graphAgent",
		descKey: "agentSettings.graphAgentDesc",
	},
	{
		id: "agent" as const,
		nameKey: "agentSettings.graphSimpleAgent",
		descKey: "agentSettings.graphSimpleAgentDesc",
	},
] as const;

export type GraphType = (typeof GRAPH_REGISTRY)[number]["id"];

export const getDefaultSystemPromptForGraph = (graphType: GraphType): string =>
	graphType === "agent"
		? DEFAULT_AGENT_SYSTEM_PROMPT
		: DEFAULT_KNOWLEDGE_RAG_SYSTEM_PROMPT;

const RETRIEVAL_STEP_NAMES = new Set([
	"context-smart-retrieve",
	"context-quick-retrieve",
	"context-llm-retrieve",
]);

const cloneUnifiedConfig = (config: UnifiedFlowConfig): UnifiedFlowConfig => ({
	...config,
	steps: config.steps.map((step) => ({
		...step,
		config: step.config ? { ...step.config } : undefined,
	})),
});

// ---------------------------------------------------------------------------
// Per-graph built-in feature definitions.
// The last entry with configKey "tools" is the agent-node feature and will
// be placed after catalog features in buildFeatureDefinitions.
// ---------------------------------------------------------------------------
type GraphBuiltinConfig = {
	configFeatures: ConfigFeatureDefinition[];
};

const GRAPH_BUILTIN_CONFIGS: Record<string, GraphBuiltinConfig> = {
	"knowledge-rag": {
		configFeatures: [
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
			{
				type: "config",
				name: "agent-node",
				nameKey: "agentSettings.agentNode",
				descKey: "agentSettings.agentNodeDesc",
				configKey: "tools",
				toolScope: "unclaimed",
				tools: [],
				systemPrompt: "",
			},
		],
	},
	agent: {
		configFeatures: [
			{
				type: "config",
				name: "agent-node",
				nameKey: "agentSettings.agentNode",
				descKey: "agentSettings.agentNodeDesc",
				configKey: "tools",
				toolScope: "all",
				tools: [],
				systemPrompt: "",
			},
		],
	},
};

// ---------------------------------------------------------------------------
// Build the full ordered featureDefinitions for a graph type:
//   non-tools configFeatures → catalog steps → tools configFeature (agent-node)
// ---------------------------------------------------------------------------
function buildFeatureDefinitions(graphType: string): AgentFeatureDefinition[] {
	const { configFeatures } = GRAPH_BUILTIN_CONFIGS[graphType] ?? {
		configFeatures: [
			{
				type: "config" as const,
				name: "agent-node",
				nameKey: "agentSettings.agentNode",
				descKey: "agentSettings.agentNodeDesc",
				configKey: "tools" as const,
				toolScope: "all" as const,
				tools: [],
				systemPrompt: "",
			},
		],
	};

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
				displayName:
					typeof meta.displayName === "string" ? meta.displayName : step.name,
				nameKey: typeof meta.nameKey === "string" ? meta.nameKey : undefined,
				description: meta.description ?? step.name,
				descriptionKey:
					typeof meta.descriptionKey === "string"
						? meta.descriptionKey
						: undefined,
				tools: Array.isArray(meta.tools) ? meta.tools.map(String) : [],
				systemPrompt:
					typeof meta.systemPrompt === "string" ? meta.systemPrompt : "",
				customizable: Boolean(meta.customizable),
			};
		});

	// agent-node (configKey "tools") always renders last, after catalog features
	const toolsFeature = configFeatures.find((f) => f.configKey === "tools");
	const otherConfigFeatures = configFeatures.filter(
		(f) => f.configKey !== "tools",
	);

	return [
		...otherConfigFeatures,
		...catalogFeatures,
		...(toolsFeature ? [toolsFeature] : []),
	];
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

type FeatureFlags = Record<string, boolean>;

const createDefaultFeatureFlags = (names: string[]): FeatureFlags =>
	Object.fromEntries(names.map((n) => [n, false])) as FeatureFlags;

const getCatalogFeatureNames = (
	featureDefinitions: AgentFeatureDefinition[],
): string[] =>
	featureDefinitions.filter((f) => f.type === "catalog").map((f) => f.name);

const deriveLegacyStateFromUnified = (unifiedConfig: UnifiedFlowConfig) => {
	const graphType: GraphType =
		unifiedConfig.graphType === "agent" ? "agent" : "knowledge-rag";
	const featureDefinitions = buildFeatureDefinitions(graphType);
	const catalogNames = getCatalogFeatureNames(featureDefinitions);
	const features = createDefaultFeatureFlags(catalogNames);
	const defaultUnifiedConfig = buildDefaultFlowConfig(graphType);
	const defaultSystemPrompt =
		(defaultUnifiedConfig.steps.find((step) => step.name === "add-system")
			?.config?.content as string | undefined) ?? "";
	const addSystemStep = unifiedConfig.steps.find(
		(step) => step.name === "add-system",
	);
	const agentCompletionStep = unifiedConfig.steps.find(
		(step) => step.name === "agent-completion",
	);
	const citationStep = unifiedConfig.steps.find(
		(step) => step.name === "entities-facts-citation",
	);
	const retrievalSteps = unifiedConfig.steps.filter((step) =>
		RETRIEVAL_STEP_NAMES.has(step.name),
	);
	const retrievalPrompt = retrievalSteps.find(
		(step) => typeof step.config?.prompt === "string",
	)?.config?.prompt;

	for (const featureName of catalogNames) {
		features[featureName] = Boolean(
			unifiedConfig.steps.find((step) => step.name === featureName)?.enabled,
		);
	}

	return {
		graphType,
		featureDefinitions,
		config: {
			...DEFAULT_KNOWLEDGE_RAG_PREDEFINED_CONFIG,
			graphType,
			systemPrompt:
				typeof addSystemStep?.config?.content === "string" &&
				addSystemStep.config.content !== defaultSystemPrompt
					? addSystemStep.config.content
					: "",
			contextPrompt:
				typeof retrievalPrompt === "string" &&
				retrievalPrompt !== DEFAULT_CONTEXT_SYSTEM_PROMPT
					? retrievalPrompt
					: "",
			tools: Array.isArray(agentCompletionStep?.config?.tools)
				? agentCompletionStep.config.tools.map(String)
				: [],
			enableContextRetrieval: retrievalSteps.some((step) => step.enabled),
			enableCitations:
				typeof citationStep?.enabled === "boolean"
					? citationStep.enabled
					: DEFAULT_KNOWLEDGE_RAG_PREDEFINED_CONFIG.enableCitations,
		} satisfies KnowledgeRAGPredefinedConfig,
		features,
	};
};

const applyLegacyDraftToUnified = (
	baseConfig: UnifiedFlowConfig,
	draftConfig: KnowledgeRAGPredefinedConfig,
	draftFeatures: FeatureFlags,
): UnifiedFlowConfig => {
	const graphType: GraphType =
		draftConfig.graphType === "agent" ? "agent" : "knowledge-rag";
	const nextConfig =
		baseConfig.graphType === graphType
			? cloneUnifiedConfig(baseConfig)
			: buildDefaultFlowConfig(graphType);
	const defaultConfig = buildDefaultFlowConfig(graphType);
	const defaultSystemPrompt =
		(defaultConfig.steps.find((step) => step.name === "add-system")?.config
			?.content as string | undefined) ?? "";
	const defaultEnabledRetrievalNames = new Set(
		defaultConfig.steps
			.filter((step) => RETRIEVAL_STEP_NAMES.has(step.name) && step.enabled)
			.map((step) => step.name),
	);
	const enabledRetrievalNames = new Set(
		nextConfig.steps
			.filter((step) => RETRIEVAL_STEP_NAMES.has(step.name) && step.enabled)
			.map((step) => step.name),
	);
	const featureNames = new Set(
		getCatalogFeatureNames(buildFeatureDefinitions(graphType)),
	);

	if (draftConfig.enableContextRetrieval && enabledRetrievalNames.size === 0) {
		for (const stepName of defaultEnabledRetrievalNames) {
			enabledRetrievalNames.add(stepName);
		}
	}

	return {
		...nextConfig,
		graphType,
		steps: nextConfig.steps.map((step) => {
			const nextStep = {
				...step,
				config: step.config ? { ...step.config } : undefined,
			};

			if (step.name === "add-system") {
				nextStep.config = { ...(nextStep.config ?? {}) };
				nextStep.config.content =
					draftConfig.systemPrompt.trim() || defaultSystemPrompt;
			}

			if (step.name === "agent-completion") {
				nextStep.config = {
					...(nextStep.config ?? {}),
					tools: [...draftConfig.tools],
				};
			}

			if (RETRIEVAL_STEP_NAMES.has(step.name)) {
				nextStep.enabled =
					draftConfig.enableContextRetrieval &&
					enabledRetrievalNames.has(step.name);
				nextStep.config = { ...(nextStep.config ?? {}) };
				if (draftConfig.contextPrompt.trim()) {
					nextStep.config.prompt = draftConfig.contextPrompt;
				} else if ("prompt" in nextStep.config) {
					delete nextStep.config.prompt;
				}
			}

			if (step.name === "entities-facts-citation") {
				nextStep.enabled = draftConfig.enableCitations;
			}

			if (featureNames.has(step.name)) {
				nextStep.enabled = Boolean(draftFeatures[step.name]);
			}

			if (nextStep.config && Object.keys(nextStep.config).length === 0) {
				nextStep.config = undefined;
			}

			return nextStep;
		}),
	};
};

interface AgentConfigState {
	savedConfig: KnowledgeRAGPredefinedConfig;
	draftConfig: KnowledgeRAGPredefinedConfig;
	savedUnifiedConfig: UnifiedFlowConfig | null;
	savedFeatures: FeatureFlags;
	draftFeatures: FeatureFlags;
	/** All features for the current graph. Single source of truth for the UI. */
	featureDefinitions: AgentFeatureDefinition[];
	availableTools: string[];
	currentFlowId: string | null;
	currentGraphType: GraphType;
	isLegacyConfig: boolean;

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
	setGraphType: (graphType: GraphType) => void;
	toggleFeature: (featureName: string) => void;
	toggleTool: (toolName: string) => void;
	save: () => Promise<void>;
	convertToUnified: () => Promise<void>;
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

export const useAgentConfigStore = create<AgentConfigState>((set, get) => {
	const persistUnifiedConfig = async () => {
		set({ isSaving: true, error: null });
		try {
			const { draftConfig, draftFeatures, savedUnifiedConfig } = get();
			const targetFlowId = get().currentFlowId;
			const baseConfig =
				savedUnifiedConfig &&
				(savedUnifiedConfig.graphType === draftConfig.graphType ||
					(savedUnifiedConfig.graphType !== "agent" &&
						draftConfig.graphType === "knowledge-rag"))
					? savedUnifiedConfig
					: buildDefaultFlowConfig(draftConfig.graphType);
			const unifiedConfig = applyLegacyDraftToUnified(
				baseConfig,
				draftConfig,
				draftFeatures,
			);

			if (targetFlowId) {
				await serviceManager.flowBuilderService.saveUnifiedFlowConfig(
					{ flowId: targetFlowId },
					unifiedConfig,
				);
			} else {
				await serviceManager.flowBuilderService.saveUnifiedFlowConfig(
					{ predefinedFlow: "knowledge-rag" },
					unifiedConfig,
				);
			}

			set({
				savedConfig: { ...draftConfig },
				savedUnifiedConfig: unifiedConfig,
				savedFeatures: { ...draftFeatures },
				isDirty: false,
				isSaving: false,
				isLegacyConfig: false,
			});
		} catch (err) {
			logError("[AgentConfigStore] Failed to save unified config:", err);
			set({
				error:
					err instanceof Error ? err.message : "Failed to save unified config",
				isSaving: false,
			});
		}
	};

	return {
		savedConfig: { ...DEFAULT_KNOWLEDGE_RAG_PREDEFINED_CONFIG },
		draftConfig: { ...DEFAULT_KNOWLEDGE_RAG_PREDEFINED_CONFIG },
		savedUnifiedConfig: null,
		savedFeatures: {},
		draftFeatures: {},
		featureDefinitions: [],
		availableTools: [],
		currentFlowId: null,
		currentGraphType: "knowledge-rag",
		isLegacyConfig: false,

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
				const flowRef = targetFlowId
					? { flowId: targetFlowId }
					: { predefinedFlow: "knowledge-rag" as const };
				const storageFormat =
					await serviceManager.flowBuilderService.getFlowConfigStorageFormat(
						flowRef,
					);

				if (storageFormat === "legacy") {
					const config = targetFlowId
						? ((await serviceManager.flowBuilderService.getFlowConfig({
								flowId: targetFlowId,
							})) as KnowledgeRAGPredefinedConfig)
						: await serviceManager.flowBuilderService.getFlowConfig({
								predefinedFlow: "knowledge-rag",
							});
					const graphType: GraphType =
						config.graphType === "agent" ? "agent" : "knowledge-rag";
					const featureDefinitions = buildFeatureDefinitions(graphType);
					const defaultFeatures = createDefaultFeatureFlags(
						getCatalogFeatureNames(featureDefinitions),
					);
					const featureFlags =
						await serviceManager.flowBuilderService.getFlowFeatureFlags(
							flowRef,
						);

					set({
						savedConfig: config,
						draftConfig: { ...config },
						savedUnifiedConfig: null,
						savedFeatures: { ...defaultFeatures, ...featureFlags },
						draftFeatures: { ...defaultFeatures, ...featureFlags },
						featureDefinitions,
						availableTools: toolRegistry.getRegisteredToolNames(),
						currentFlowId: targetFlowId ?? null,
						currentGraphType: graphType,
						isDirty: false,
						isLoading: false,
						isLegacyConfig: true,
					});
					return;
				}

				const unifiedConfig =
					await serviceManager.flowBuilderService.getUnifiedFlowConfig(flowRef);
				const derivedState = deriveLegacyStateFromUnified(unifiedConfig);

				set({
					savedConfig: derivedState.config,
					draftConfig: { ...derivedState.config },
					savedUnifiedConfig: unifiedConfig,
					savedFeatures: { ...derivedState.features },
					draftFeatures: { ...derivedState.features },
					featureDefinitions: derivedState.featureDefinitions,
					availableTools: toolRegistry.getRegisteredToolNames(),
					currentFlowId: targetFlowId ?? null,
					currentGraphType: derivedState.graphType,
					isDirty: false,
					isLoading: false,
					isLegacyConfig: false,
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
			const catalogNames = featureDefinitions
				.filter((f) => f.type === "catalog")
				.map((f) => f.name);
			const defaultFeatures = createDefaultFeatureFlags(catalogNames);
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
			if (get().isLegacyConfig) {
				set({
					error: "Legacy config must be converted before saving.",
				});
				return;
			}

			await persistUnifiedConfig();
		},

		convertToUnified: async () => {
			await persistUnifiedConfig();
		},

		revert: () => {
			const savedConfig = get().savedConfig;
			const graphType: GraphType =
				savedConfig.graphType === "agent" ? "agent" : "knowledge-rag";
			set({
				draftConfig: { ...savedConfig },
				draftFeatures: { ...get().savedFeatures },
				featureDefinitions: buildFeatureDefinitions(graphType),
				currentGraphType: graphType,
				isDirty: false,
			});
		},

		resetToDefaults: () => {
			const defaultUnifiedConfig = buildDefaultFlowConfig("knowledge-rag");
			const derivedState = deriveLegacyStateFromUnified(defaultUnifiedConfig);
			set({
				draftConfig: derivedState.config,
				draftFeatures: derivedState.features,
				featureDefinitions: derivedState.featureDefinitions,
				currentGraphType: derivedState.graphType,
				isDirty: computeDirty(
					get().savedConfig,
					derivedState.config,
					get().savedFeatures,
					derivedState.features,
				),
			});
		},
	};
});
