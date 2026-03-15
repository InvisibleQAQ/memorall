import React from "react";
import NiceModal, { useModal } from "@ebay/nice-modal-react";
import { useTranslation } from "react-i18next";
import { Sparkles, Wrench } from "lucide-react";
import {
	useAgentConfigStore,
	type AgentFeatureDefinition,
} from "@/main/stores/agent-config";
import { TOOL_DISPLAY_INFO } from "@/main/modules/chat/utils/tool-display-info";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/main/components/ui/dialog";
import { Badge } from "@/main/components/ui/badge";
import { Button } from "@/main/components/ui/button";
import { Label } from "@/main/components/ui/label";
import { Switch } from "@/main/components/ui/switch";
import { Textarea } from "@/main/components/ui/textarea";
import { DEFAULT_CONTEXT_SYSTEM_PROMPT } from "@/services/flows/steps/knowledge-retrieval/context-to-system";

interface AgentFeatureDetailModalProps {
	featureName: string;
}

const getFeatureDescription = (
	feature: AgentFeatureDefinition,
	t: ReturnType<typeof useTranslation>["t"],
) => {
	if (feature.type === "config") {
		return t(feature.descKey);
	}

	return feature.description;
};

const mergeToolSelection = (
	currentTools: string[],
	visibleTools: string[],
	availableTools: string[],
	mode: "enable" | "disable",
) => {
	const nextSelection = new Set(currentTools);

	for (const toolName of visibleTools) {
		if (mode === "enable") {
			nextSelection.add(toolName);
		} else {
			nextSelection.delete(toolName);
		}
	}

	return availableTools.filter((toolName) => nextSelection.has(toolName));
};

