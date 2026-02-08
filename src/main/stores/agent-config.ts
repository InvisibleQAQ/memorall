import { create } from "zustand";
import { serviceManager } from "@/services";
import { toolRegistry } from "@/services/flows/tool-registry";
import {
	DEFAULT_KNOWLEDGE_RAG_PREDEFINED_CONFIG,
	type KnowledgeRAGPredefinedConfig,
} from "@/services/flows/graph/knowledge-rag/state";
import { logError } from "@/utils/logger";

interface AgentConfigState {
	savedConfig: KnowledgeRAGPredefinedConfig;
	draftConfig: KnowledgeRAGPredefinedConfig;
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
	toggleTool: (toolName: string) => void;
	save: () => Promise<void>;
	revert: () => void;
	resetToDefaults: () => void;
}

const computeDirty = (
	saved: KnowledgeRAGPredefinedConfig,
	draft: KnowledgeRAGPredefinedConfig,
): boolean => JSON.stringify(saved) !== JSON.stringify(draft);

export const useAgentConfigStore = create<AgentConfigState>((set, get) => ({
	savedConfig: { ...DEFAULT_KNOWLEDGE_RAG_PREDEFINED_CONFIG },
	draftConfig: { ...DEFAULT_KNOWLEDGE_RAG_PREDEFINED_CONFIG },
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
			const available = toolRegistry.getRegisteredToolNames();
			set({
				savedConfig: config,
				draftConfig: { ...config },
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
			isDirty: computeDirty(get().savedConfig, draft),
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
			isDirty: computeDirty(get().savedConfig, draft),
		});
	},

	save: async () => {
		set({ isSaving: true, error: null });
		try {
			const { draftConfig } = get();
			const targetFlowId = get().currentFlowId;
			if (targetFlowId) {
				await serviceManager.flowBuilderService.saveFlowConfig(
					{ flowId: targetFlowId },
					draftConfig,
				);
			} else {
				await serviceManager.flowBuilderService.saveFlowConfig(
					{ predefinedFlow: "knowledge-rag" },
					draftConfig,
				);
			}
			set({
				savedConfig: { ...draftConfig },
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
		set({
			draftConfig: { ...saved },
			isDirty: false,
		});
	},

	resetToDefaults: () => {
		const draft = { ...DEFAULT_KNOWLEDGE_RAG_PREDEFINED_CONFIG };
		set({
			draftConfig: draft,
			isDirty: computeDirty(get().savedConfig, draft),
		});
	},
}));
