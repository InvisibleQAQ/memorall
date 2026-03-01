import React from "react";
import { useTranslation } from "react-i18next";
import {
	X,
	Settings2,
	Save,
	Undo2,
	RotateCcw,
	ChevronDown,
	ChevronUp,
	Wrench,
} from "lucide-react";
import { useAgentConfigStore } from "@/main/stores/agent-config";
import { TOOL_DISPLAY_INFO } from "@/main/modules/chat/utils/tool-display-info";
import { DEFAULT_KNOWLEDGE_RAG_SYSTEM_PROMPT } from "@/services/flows/graph/knowledge-rag/state";
import { DEFAULT_CONTEXT_SYSTEM_PROMPT } from "@/services/flows/steps/knowledge-retrieval/context-to-system";
import { Switch } from "@/main/components/ui/switch";
import { Button } from "@/main/components/ui/button";
import { Textarea } from "@/main/components/ui/textarea";
import { Badge } from "@/main/components/ui/badge";
import { ScrollArea } from "@/main/components/ui/scroll-area";
import { Label } from "@/main/components/ui/label";
import { Separator } from "@/main/components/ui/separator";
import { cn } from "@/lib/utils";
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
import type { KnowledgeRAGPredefinedConfig } from "@/services/flows/graph/knowledge-rag/state";

