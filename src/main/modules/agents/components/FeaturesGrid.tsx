import React from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, Sparkles } from "lucide-react";
import { Button } from "@/main/components/ui/button";
import { Badge } from "@/main/components/ui/badge";
import { cn } from "@/lib/utils";
import type { FoundationPredefinedConfig } from "@/services/flows/graph/foundation/state";
import { MULTI_AGENT_FEATURE_NAME } from "@/services/flows/steps/features/multi-agent-feature";
import { MCP_FEATURE_NAME } from "@/services/flows/steps/features/mcp-feature";
import {
	useAgentConfigStore,
	type AgentFeatureDefinition,
} from "@/main/stores/agent-config";
import { HoverBadgeList } from "./AgentHoverInfo";
import { FeatureCard } from "./FeatureCard";
import {
	getAgentFeatureDescription,
	getAgentFeatureDisplayName,
} from "../utils/feature-display";
import { CursorPoint } from "@/components/AgentCursor";
import { AGENT_WIZARD_CURSOR_KEYS } from "@/main/modules/agent-wizard";
import type { AgentConfigSummary } from "../types";

const FEATURES_DEFAULT_VISIBLE = 4;
const BOTTOM_FEATURE_NAMES = new Set([
	"documents-feature",
	"documents-fs-feature",
]);
const TOP_OTHER_FEATURE_ORDER = ["hyperframes-feature"] as const;
const CORE_FEATURE_ORDER = [
	"knowledge-retrieval",
	"fs-feature",
	"nodejs-sandbox-feature",
	"web-feature",
	MULTI_AGENT_FEATURE_NAME,
	"agent-node",
	"artifact-feature",
	"citations",
	"visualize-response",
] as const;
const CORE_FEATURE_NAMES = new Set<string>(CORE_FEATURE_ORDER);
const CORE_FEATURE_RANK = new Map<string, number>(
	CORE_FEATURE_ORDER.map((name, index) => [name, index]),
);
const TOP_OTHER_FEATURE_RANK = new Map<string, number>(
	TOP_OTHER_FEATURE_ORDER.map((name, index) => [name, index]),
);

const getFeatureEnabled = (
	feature: ReturnType<
		typeof useAgentConfigStore.getState
	>["featureDefinitions"][number],
	draftConfig: ReturnType<typeof useAgentConfigStore.getState>["draftConfig"],
	draftFeatures: ReturnType<
		typeof useAgentConfigStore.getState
	>["draftFeatures"],
): boolean => {
	if (feature.type === "config") {
		if (feature.configKey === "tools") {
			return draftConfig.tools.length > 0;
		}

		return Boolean(
			draftConfig[feature.configKey as keyof FoundationPredefinedConfig],
		);
	}

	return Boolean(draftFeatures[feature.name]);
};

interface FeaturesGridProps {
	summary?: AgentConfigSummary | null;
}

