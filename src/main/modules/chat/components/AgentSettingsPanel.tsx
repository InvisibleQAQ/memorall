import React from "react";
import { useTranslation } from "react-i18next";
import { X, Settings2, Save, Undo2, RotateCcw } from "lucide-react";
import { useAgentConfigStore } from "@/main/stores/agent-config";
import { AgentConfigForm } from "@/main/modules/agents/components/AgentConfigForm";
import { useAgentCronJobs } from "@/main/modules/agents/hooks/use-agent-cron-jobs";
import type {
	AgentPresetDraft,
	AgentPresetStatus,
} from "@/main/modules/agents/types";
import { Button } from "@/main/components/ui/button";
import { Badge } from "@/main/components/ui/badge";
import { ScrollArea } from "@/main/components/ui/scroll-area";
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

interface AgentSettingsPanelProps {
	onClose?: () => void;
}

export const AgentSettingsPanel: React.FC<AgentSettingsPanelProps> = ({
	onClose,
}) => {
	const { t } = useTranslation("chat");
	const {
		isLoading,
		isSaving,
		isDirty,
		isLegacyConfig,
		currentFlowId,
		close,
		save,
		revert,
		resetToDefaults,
	} = useAgentConfigStore();
	const cronJobs = useAgentCronJobs(currentFlowId);
	const scheduleMetadataDraft = React.useMemo<AgentPresetDraft | undefined>(
		() =>
			currentFlowId
				? {
						name: "",
						description: "",
						status: "active" satisfies AgentPresetStatus,
						iconScreen: null,
					}
				: undefined,
		[currentFlowId],
	);
	const hasUnsavedChanges = isDirty || cronJobs.hasChanges;
	const isSaveBlocked =
		!hasUnsavedChanges || isSaving || cronJobs.isSaving || isLegacyConfig;

	const handleSave = async () => {
		try {
			if (isDirty) {
				await save();
			}
			if (cronJobs.hasChanges) {
				await cronJobs.save();
			}
		} catch {
			// Schedule validation/save errors are shown by AgentCronJobsSection.
		}
	};

	const handleRevert = () => {
		if (isDirty) {
			revert();
		}
		if (cronJobs.hasChanges) {
			cronJobs.revert();
		}
	};

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
					{hasUnsavedChanges ? (
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
					onClick={onClose ?? close}
					className="h-7 w-7 p-0"
				>
					<X size={14} />
				</Button>
			</div>

			{/* Body */}
			<ScrollArea className="flex-1 min-h-0">
				<AgentConfigForm
					className="p-4"
					metadataDraft={scheduleMetadataDraft}
					cronJobs={
						currentFlowId
							? {
									drafts: cronJobs.drafts,
									isLoading: cronJobs.isLoading,
									isSaving: cronJobs.isSaving,
									error: cronJobs.error,
									onAdd: cronJobs.addDraft,
									onUpdate: cronJobs.updateDraft,
									onRemove: cronJobs.removeDraft,
								}
							: undefined
					}
				/>
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
						onClick={handleRevert}
						disabled={!hasUnsavedChanges}
						className="text-xs h-8"
					>
						<Undo2 size={12} className="mr-1" />
						{t("agentSettings.revert")}
					</Button>
					<Button
						size="sm"
						onClick={() => void handleSave()}
						disabled={isSaveBlocked}
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
