import React from "react";
import { useTranslation } from "react-i18next";
import { X, Settings2, Save, Undo2, RotateCcw } from "lucide-react";
import { useAgentConfigStore } from "@/main/stores/agent-config";
import { TOOL_DISPLAY_INFO } from "@/main/modules/chat/utils/tool-display-info";
import {
	DEFAULT_KNOWLEDGE_RAG_CONTEXT_PROMPT,
	DEFAULT_KNOWLEDGE_RAG_SYSTEM_PROMPT,
} from "@/services/flows/graph/knowledge-rag/state";
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

export const AgentSettingsPanel: React.FC = () => {
	const { t } = useTranslation("chat");
	const {
		draftConfig,
		availableTools,
		isLoading,
		isSaving,
		isDirty,
		close,
		updateField,
		toggleTool,
		save,
		revert,
		resetToDefaults,
	} = useAgentConfigStore();

	if (isLoading) {
		return (
			<div className="flex items-center justify-center h-full">
				<div className="text-sm text-muted-foreground">Loading...</div>
			</div>
		);
	}

	const enableAllTools = () => {
		updateField("tools", [...availableTools]);
	};

	const disableAllTools = () => {
		updateField("tools", []);
	};

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
								<Label className="text-xs font-medium">Context Prompt</Label>
								<Textarea
									value={draftConfig.contextPrompt}
									onChange={(e) => updateField("contextPrompt", e.target.value)}
									placeholder={DEFAULT_KNOWLEDGE_RAG_CONTEXT_PROMPT}
									className="min-h-[120px] font-mono text-xs resize-y"
								/>
								<p className="text-[10px] text-muted-foreground">
									Default prompt is shown when empty. If {"{context}"} is
									missing, it is appended at the bottom.
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

					{/* Tools */}
					<div className="space-y-3">
						<div className="flex items-center justify-between">
							<Label className="text-xs font-medium">
								{t("agentSettings.tools")}
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
							{availableTools.map((toolName) => {
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
							<AlertDialogCancel>Cancel</AlertDialogCancel>
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
