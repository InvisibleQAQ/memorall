import React from "react";
import { useTranslation } from "react-i18next";
import NiceModal from "@ebay/nice-modal-react";
import {
	MoreHorizontal,
	RotateCcw,
	Save,
	Sparkles,
	Trash2,
	Undo2,
} from "lucide-react";
import { Button } from "@/main/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/main/components/ui/dropdown-menu";
import {
	AgentDeleteDialog,
	AgentResetConfigDialog,
} from "../AgentConfigFormDialogs";
import type { AgentPresetDraft } from "../../types";
import type { Topic } from "@/services/database/types";
import type { AgentConfigFormActions } from "./types";

export const AgentInlineActions: React.FC<{
	formActions?: AgentConfigFormActions;
	metadataDraft: AgentPresetDraft;
	memoryTopic?: Topic | null;
}> = ({ formActions, metadataDraft, memoryTopic }) => {
	const { t } = useTranslation("agents");

	if (!formActions) return null;

	const openResetConfigDialog = () => {
		void NiceModal.show(AgentResetConfigDialog, {
			onResetConfig: formActions.onResetConfig,
		});
	};

	const openDeleteDialog = () => {
		void NiceModal.show(AgentDeleteDialog, {
			agentName: metadataDraft.name,
			memoryTopic,
			canDelete: formActions.canDelete,
			isDeleting: formActions.isDeleting,
			onDelete: formActions.onDelete,
		});
	};

	return (
		<div className="flex shrink-0 items-center gap-1">
			{formActions.hasUnsavedChanges && (
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className="h-8 px-2.5 text-xs"
					onClick={formActions.onRevert}
					disabled={formActions.isBusy}
				>
					<Undo2 size={13} className="mr-1" />
					{t("actions.revert")}
				</Button>
			)}

			{formActions.onOptimize ? (
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground"
					onClick={formActions.onOptimize}
					disabled={!formActions.canOptimize || formActions.isBusy}
				>
					<Sparkles size={13} className="mr-1" />
					{t("actions.optimize")}
				</Button>
			) : null}

			<Button
				type="button"
				size="sm"
				className="h-8 px-3 text-xs"
				onClick={formActions.onSave}
				disabled={!formActions.canSave}
			>
				<Save size={13} className="mr-1" />
				{formActions.isBusy
					? t("actions.saving")
					: (formActions.saveLabel ?? t("actions.save"))}
			</Button>

			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0">
						<MoreHorizontal size={15} />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-44">
					<DropdownMenuItem onSelect={openResetConfigDialog}>
						<RotateCcw size={13} className="mr-2" />
						{t("actions.resetConfig")}
					</DropdownMenuItem>
					<DropdownMenuSeparator />
					<DropdownMenuItem
						className="text-destructive focus:text-destructive"
						disabled={!formActions.canDelete || formActions.isDeleting}
						onSelect={openDeleteDialog}
					>
						<Trash2 size={13} className="mr-2" />
						{t("actions.delete")}
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
};
