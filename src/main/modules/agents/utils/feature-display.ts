import type { TFunction } from "i18next";
import type { AgentFeatureDefinition } from "@/main/stores/agent-config";

export const getAgentFeatureDisplayName = (
	feature: AgentFeatureDefinition,
	t: TFunction,
) => {
	if (feature.type === "config") {
		return t(feature.nameKey, { ns: "chat" });
	}

	return feature.nameKey
		? t(feature.nameKey, {
				ns: "common",
				defaultValue: feature.displayName,
			})
		: feature.displayName;
};

export const getAgentFeatureDescription = (
	feature: AgentFeatureDefinition,
	t: TFunction,
) => {
	if (feature.type === "config") {
		return t(feature.descKey, { ns: "chat" });
	}

	return feature.descriptionKey
		? t(feature.descriptionKey, {
				ns: "common",
				defaultValue: feature.description,
			})
		: feature.description;
};
