import type { GRAPH_REGISTRY } from "@/main/stores/agent-config";
import type { Topic } from "@/services/database/types";
import type { AgentConfigSummary, AgentPresetDraft } from "../../types";
import type { AgentCronJobDraft } from "../../hooks/use-agent-cron-jobs";

export interface AgentConfigFormActions {
	canSave: boolean;
	isBusy: boolean;
	hasUnsavedChanges: boolean;
	saveLabel?: string;
	canOptimize?: boolean;
	canDelete: boolean;
	isDeleting: boolean;
	onSave: () => void;
	onOptimize?: () => void;
	onRevert: () => void;
	onDelete: (options?: { deleteLinkedMemory: boolean }) => void;
	onResetConfig: () => void;
}

export interface AgentCronJobFormState {
	drafts: AgentCronJobDraft[];
	isLoading: boolean;
	isSaving: boolean;
	error: string | null;
	onAdd: (status: "active" | "paused" | "draft") => void;
	onUpdate: (id: string, updates: Partial<AgentCronJobDraft>) => void;
	onRemove: (id: string) => void;
}

export interface AgentConfigFormProps {
	className?: string;
	metadataDraft?: AgentPresetDraft;
	configSummary?: AgentConfigSummary | null;
	memoryTopic?: Topic | null;
	onMetadataChange?: <K extends keyof AgentPresetDraft>(
		field: K,
		value: AgentPresetDraft[K],
	) => void;
	formActions?: AgentConfigFormActions;
	cronJobs?: AgentCronJobFormState;
}

export type AgentMetadataChange = NonNullable<
	AgentConfigFormProps["onMetadataChange"]
>;

export type GraphMeta = (typeof GRAPH_REGISTRY)[number] | undefined;