export const AgentFeatureDetailModal =
	NiceModal.create<AgentFeatureDetailModalProps>(({ featureName }) => {
		const modal = useModal();
		const { t } = useTranslation("chat");
		const {
			draftConfig,
			featureDefinitions,
			availableTools,
			updateField,
			toggleTool,
		} = useAgentConfigStore();

		const feature = featureDefinitions.find(
			(definition) => definition.name === featureName,
		);

		const claimedToolSet = React.useMemo(() => {
			const set = new Set<string>();
			for (const definition of featureDefinitions) {
				if (definition.type === "catalog") {
					for (const tool of definition.tools) {
						set.add(tool);
					}
				}
			}
			return set;
		}, [featureDefinitions]);

		if (!feature) {
			return (
				<Dialog
					open={modal.visible}
					onOpenChange={(open) => !open && modal.hide()}
				>
					<DialogContent className="sm:max-w-[540px]">
						<DialogHeader>
							<DialogTitle>{t("agentSettings.detail")}</DialogTitle>
							<DialogDescription>
								Feature detail is not available.
							</DialogDescription>
						</DialogHeader>
						<DialogFooter className="flex-row justify-end gap-2">
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => modal.hide()}
							>
								{t("agentSettings.cancel")}
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			);
		}

		const title = feature.type === "config" ? t(feature.nameKey) : feature.name;
		const description = getFeatureDescription(feature, t);

		const renderTools = () => {
			if (feature.type === "config" && feature.configKey === "tools") {
				const toolsToShow =
					feature.toolScope === "all"
						? availableTools
						: availableTools.filter((tool) => !claimedToolSet.has(tool));

				return (
					<div className="space-y-4">
						<div className="flex flex-wrap items-center justify-between gap-3">
							<div className="space-y-1">
								<p className="text-sm font-semibold">
									{t("agentSettings.featureTools")}
								</p>
								<p className="text-xs text-muted-foreground">
									{t("agentSettings.toolCount", {
										count: draftConfig.tools.filter((tool) =>
											toolsToShow.includes(tool),
										).length,
									})}
								</p>
							</div>
							<div className="flex flex-wrap gap-2">
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() =>
										updateField(
											"tools",
											mergeToolSelection(
												draftConfig.tools,
												toolsToShow,
												availableTools,
												"enable",
											),
										)
									}
								>
									{t("agentSettings.enableAll")}
								</Button>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() =>
										updateField(
											"tools",
											mergeToolSelection(
												draftConfig.tools,
												toolsToShow,
												availableTools,
												"disable",
											),
										)
									}
								>
									{t("agentSettings.disableAll")}
								</Button>
							</div>
						</div>
						<div className="grid grid-cols-1 gap-3 min-[520px]:grid-cols-2">
							{toolsToShow.map((toolName) => {
								const info = TOOL_DISPLAY_INFO[toolName];
								return (
									<div
										key={toolName}
										className="flex items-start justify-between gap-3 rounded-xl border border-border/70 bg-background/80 px-3 py-3"
									>
										<div className="space-y-0.5">
											<p className="font-mono text-xs font-medium">
												{toolName}
											</p>
											{info?.description ? (
												<p className="text-[10px] leading-tight text-muted-foreground">
													{info.description}
												</p>
											) : null}
										</div>
										<Switch
											checked={draftConfig.tools.includes(toolName)}
											onCheckedChange={() => toggleTool(toolName)}
										/>
									</div>
								);
							})}
						</div>
					</div>
				);
			}

			if (feature.type === "catalog") {
				return (
					<div className="space-y-4">
						<div className="space-y-2">
							<p className="text-sm font-semibold">
								{t("agentSettings.featureTools")}
							</p>
							<div className="flex flex-wrap gap-2">
								{feature.tools.map((tool) => (
									<Badge
										key={tool}
										variant="outline"
										className="font-mono text-[10px]"
									>
										{tool}
									</Badge>
								))}
							</div>
						</div>
						<div className="space-y-2">
							<p className="text-sm font-semibold">
								{t("agentSettings.featureSystemPrompt")}
							</p>
							<Textarea
								value={feature.systemPrompt}
								readOnly
								className="min-h-[220px] resize-y rounded-xl border-border/70 bg-background/80 font-mono text-xs"
							/>
						</div>
					</div>
				);
			}

			if (feature.type === "config" && feature.promptField) {
				const promptField = feature.promptField.field;
				const contextPromptValue =
					draftConfig[promptField] || DEFAULT_CONTEXT_SYSTEM_PROMPT;

				return (
					<div className="space-y-2">
						<Label className="text-xs font-medium">
							{t(feature.promptField.labelKey)}
						</Label>
						<Textarea
							value={contextPromptValue}
							onChange={(event) =>
								updateField(
									promptField,
									event.target.value === DEFAULT_CONTEXT_SYSTEM_PROMPT
										? ""
										: event.target.value,
								)
							}
							className="min-h-[220px] resize-y rounded-xl border-border/70 bg-background/80 font-mono text-xs"
						/>
						<p className="text-[10px] text-muted-foreground">
							{t(feature.promptField.hintKey)}
						</p>
					</div>
				);
			}

			return null;
		};

		return (
			<Dialog
				open={modal.visible}
				onOpenChange={(open) => !open && modal.hide()}
			>
				<DialogContent className="flex max-h-[min(90dvh,640px)] w-[calc(100vw-1rem)] max-w-[920px] flex-col overflow-hidden gap-0 rounded-2xl border-border/70 p-0 shadow-2xl sm:w-[min(94vw,920px)]">
					<DialogHeader className="border-b bg-gradient-to-r from-background via-background to-muted/30 px-6 pt-6 pb-4">
						<DialogTitle className="flex items-center gap-2">
							<span className="rounded-xl bg-muted p-2 text-muted-foreground">
								{feature.type === "config" && feature.configKey === "tools" ? (
									<Wrench size={16} />
								) : (
									<Sparkles size={16} />
								)}
							</span>
							{title}
						</DialogTitle>
						<div className="flex flex-wrap items-center gap-2">
							<Badge variant="secondary" className="rounded-full px-2.5 py-0.5">
								{feature.type === "catalog"
									? t("agentSettings.toolCount", {
											count: feature.tools.length,
										})
									: t("agentSettings.detail")}
							</Badge>
							{feature.type === "config" && feature.configKey === "tools" ? (
								<Badge variant="outline" className="rounded-full px-2.5 py-0.5">
									{t("agentSettings.toolCount", {
										count: draftConfig.tools.length,
									})}
								</Badge>
							) : null}
						</div>
						<DialogDescription className="max-w-3xl">
							{description}
						</DialogDescription>
					</DialogHeader>

					<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
						<div className="space-y-5 px-6 py-5">{renderTools()}</div>
						<DialogFooter className="sticky bottom-0 mt-4 flex-row justify-end gap-2 border-t bg-background/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/85">
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="min-w-[104px]"
								onClick={() => modal.hide()}
							>
								{t("agentSettings.cancel")}
							</Button>
						</DialogFooter>
					</div>
				</DialogContent>
			</Dialog>
		);
	});
