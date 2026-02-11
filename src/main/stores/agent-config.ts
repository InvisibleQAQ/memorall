import { create } from "zustand";
import { serviceManager } from "@/services";
import { toolRegistry } from "@/services/flows/tool-registry";
import {
	DEFAULT_KNOWLEDGE_RAG_PREDEFINED_CONFIG,
	type KnowledgeRAGPredefinedConfig,
} from "@/services/flows/graph/knowledge-rag/state";
import { logError } from "@/utils/logger";
import type { FeatureCatalogMetadata } from "@/services/flows/flow-builder-catalog";

export interface AgentFeatureDefinition {
	name: string;
	description: string;
	tools: string[];
	systemPrompt: string;
	customizable: boolean;
}

type FeatureFlags = Record<string, boolean>;

const createDefaultFeatureFlags = (featureNames: string[]): FeatureFlags =>
	Object.fromEntries(featureNames.map((feature) => [feature, false])) as FeatureFlags;

interface AgentConfigState {
	savedConfig: KnowledgeRAGPredefinedConfig;
	draftConfig: KnowledgeRAGPredefinedConfig;
	savedFeatures: FeatureFlags;
	draftFeatures: FeatureFlags;
	featureDefinitions: AgentFeatureDefinition[];
	availableTools: string[];
	currentFlowId: string | null;

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
			const config = (
				targetFlowId
					? await serviceManager.flowBuilderService.getFlowConfig({
							flowId: targetFlowId,
						})
					: await serviceManager.flowBuilderService.getFlowConfig({
							predefinedFlow: "knowledge-rag",
						})
			) as KnowledgeRAGPredefinedConfig;
			const catalog = serviceManager.flowBuilderService.getCatalog();
			const featureDefinitions: AgentFeatureDefinition[] = catalog.steps
				.filter((step) => step.type === "feature")
				.map((step) => {
					const meta = step.metadata as Partial<FeatureCatalogMetadata>;
					return {
						name: step.name,
						description: meta.description ?? step.name,
						tools: Array.isArray(meta.tools)
							? meta.tools.map(String)
							: [],
						systemPrompt:
							typeof meta.systemPrompt === "string" ? meta.systemPrompt : "",
						customizable: Boolean(meta.customizable),
					};
				});
			const defaultFeatures = createDefaultFeatureFlags(
				featureDefinitions.map((feature) => feature.name),
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
		const saved = get().savedConfig;
		const savedFeatures = get().savedFeatures;
		set({
			draftConfig: { ...saved },
			draftFeatures: { ...savedFeatures },
			isDirty: false,
		});
	},

	resetToDefaults: () => {
		const draft = { ...DEFAULT_KNOWLEDGE_RAG_PREDEFINED_CONFIG };
		const featureFlags = createDefaultFeatureFlags(
			get().featureDefinitions.map((feature) => feature.name),
		);
		set({
			draftConfig: draft,
			draftFeatures: featureFlags,
			isDirty: computeDirty(
				get().savedConfig,
				draft,
				get().savedFeatures,
				featureFlags,
			),
		});
	},
}));
