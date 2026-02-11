import React from "react";
import { useTranslation } from "react-i18next";
import { X, Settings2, Save, Undo2, RotateCcw } from "lucide-react";
import { useAgentConfigStore } from "@/main/stores/agent-config";
import { TOOL_DISPLAY_INFO } from "@/main/modules/chat/utils/tool-display-info";
import { DEFAULT_KNOWLEDGE_RAG_SYSTEM_PROMPT } from "@/services/flows/graph/knowledge-rag/state";
import { Switch } from "@/main/components/ui/switch";
import { Button } from "@/main/components/ui/button";
import { Textarea } from "@/main/components/ui/textarea";
import { Badge } from "@/main/components/ui/badge";
import { ScrollArea } from "@/main/components/ui/scroll-area";
import { Label } from "@/main/components/ui/label";
import { Separator } from "@/main/components/ui/separator";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/main/components/ui/alert-dialog";
import { DEFAULT_CONTEXT_SYSTEM_PROMPT } from "@/services/flows/steps/knowledge-retrieval/context-to-system";

export const AgentSettingsPanel: React.FC = () => {
	const { t } = useTranslation("chat");
	const {
		draftConfig,
		draftFeatures,
		featureDefinitions,
		availableTools,
		isLoading,
		isSaving,
		isDirty,
		close,
		updateField,
		toggleFeature,
		toggleTool,
		save,
		revert,
		resetToDefaults,
	} = useAgentConfigStore();
	const [selectedFeature, setSelectedFeature] = React.useState<string | null>(
		null,
	);

	const featureToolSet = React.useMemo(() => {
		const set = new Set<string>();
		for (const feature of featureDefinitions) {
			for (const tool of feature.tools) {
				set.add(tool);
			}
		}
		return set;
	}, [featureDefinitions]);

	const standaloneTools = React.useMemo(
		() => availableTools.filter((toolName) => !featureToolSet.has(toolName)),
		[availableTools, featureToolSet],
	);

	if (isLoading) {
		return (
			<div className="flex items-center justify-center h-full">
				<div className="text-sm text-muted-foreground">
					{t("agentSettings.loading")}
				</div>
			</div>
		);
	}

	const enableAllTools = () => {
		updateField("tools", [...standaloneTools]);
	};

	const disableAllTools = () => {
		updateField("tools", []);
	};

	const selectedFeatureDefinition =
		featureDefinitions.find((feature) => feature.name === selectedFeature) ??
		null;

	return (
		<div className="flex flex-col h-full">
			{/* Header */}
			<div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0">
				<div className="flex items-center gap-2">
					<Settings2 size={16} className="text-muted-foreground" />
					<h2 className="text-sm font-semibold">{t("agentSettings.title")}</h2>
					{isDirty ? (
						<Badge
							variant="outline"
							className="text-[10px] px-1.5 py-0 border-orange-300 text-orange-600"
						>
							{t("agentSettings.unsaved")}
						</Badge>
					) : (
						<Badge
							variant="outline"
							className="text-[10px] px-1.5 py-0 border-green-300 text-green-600"
						>
							{t("agentSettings.saved")}
						</Badge>
					)}
				</div>
				<Button
					variant="ghost"
					size="sm"
					onClick={close}
					className="h-7 w-7 p-0"
				>
					<X size={14} />
				</Button>
			</div>

			{/* Body */}
			<ScrollArea className="flex-1 min-h-0">
				<div className="p-4 space-y-6">
					{/* System Prompt */}
					<div className="space-y-2">
						<Label className="text-xs font-medium">
							{t("agentSettings.systemPrompt")}
						</Label>
						<Textarea
							value={draftConfig.systemPrompt}
							onChange={(e) => updateField("systemPrompt", e.target.value)}
							placeholder={DEFAULT_KNOWLEDGE_RAG_SYSTEM_PROMPT}
							className="min-h-[120px] font-mono text-xs resize-y"
						/>
						<div className="flex items-center justify-between">
							<p className="text-[10px] text-muted-foreground">
								{t("agentSettings.systemPromptHint")}
							</p>
							<span className="text-[10px] text-muted-foreground">
								{t("agentSettings.charCount", {
									count: draftConfig.systemPrompt.length,
								})}
							</span>
						</div>
					</div>

					<Separator />

					{/* Capabilities */}
					<div className="space-y-3">
						<Label className="text-xs font-medium">
							{t("agentSettings.capabilities")}
						</Label>

						{/* Context Retrieval */}
						<div className="flex items-start justify-between gap-3">
							<div className="space-y-0.5">
								<p className="text-xs font-medium">
									{t("agentSettings.contextRetrieval")}
								</p>
								<p className="text-[10px] text-muted-foreground leading-tight">
									{t("agentSettings.contextRetrievalDesc")}
								</p>
							</div>
							<Switch
								checked={draftConfig.enableContextRetrieval}
								onCheckedChange={(checked) =>
									updateField("enableContextRetrieval", checked)
								}
							/>
						</div>

						{draftConfig.enableContextRetrieval && (
							<div className="space-y-2">
								<Label className="text-xs font-medium">
									{t("agentSettings.contextPrompt")}
								</Label>
								<Textarea
									value={draftConfig.contextPrompt}
									onChange={(e) => updateField("contextPrompt", e.target.value)}
									placeholder={DEFAULT_CONTEXT_SYSTEM_PROMPT}
									className="min-h-[120px] font-mono text-xs resize-y"
								/>
								<p className="text-[10px] text-muted-foreground">
									{t("agentSettings.contextPromptHint")}
								</p>
							</div>
						)}

						{/* Citations */}
						<div className="flex items-start justify-between gap-3">
							<div className="space-y-0.5">
								<p className="text-xs font-medium">
									{t("agentSettings.citations")}
								</p>
								<p className="text-[10px] text-muted-foreground leading-tight">
									{t("agentSettings.citationsDesc")}
								</p>
							</div>
							<Switch
								checked={draftConfig.enableCitations}
								onCheckedChange={(checked) =>
									updateField("enableCitations", checked)
								}
							/>
						</div>
					</div>

					<Separator />

					{/* Feature Tools */}
					<div className="space-y-3">
						<Label className="text-xs font-medium">
							{t("agentSettings.features")}
						</Label>

						<div className="space-y-2">
							{featureDefinitions.map((feature) => {
								const enabled = Boolean(draftFeatures[feature.name]);
								const isSelected = selectedFeature === feature.name;
								return (
									<div
										key={feature.name}
										className="rounded-md border px-3 py-2 space-y-2"
									>
										<div className="flex items-start justify-between gap-3">
											<div className="space-y-0.5">
												<p className="text-xs font-medium">{feature.name}</p>
												<p className="text-[10px] text-muted-foreground leading-tight">
													{feature.description}
												</p>
											</div>
											<Switch
												checked={enabled}
												onCheckedChange={() => toggleFeature(feature.name)}
											/>
										</div>
										<div className="flex items-center justify-between">
											<p className="text-[10px] text-muted-foreground">
												{t("agentSettings.toolCount", {
													count: feature.tools.length,
												})}
											</p>
											<Button
												variant="ghost"
												size="sm"
												className="h-6 px-2 text-[10px]"
												onClick={() =>
													setSelectedFeature(isSelected ? null : feature.name)
												}
											>
												{isSelected
													? t("agentSettings.hideDetail")
													: t("agentSettings.detail")}
											</Button>
										</div>
									</div>
								);
							})}
						</div>

						{selectedFeatureDefinition && (
							<div className="space-y-2 rounded-md border px-3 py-3">
								<Label className="text-xs font-medium">
									{t("agentSettings.featureDetail", {
										name: selectedFeatureDefinition.name,
									})}
								</Label>
								<div className="space-y-1">
									<p className="text-[10px] font-medium text-muted-foreground">
										{t("agentSettings.featureTools")}
									</p>
									<div className="flex flex-wrap gap-1">
										{selectedFeatureDefinition.tools.map((tool) => (
											<Badge
												key={tool}
												variant="outline"
												className="text-[10px] font-mono"
											>
												{tool}
											</Badge>
										))}
									</div>
								</div>
								<div className="space-y-1">
									<p className="text-[10px] font-medium text-muted-foreground">
										{t("agentSettings.featureSystemPrompt")}
									</p>
									<Textarea
										value={selectedFeatureDefinition.systemPrompt}
										readOnly
										className="min-h-[140px] font-mono text-xs resize-y"
									/>
								</div>
							</div>
						)}
					</div>

					<Separator />

					{/* Tools */}
					<div className="space-y-3">
						<div className="flex items-center justify-between">
							<Label className="text-xs font-medium">
								{t("agentSettings.standaloneTools")}
							</Label>
							<div className="flex items-center gap-1">
								<Button
									variant="ghost"
									size="sm"
									onClick={enableAllTools}
									className="h-6 px-2 text-[10px]"
								>
									{t("agentSettings.enableAll")}
								</Button>
								<Button
									variant="ghost"
									size="sm"
									onClick={disableAllTools}
									className="h-6 px-2 text-[10px]"
								>
									{t("agentSettings.disableAll")}
								</Button>
							</div>
						</div>

						<div className="space-y-2">
							{standaloneTools.map((toolName) => {
								const info = TOOL_DISPLAY_INFO[toolName];
								return (
									<div
										key={toolName}
										className="flex items-start justify-between gap-3"
									>
										<div className="space-y-0.5">
											<p className="text-xs font-medium font-mono">
												{toolName}
											</p>
											{info?.description && (
												<p className="text-[10px] text-muted-foreground leading-tight">
													{info.description}
												</p>
											)}
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
				</div>
			</ScrollArea>

			{/* Footer */}
			<div className="flex items-center justify-between px-4 py-3 border-t flex-shrink-0 gap-2">
				<AlertDialog>
					<AlertDialogTrigger asChild>
						<Button variant="ghost" size="sm" className="text-xs h-8">
							<RotateCcw size={12} className="mr-1" />
							{t("agentSettings.resetDefaults")}
						</Button>
					</AlertDialogTrigger>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>
								{t("agentSettings.resetDefaults")}
							</AlertDialogTitle>
							<AlertDialogDescription>
								{t("agentSettings.resetConfirm")}
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel>{t("agentSettings.cancel")}</AlertDialogCancel>
							<AlertDialogAction onClick={resetToDefaults}>
								{t("agentSettings.resetDefaults")}
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>

				<div className="flex items-center gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={revert}
						disabled={!isDirty}
						className="text-xs h-8"
					>
						<Undo2 size={12} className="mr-1" />
						{t("agentSettings.revert")}
					</Button>
					<Button
						size="sm"
						onClick={save}
						disabled={!isDirty || isSaving}
						className="text-xs h-8"
					>
						<Save size={12} className="mr-1" />
						{t("agentSettings.save")}
					</Button>
				</div>
			</div>
		</div>
	);
};
