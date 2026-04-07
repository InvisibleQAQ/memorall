import React from "react";
import { useTranslation } from "react-i18next";
import {
	ChevronRight,
	FileText,
	Network,
	Sparkles,
	Wrench,
} from "lucide-react";
import NiceModal from "@ebay/nice-modal-react";
import {
	useAgentConfigStore,
	GRAPH_REGISTRY,
	getDefaultSystemPromptForGraph,
} from "@/main/stores/agent-config";
import { AgentFeatureDetailModal } from "@/main/modules/agents/modals/AgentFeatureDetailModal";
import { Button } from "@/main/components/ui/button";
import { Textarea } from "@/main/components/ui/textarea";
import { Badge } from "@/main/components/ui/badge";
import { Label } from "@/main/components/ui/label";
import { Switch } from "@/main/components/ui/switch";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/main/components/ui/select";
import { cn } from "@/lib/utils";
import type { KnowledgeRAGPredefinedConfig } from "@/services/flows/graph/knowledge-rag/state";
import type { AgentConfigSummary } from "../types";
import { HoverBadgeList } from "./AgentHoverInfo";
import {
	getAgentFeatureDescription,
	getAgentFeatureDisplayName,
} from "../utils/feature-display";

interface AgentConfigFormProps {
	className?: string;
	summary?: AgentConfigSummary | null;
}