export const FeaturesGrid: React.FC<FeaturesGridProps> = ({ summary }) => {
	const { t } = useTranslation(["chat", "agents"]);
	const ta = (key: string, opts?: Record<string, unknown>) =>
		t(key, { ns: "agents", ...opts });

	const {
		draftConfig,
		draftFeatures,
		draftMultiAgentAccessibleAgentIds,
		featureDefinitions,
		availableTools,
		updateField,
		toggleFeature,
	} = useAgentConfigStore();

	const [showAll, setShowAll] = React.useState(false);

	const claimedToolSet = React.useMemo(() => {
		const set = new Set<string>();
		for (const feature of featureDefinitions) {
			if (feature.type === "catalog") {
				for (const tool of feature.tools) {
					set.add(tool);
				}
			}
		}
		return set;
	}, [featureDefinitions]);

	const fallbackEnabledToolNames = React.useMemo(() => {
		const enabledToolSet = new Set(draftConfig.tools);
		for (const feature of featureDefinitions) {
			if (feature.type === "config") {
				if (feature.configKey === "tools" || !draftConfig[feature.configKey]) {
					continue;
				}
			} else if (!draftFeatures[feature.name]) {
				continue;
			} else if (
				feature.name === MULTI_AGENT_FEATURE_NAME &&
				draftMultiAgentAccessibleAgentIds.length === 0
			) {
				continue;
			}
			for (const tool of feature.tools) {
				enabledToolSet.add(tool);
			}
		}
		const availableToolSet = new Set(availableTools);
		return [
			...availableTools.filter((tool) => enabledToolSet.has(tool)),
			...Array.from(enabledToolSet).filter(
				(tool) => !availableToolSet.has(tool),
			),
		];
	}, [
		availableTools,
		draftConfig,
		draftFeatures,
		draftMultiAgentAccessibleAgentIds,
		featureDefinitions,
	]);

	const enabledToolNames =
		summary?.enabledToolNames ?? fallbackEnabledToolNames;
	const enabledToolCount = summary?.enabledToolCount ?? enabledToolNames.length;

	const filteredFeatures = React.useMemo(
		() =>
			featureDefinitions
				.filter((f) => f.name !== MCP_FEATURE_NAME)
				.slice()
				.sort((a, b) => {
					const aBottom = BOTTOM_FEATURE_NAMES.has(a.name);
					const bBottom = BOTTOM_FEATURE_NAMES.has(b.name);

					if (aBottom === bBottom) {
						const aEnabled = getFeatureEnabled(a, draftConfig, draftFeatures);
						const bEnabled = getFeatureEnabled(b, draftConfig, draftFeatures);

						if (aEnabled !== bEnabled) {
							return aEnabled ? -1 : 1;
						}

						return 0;
					}

					return aBottom ? 1 : -1;
				}),
		[featureDefinitions, draftConfig, draftFeatures],
	);
	const coreFeatures = filteredFeatures
		.filter((feature) => CORE_FEATURE_NAMES.has(feature.name))
		.sort(
			(a, b) =>
				(CORE_FEATURE_RANK.get(a.name) ?? Number.MAX_SAFE_INTEGER) -
				(CORE_FEATURE_RANK.get(b.name) ?? Number.MAX_SAFE_INTEGER),
		);
	const otherFeatures = filteredFeatures
		.filter((feature) => !CORE_FEATURE_NAMES.has(feature.name))
		.sort((a, b) => {
			const aRank = TOP_OTHER_FEATURE_RANK.get(a.name);
			const bRank = TOP_OTHER_FEATURE_RANK.get(b.name);

			if (aRank !== undefined || bRank !== undefined) {
				return (
					(aRank ?? Number.MAX_SAFE_INTEGER) -
					(bRank ?? Number.MAX_SAFE_INTEGER)
				);
			}

			return 0;
		});
	const visibleOtherFeatures = showAll
		? otherFeatures
		: otherFeatures.slice(0, FEATURES_DEFAULT_VISIBLE);
	const hiddenCount = otherFeatures.length - FEATURES_DEFAULT_VISIBLE;

	const renderFeatureCard = (feature: AgentFeatureDefinition) => {
		const displayName = getAgentFeatureDisplayName(feature, t);
		const displayDesc = getAgentFeatureDescription(feature, t);

		if (feature.type === "config" && feature.configKey === "tools") {
			const toolsToShow =
				feature.toolScope === "all"
					? availableTools
					: availableTools.filter((tool) => !claimedToolSet.has(tool));
			const enabledCount = toolsToShow.filter((tool) =>
				draftConfig.tools.includes(tool),
			).length;

			return (
				<CursorPoint
					key={feature.name}
					cursorKey={AGENT_WIZARD_CURSOR_KEYS.feature(feature.name)}
				>
					<FeatureCard
						feature={feature}
						displayName={displayName}
						displayDesc={displayDesc}
						toolCount={enabledCount}
						totalToolCount={toolsToShow.length}
						hasDetail
					/>
				</CursorPoint>
			);
		}

		const enabled = getFeatureEnabled(feature, draftConfig, draftFeatures);

		const onToggle =
			feature.type === "config"
				? (checked: boolean) =>
						updateField(
							feature.configKey as keyof FoundationPredefinedConfig,
							checked as never,
						)
				: () => toggleFeature(feature.name);

		const hasDetail =
			feature.type === "config" ? Boolean(feature.promptField) : true;

		return (
			<CursorPoint
				key={feature.name}
				cursorKey={AGENT_WIZARD_CURSOR_KEYS.feature(feature.name)}
			>
				<FeatureCard
					feature={feature}
					enabled={enabled}
					onToggle={onToggle}
					displayName={displayName}
					displayDesc={displayDesc}
					hasDetail={hasDetail}
				/>
			</CursorPoint>
		);
	};

	return (
		<div className="space-y-3">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<Sparkles size={13} className="text-muted-foreground" />
					<span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
						{t("summary.features", { ns: "agents" })}
					</span>
				</div>
				<HoverBadgeList
					title={t("summary.tools", { ns: "agents" })}
					items={enabledToolNames}
					emptyLabel={t("summary.noToolsEnabled", { ns: "agents" })}
					badgeClassName="font-mono"
					badgeVariant="outline"
					align="end"
				>
					<Badge
						variant="outline"
						className="cursor-help bg-background/80 text-[10px]"
					>
						{t("summary.toolsValue", {
							ns: "agents",
							count: enabledToolCount,
						})}
					</Badge>
				</HoverBadgeList>
			</div>

			{coreFeatures.length > 0 ? (
				<div className="space-y-2">
					<p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
						{ta("featuresSection.core")}
					</p>
					<div className="grid grid-cols-1 gap-3 min-[520px]:grid-cols-2 auto-rows-[136px]">
						{coreFeatures.map(renderFeatureCard)}
					</div>
				</div>
			) : null}

			{otherFeatures.length > 0 ? (
				<div className="space-y-2">
					<p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
						{ta("featuresSection.other")}
					</p>
					<div className="grid grid-cols-1 gap-3 min-[520px]:grid-cols-2 auto-rows-[136px]">
						{visibleOtherFeatures.map(renderFeatureCard)}
					</div>
				</div>
			) : null}

			{/* Show more / less */}
			{hiddenCount > 0 && (
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className="h-7 w-full rounded-xl text-xs text-muted-foreground hover:text-foreground"
					onClick={() => setShowAll((v) => !v)}
				>
					<ChevronDown
						size={12}
						className={cn(
							"mr-1.5 transition-transform",
							showAll ? "rotate-180" : "",
						)}
					/>
					{showAll
						? ta("featuresSection.showLess")
						: ta("featuresSection.showMore", { count: hiddenCount })}
				</Button>
			)}
		</div>
	);
};
