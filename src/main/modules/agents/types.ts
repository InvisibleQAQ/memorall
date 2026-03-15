import type { Flow } from "@/services/database/types";

export type AgentPresetStatus = "active" | "draft";

export interface AgentPresetDraft {
	name: string;
	description: string;
	status: AgentPresetStatus;
}

export interface AgentConfigSummary {
	graphLabel: string;
	enabledFeatureCount: number;
	enabledToolCount: number;
	systemPromptLength: number;
	contextPromptLength: number;
	hasCustomSystemPrompt: boolean;
	hasCustomContextPrompt: boolean;
	lastUpdatedAt: Date | null;
}

export const normalizeAgentPresetStatus = (
	status: Flow["status"] | null | undefined,
): AgentPresetStatus => (status === "active" ? "active" : "draft");

export const createAgentPresetDraft = (
	preset: Flow | null | undefined,
): AgentPresetDraft => ({
	name: preset?.name ?? "",
	description: preset?.description ?? "",
	status: normalizeAgentPresetStatus(preset?.status),
});

export const coerceDate = (
	value: Date | string | null | undefined,
): Date | null => {
	if (!value) {
		return null;
	}

	const date = value instanceof Date ? value : new Date(value);
	return Number.isNaN(date.getTime()) ? null : date;
};