export const AgentSettingsPanel: React.FC = () => {
	const { t } = useTranslation("chat");
	const {
		draftConfig,
		draftFeatures,
		featureDefinitions,
		availableTools,
		currentGraphType,
		isLoading,
		isSaving,
		isDirty,
		close,
		updateField,
		setGraphType,
		toggleFeature,
		toggleTool,
		save,
		revert,
		resetToDefaults,
	} = useAgentConfigStore();

	const [expandedId, setExpandedId] = React.useState<string | null>(null);

	// Local display values: show the effective default when the stored value is empty.
	const [systemPromptValue, setSystemPromptValue] = React.useState(
		draftConfig.systemPrompt || DEFAULT_KNOWLEDGE_RAG_SYSTEM_PROMPT,
	);
	const [contextPromptValue, setContextPromptValue] = React.useState(
		draftConfig.contextPrompt || DEFAULT_CONTEXT_SYSTEM_PROMPT,
	);

	React.useEffect(() => {
		setSystemPromptValue(
			draftConfig.systemPrompt || DEFAULT_KNOWLEDGE_RAG_SYSTEM_PROMPT,
		);
	}, [draftConfig.systemPrompt]);

	React.useEffect(() => {
		setContextPromptValue(
			draftConfig.contextPrompt || DEFAULT_CONTEXT_SYSTEM_PROMPT,
		);
	}, [draftConfig.contextPrompt]);

	const handleSystemPromptChange = (value: string) => {
		setSystemPromptValue(value);
		updateField(
			"systemPrompt",
			value === DEFAULT_KNOWLEDGE_RAG_SYSTEM_PROMPT ? "" : value,
		);
	};

	const handleContextPromptChange = (value: string) => {
		setContextPromptValue(value);
		updateField(
			"contextPrompt",
			value === DEFAULT_CONTEXT_SYSTEM_PROMPT ? "" : value,
		);
	};

	// Tools claimed by catalog features (knowledge-rag only)
	const featureToolSet = React.useMemo(() => {
		const set = new Set<string>();
		for (const f of featureDefinitions) {
			for (const tool of f.tools) set.add(tool);
		}
		return set;
	}, [featureDefinitions]);

	// For knowledge-rag: tools not claimed by any feature → fed to the agent node.
	// For agent: all available tools → fed to the agent node.
	const agentNodeTools = React.useMemo(
		() =>
			currentGraphType === "agent"
				? availableTools
				: availableTools.filter((t) => !featureToolSet.has(t)),
		[availableTools, featureToolSet, currentGraphType],
	);

	const enableAllAgentTools = () =>
		updateField(
			"tools",
			currentGraphType === "agent" ? [...availableTools] : [...agentNodeTools],
		);
	const disableAllAgentTools = () => updateField("tools", []);

	const toggleExpand = (id: string) =>
		setExpandedId((prev) => (prev === id ? null : id));

	if (isLoading) {
		return (
			<div className="flex items-center justify-center h-full">
				<div className="text-sm text-muted-foreground">
					{t("agentSettings.loading")}
				</div>
			</div>
		);
	}

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
							value={systemPromptValue}
							onChange={(e) => handleSystemPromptChange(e.target.value)}
							className="min-h-[120px] font-mono text-xs resize-y w-full"
						/>
						<div className="flex items-center justify-between">
							<p className="text-[10px] text-muted-foreground">
								{t("agentSettings.systemPromptHint")}
							</p>
							<span className="text-[10px] text-muted-foreground">
								{t("agentSettings.charCount", {
									count: systemPromptValue.length,
								})}
							</span>
						</div>
					</div>

					<Separator />

					{/* Base Graph Selector — interactive segmented control */}
					<div className="space-y-2">
						<Label className="text-xs font-medium">
							{t("agentSettings.baseGraph")}
						</Label>
						<div className="flex rounded-md border overflow-hidden">
							<button
								type="button"
								className={cn(
									"flex-1 px-3 py-2 text-xs font-medium transition-colors",
									currentGraphType === "knowledge-rag"
										? "bg-primary text-primary-foreground"
										: "bg-background text-muted-foreground hover:bg-muted",
								)}
								onClick={() => setGraphType("knowledge-rag")}
							>
								{t("agentSettings.graphKnowledgeRAG")}
							</button>
							<button
								type="button"
								className={cn(
									"flex-1 px-3 py-2 text-xs font-medium border-l transition-colors",
									currentGraphType === "agent"
										? "bg-primary text-primary-foreground"
										: "bg-background text-muted-foreground hover:bg-muted",
								)}
								onClick={() => setGraphType("agent")}
							>
								{t("agentSettings.graphAgent")}
							</button>
						</div>
						<p className="text-[10px] text-muted-foreground">
							{currentGraphType === "knowledge-rag"
								? t("agentSettings.graphKnowledgeRAGDesc")
								: t("agentSettings.graphAgentDesc")}
						</p>
					</div>

					{/* knowledge-rag specific: Features section */}
					{currentGraphType === "knowledge-rag" &&
						featureDefinitions.length > 0 && (
							<>
								<Separator />
								<div className="space-y-3">
									<Label className="text-xs font-medium">
										{t("agentSettings.features")}
									</Label>

									<div className="space-y-2">
										{featureDefinitions.map((feature) => {
											const isExpanded = expandedId === feature.name;

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

											const displayName =
												feature.type === "config"
													? t(feature.nameKey)
													: feature.name;

											const displayDesc =
												feature.type === "config"
													? t(feature.descKey)
													: feature.description;

											const hasDetail =
												feature.type === "config"
													? Boolean(feature.promptField)
													: true;

											return (
												<div
													key={feature.name}
													className="rounded-md border px-3 py-2 space-y-2"
												>
													{/* Header row */}
													<div className="flex items-start justify-between gap-3">
														<div className="space-y-0.5">
															<p className="text-xs font-medium">
																{displayName}
															</p>
															<p className="text-[10px] text-muted-foreground leading-tight">
																{displayDesc}
															</p>
														</div>
														<Switch
															checked={enabled}
															onCheckedChange={onToggle}
														/>
													</div>

													{/* Tool count (catalog only) + detail toggle */}
													{(feature.type === "catalog" || hasDetail) && (
														<div className="flex items-center justify-between">
															{feature.type === "catalog" ? (
																<p className="text-[10px] text-muted-foreground">
																	{t("agentSettings.toolCount", {
																		count: feature.tools.length,
																	})}
																</p>
															) : (
																<span />
															)}
															{hasDetail && (
																<Button
																	variant="ghost"
																	size="sm"
																	className="h-6 px-2 text-[10px]"
																	onClick={() => toggleExpand(feature.name)}
																>
																	{isExpanded ? (
																		<>
																			<ChevronUp size={10} className="mr-1" />
																			{t("agentSettings.hideDetail")}
																		</>
																	) : (
																		<>
																			<ChevronDown size={10} className="mr-1" />
																			{t("agentSettings.detail")}
																		</>
																	)}
																</Button>
															)}
														</div>
													)}

													{/* Inline expanded detail */}
													{isExpanded && (
														<div className="space-y-3 pt-2 border-t">
															{feature.type === "config" &&
																feature.promptField && (
																	<>
																		<Label className="text-xs font-medium">
																			{t(feature.promptField.labelKey)}
																		</Label>
																		<Textarea
																			value={contextPromptValue}
																			onChange={(e) =>
																				handleContextPromptChange(
																					e.target.value,
																				)
																			}
																			className="min-h-[120px] font-mono text-xs resize-y w-full"
																		/>
																		<p className="text-[10px] text-muted-foreground">
																			{t(feature.promptField.hintKey)}
																		</p>
																	</>
																)}

															{feature.type === "catalog" && (
																<>
																	<div className="space-y-1">
																		<p className="text-[10px] font-medium text-muted-foreground">
																			{t("agentSettings.featureTools")}
																		</p>
																		<div className="flex flex-wrap gap-1">
																			{feature.tools.map((tool) => (
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
																			value={feature.systemPrompt}
																			readOnly
																			className="min-h-[140px] font-mono text-xs resize-y w-full"
																		/>
																	</div>
																</>
															)}
														</div>
													)}
												</div>
											);
										})}
									</div>
								</div>
							</>
						)}

					<Separator />

					{/* Agent Tools — tools passed directly to the agent node */}
					<div className="space-y-3">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-1.5">
								<Wrench size={12} className="text-muted-foreground" />
								<Label className="text-xs font-medium">
									{t("agentSettings.agentTools")}
								</Label>
							</div>
							<div className="flex items-center gap-1">
								<Button
									variant="ghost"
									size="sm"
									onClick={enableAllAgentTools}
									className="h-6 px-2 text-[10px]"
								>
									{t("agentSettings.enableAll")}
								</Button>
								<Button
									variant="ghost"
									size="sm"
									onClick={disableAllAgentTools}
									className="h-6 px-2 text-[10px]"
								>
									{t("agentSettings.disableAll")}
								</Button>
							</div>
						</div>
						<p className="text-[10px] text-muted-foreground -mt-1">
							{currentGraphType === "knowledge-rag"
								? t("agentSettings.agentToolsHintRAG")
								: t("agentSettings.agentToolsHintAgent")}
						</p>

						<div className="space-y-2">
							{agentNodeTools.map((toolName) => {
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
