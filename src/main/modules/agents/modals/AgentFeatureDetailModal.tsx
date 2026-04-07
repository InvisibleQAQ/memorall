import React from "react";
import NiceModal, { useModal } from "@ebay/nice-modal-react";
import { useTranslation } from "react-i18next";
import { Sparkles, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAgentConfigStore } from "@/main/stores/agent-config";
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
import {
	getAgentFeatureDescription,
	getAgentFeatureDisplayName,
} from "../utils/feature-display";

interface AgentFeatureDetailModalProps {
	featureName: string;
}

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
		const { t } = useTranslation(["chat", "common"]);
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

		const title = getAgentFeatureDisplayName(feature, t);
		const description = getAgentFeatureDescription(feature, t);

		const renderTools = () => {
			if (feature.type === "config" && feature.configKey === "tools") {
				const toolsToShow =
					feature.toolScope === "all"
						? availableTools
						: availableTools.filter((tool) => !claimedToolSet.has(tool));

				const enabledCount = draftConfig.tools.filter((tool) =>
					toolsToShow.includes(tool),
				).length;

				return (
					<div className="space-y-3">
						<div className="flex items-center justify-between gap-2">
							<div className="flex items-center gap-2">
								<p className="text-xs font-semibold text-foreground/80">
									{t("agentSettings.featureTools")}
								</p>
								<Badge
									variant="secondary"
									className="rounded-full px-1.5 py-0 text-[10px] font-normal"
								>
									{enabledCount}/{toolsToShow.length}
								</Badge>
							</div>
							<div className="flex gap-0.5">
								<Button
									type="button"
									variant="ghost"
									size="sm"
									className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
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
								<span className="my-auto text-[10px] text-border">·</span>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
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
						<div className="grid grid-cols-1 gap-1.5 min-[520px]:grid-cols-2">
							{toolsToShow.map((toolName) => {
								const info = TOOL_DISPLAY_INFO[toolName];
								const isEnabled = draftConfig.tools.includes(toolName);
								const toolDescription = info?.descriptionKey
									? t(info.descriptionKey, {
											ns: "chat",
											defaultValue: info.description,
										})
									: info?.description;
								return (
									<div
										key={toolName}
										onClick={() => toggleTool(toolName)}
										className={cn(
											"group flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 transition-colors",
											isEnabled
												? "border-primary/25 bg-primary/5 hover:bg-primary/8"
												: "border-border/50 bg-background/50 hover:bg-muted/40",
										)}
									>
										<div className="min-w-0 flex-1">
											<p
												className={cn(
													"truncate font-mono text-[11px] font-medium leading-tight",
													isEnabled ? "text-foreground" : "text-foreground/70",
												)}
											>
												{toolName}
											</p>
											{toolDescription ? (
												<p className="mt-0.5 truncate text-[10px] leading-tight text-muted-foreground">
													{toolDescription}
												</p>
											) : null}
										</div>
										<Switch
											checked={isEnabled}
											onCheckedChange={() => toggleTool(toolName)}
											onClick={(e) => e.stopPropagation()}
											className="pointer-events-none shrink-0 scale-[0.8]"
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
				<DialogContent className="flex max-h-[min(90dvh,580px)] w-[calc(100vw-1rem)] max-w-[800px] flex-col overflow-hidden gap-0 rounded-2xl border-border/60 p-0 shadow-2xl sm:w-[min(94vw,800px)]">
					<DialogHeader className="border-b px-5 pt-5 pb-4">
						<div className="flex items-start gap-3">
							<span className="mt-0.5 shrink-0 rounded-lg bg-muted p-1.5 text-muted-foreground">
								{feature.type === "config" && feature.configKey === "tools" ? (
									<Wrench size={14} />
								) : (
									<Sparkles size={14} />
								)}
							</span>
							<div className="min-w-0 flex-1 space-y-1">
								<div className="flex flex-wrap items-center gap-1.5">
									<DialogTitle className="text-sm font-semibold leading-none">
										{title}
									</DialogTitle>
									<Badge
										variant="secondary"
										className="rounded-full px-1.5 py-0 text-[10px] font-normal"
									>
										{feature.type === "catalog"
											? t("agentSettings.toolCount", {
													count: feature.tools.length,
												})
											: t("agentSettings.detail")}
									</Badge>
									{feature.type === "config" &&
									feature.configKey === "tools" ? (
										<Badge
											variant="outline"
											className="rounded-full px-1.5 py-0 text-[10px] font-normal"
										>
											{t("agentSettings.toolCount", {
												count: draftConfig.tools.length,
											})}
										</Badge>
									) : null}
								</div>
								<DialogDescription className="text-xs text-muted-foreground">
									{description}
								</DialogDescription>
							</div>
						</div>
					</DialogHeader>

					<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
						<div className="space-y-4 px-5 py-4">{renderTools()}</div>
						<DialogFooter className="sticky bottom-0 border-t bg-background/95 px-5 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/85">
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="h-7 min-w-[80px] text-xs"
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