export const AgentConfigForm: React.FC<AgentConfigFormProps> = ({
	className,
	summary,
}) => {
	const { t } = useTranslation(["chat", "agents", "common"]);
	const {
		draftConfig,
		draftFeatures,
		featureDefinitions,
		availableTools,
		currentGraphType,
		isLegacyConfig,
		isLoading,
		isSaving,
		updateField,
		setGraphType,
		toggleFeature,
		convertToUnified,
	} = useAgentConfigStore();
	const defaultSystemPrompt = React.useMemo(
		() => getDefaultSystemPromptForGraph(currentGraphType),
		[currentGraphType],
	);
	const [systemPromptValue, setSystemPromptValue] = React.useState(
		draftConfig.systemPrompt || defaultSystemPrompt,
	);

	React.useEffect(() => {
		setSystemPromptValue(draftConfig.systemPrompt || defaultSystemPrompt);
	}, [defaultSystemPrompt, draftConfig.systemPrompt]);

	const handleSystemPromptChange = (value: string) => {
		setSystemPromptValue(value);
		updateField("systemPrompt", value === defaultSystemPrompt ? "" : value);
	};

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

	const currentGraphMeta = GRAPH_REGISTRY.find(
		(graph) => graph.id === currentGraphType,
	);
	const fallbackEnabledFeatureLabels = React.useMemo(
		() =>
			featureDefinitions.flatMap((feature) => {
				if (feature.type === "config") {
					if (
						feature.configKey === "tools" ||
						!draftConfig[feature.configKey]
					) {
						return [];
					}

					return [getAgentFeatureDisplayName(feature, t)];
				}

				return draftFeatures[feature.name]
					? [getAgentFeatureDisplayName(feature, t)]
					: [];
			}),
		[draftConfig, draftFeatures, featureDefinitions, t],
	);
	const fallbackEnabledToolNames = React.useMemo(() => {
		const enabledToolSet = new Set(draftConfig.tools);

		for (const feature of featureDefinitions) {
			if (feature.type === "config") {
				if (feature.configKey === "tools" || !draftConfig[feature.configKey]) {
					continue;
				}
			} else if (!draftFeatures[feature.name]) {
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
	}, [availableTools, draftConfig, draftFeatures, featureDefinitions]);
	const enabledFeatureLabels =
		summary?.enabledFeatureLabels ?? fallbackEnabledFeatureLabels;
	const enabledToolNames =
		summary?.enabledToolNames ?? fallbackEnabledToolNames;
	const enabledFeatureCount =
		summary?.enabledFeatureCount ?? enabledFeatureLabels.length;
	const enabledToolCount = summary?.enabledToolCount ?? enabledToolNames.length;

	if (isLoading) {
		return (
			<div className="flex h-full items-center justify-center px-6 py-12">
				<div className="text-sm text-muted-foreground">
					{t("agentSettings.loading")}
				</div>
			</div>
		);
	}

	return (
		<div className={cn("space-y-6", className)}>
			{isLegacyConfig ? (
				<div className="flex flex-col gap-3 rounded-2xl border border-amber-300/60 bg-amber-50/80 p-4 text-sm text-amber-950">
					<div className="space-y-1">
						<p className="font-semibold">
							{t("agentSettings.legacyConfigTitle")}
						</p>
						<p className="text-xs leading-relaxed text-amber-900/80">
							{t("agentSettings.legacyConfigDescription")}
						</p>
					</div>
					<div>
						<Button
							type="button"
							size="sm"
							onClick={() => void convertToUnified()}
							disabled={isSaving}
						>
							{isSaving
								? t("agentSettings.converting")
								: t("agentSettings.convertToUnified")}
						</Button>
					</div>
				</div>
			) : null}

			<div className="space-y-3 rounded-2xl border border-border/70 bg-gradient-to-br from-background via-background to-muted/30 p-4 shadow-sm sm:p-5">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div className="flex items-start gap-3">
						<div className="rounded-xl bg-muted p-2.5 text-muted-foreground">
							<FileText size={16} />
						</div>
						<div className="space-y-1">
							<Label className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
								{t("agentSettings.systemPrompt")}
							</Label>
							<p className="text-sm font-semibold">
								{t("agentSettings.charCount", {
									count: systemPromptValue?.length || 0,
								})}
							</p>
						</div>
					</div>
					<Badge variant="outline" className="bg-background/80">
						{systemPromptValue?.length || ""}
					</Badge>
				</div>
				<Textarea
					value={systemPromptValue}
					onChange={(event) => handleSystemPromptChange(event.target.value)}
					className="min-h-[180px] w-full resize-y rounded-xl border-border/70 bg-background/80 font-mono text-xs"
				/>
				<p className="text-[11px] leading-relaxed text-muted-foreground">
					{t("agentSettings.systemPromptHint")}
				</p>
			</div>

			<div className="space-y-3 rounded-2xl border border-border/70 bg-gradient-to-br from-background via-background to-muted/30 p-4 shadow-sm sm:p-5">
				<div className="flex items-start gap-3">
					<div className="rounded-xl bg-muted p-2.5 text-muted-foreground">
						<Network size={16} />
					</div>
					<div className="space-y-1">
						<Label className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
							{t("agentSettings.baseGraph")}
						</Label>
						<p className="text-sm font-semibold">
							{currentGraphMeta
								? t(currentGraphMeta.nameKey)
								: currentGraphType}
						</p>
					</div>
				</div>
				<Select
					value={currentGraphType}
					onValueChange={(value) =>
						setGraphType(value as typeof currentGraphType)
					}
				>
					<SelectTrigger className="h-10 rounded-xl border-border/70 bg-background/80 text-xs">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{GRAPH_REGISTRY.map((graph) => (
							<SelectItem key={graph.id} value={graph.id} className="text-xs">
								{t(graph.nameKey)}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				{currentGraphMeta ? (
					<p className="text-[11px] leading-relaxed text-muted-foreground">
						{t(currentGraphMeta.descKey)}
					</p>
				) : null}
			</div>

			<div className="space-y-4">
				<div className="rounded-2xl border border-border/70 bg-gradient-to-r from-background via-background to-muted/30 p-4 shadow-sm sm:p-5">
					<div className="flex items-start justify-between gap-3">
						<div className="flex items-start gap-3">
							<div className="rounded-xl bg-muted p-2.5 text-muted-foreground">
								<Sparkles size={16} />
							</div>
							<div className="space-y-1">
								<Label className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
									{t("summary.features", { ns: "agents" })}
								</Label>
								<HoverBadgeList
									title={t("summary.features", { ns: "agents" })}
									items={enabledFeatureLabels}
									emptyLabel={t("summary.noFeaturesEnabled", {
										ns: "agents",
									})}
								>
									<div className="cursor-help">
										<p className="text-sm font-semibold">
											{t("summary.featuresValue", {
												ns: "agents",
												count: enabledFeatureCount,
											})}
										</p>
									</div>
								</HoverBadgeList>
							</div>
						</div>
						<HoverBadgeList
							title={t("summary.tools", { ns: "agents" })}
							items={enabledToolNames}
							emptyLabel={t("summary.noToolsEnabled", { ns: "agents" })}
							badgeClassName="font-mono"
							badgeVariant="outline"
							align="end"
						>
							<Badge variant="outline" className="cursor-help bg-background/80">
								{t("summary.toolsValue", {
									ns: "agents",
									count: enabledToolCount,
								})}
							</Badge>
						</HoverBadgeList>
					</div>
				</div>

				<div className="grid grid-cols-1 gap-3 min-[520px]:grid-cols-2">
					{featureDefinitions.map((feature) => {
						if (feature.type === "config" && feature.configKey === "tools") {
							const toolsToShow =
								feature.toolScope === "all"
									? availableTools
									: availableTools.filter((tool) => !claimedToolSet.has(tool));
							const enabledCount = toolsToShow.filter((tool) =>
								draftConfig.tools.includes(tool),
							).length;

							return (
								<div
									key={feature.name}
									className="space-y-3 rounded-2xl border border-border/70 bg-gradient-to-br from-background via-background to-muted/20 p-4 shadow-sm transition-colors hover:border-foreground/15"
								>
									<div className="flex items-start gap-3">
										<div className="rounded-xl bg-muted p-2.5 text-muted-foreground">
											<Wrench size={16} />
										</div>
										<div className="space-y-0.5">
											<p className="text-sm font-semibold">
												{t(feature.nameKey)}
											</p>
											<p className="text-[11px] leading-tight text-muted-foreground">
												{t(feature.descKey)}
											</p>
										</div>
									</div>

									<div className="flex items-center justify-between gap-3">
										<Badge variant="secondary" className="text-[10px]">
											{enabledCount}/{toolsToShow.length}
										</Badge>
										<Button
											type="button"
											variant="ghost"
											size="sm"
											className="h-7 rounded-lg px-2 text-[10px]"
											onClick={() =>
												void NiceModal.show(AgentFeatureDetailModal, {
													featureName: feature.name,
												})
											}
										>
											<ChevronRight size={10} className="mr-1" />
											{t("agentSettings.detail")}
										</Button>
									</div>
								</div>
							);
						}

						const enabled =
							feature.type === "config"
								? Boolean(
										draftConfig[
											feature.configKey as keyof KnowledgeRAGPredefinedConfig
										],
									)
								: Boolean(draftFeatures[feature.name]);

						const onToggle =
							feature.type === "config"
								? (checked: boolean) =>
										updateField(
											feature.configKey as keyof KnowledgeRAGPredefinedConfig,
											checked as never,
										)
								: () => toggleFeature(feature.name);

						const displayName = getAgentFeatureDisplayName(feature, t);
						const displayDesc = getAgentFeatureDescription(feature, t);
						const hasDetail =
							feature.type === "config" ? Boolean(feature.promptField) : true;

						return (
							<div
								key={feature.name}
								className="space-y-3 rounded-2xl border border-border/70 bg-gradient-to-br from-background via-background to-muted/20 p-4 shadow-sm transition-colors hover:border-foreground/15"
							>
								<div className="flex items-start justify-between gap-3">
									<div className="space-y-0.5">
										<div className="flex items-center gap-2">
											<span
												className={cn(
													"h-2.5 w-2.5 rounded-full",
													enabled ? "bg-emerald-500" : "bg-muted-foreground/30",
												)}
											/>
											<p className="text-sm font-semibold">{displayName}</p>
										</div>
										<p className="text-[11px] leading-tight text-muted-foreground">
											{displayDesc}
										</p>
									</div>
									<Switch checked={enabled} onCheckedChange={onToggle} />
								</div>

								{feature.type === "catalog" || hasDetail ? (
									<div className="flex items-center justify-between gap-3">
										{feature.type === "catalog" ? (
											<Badge variant="secondary" className="text-[10px]">
												{t("agentSettings.toolCount", {
													count: feature.tools.length,
												})}
											</Badge>
										) : (
											<span />
										)}
										{hasDetail ? (
											<Button
												type="button"
												variant="ghost"
												size="sm"
												className="h-7 rounded-lg px-2 text-[10px]"
												onClick={() =>
													void NiceModal.show(AgentFeatureDetailModal, {
														featureName: feature.name,
													})
												}
											>
												<ChevronRight size={10} className="mr-1" />
												{t("agentSettings.detail")}
											</Button>
										) : null}
									</div>
								) : null}
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
};
