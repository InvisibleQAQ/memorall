import React from "react";
import { useTranslation } from "react-i18next";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/main/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/main/components/ui/select";
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
import type { Flow } from "@/services/database/types";

interface FlowBuilderHeaderProps {
	flows: Flow[];
	selectedFlowId: string | null;
	isDirty: boolean;
	isSaving: boolean;
	isDeleting: boolean;
	onSelectFlow: (flowId: string) => void;
	onSave: () => void;
	onDelete: () => Promise<void> | void;
	onCreateClick: () => void;
}

export const FlowBuilderHeader: React.FC<FlowBuilderHeaderProps> = ({
	flows,
	selectedFlowId,
	isDirty,
	isSaving,
	isDeleting,
	onSelectFlow,
	onSave,
	onDelete,
	onCreateClick,
}) => {
	const { t } = useTranslation();
	const [deleteOpen, setDeleteOpen] = React.useState(false);

	const selectedFlow = flows.find((flow) => flow.id === selectedFlowId) ?? null;

	const handleDeleteConfirm = async () => {
		await onDelete();
		setDeleteOpen(false);
	};

	return (
		<div className="border-b px-4 py-3 flex items-center justify-between bg-muted/20">
			<div className="flex items-center gap-3">
				<h1 className="text-lg font-semibold">
					{t("navigation.flowBuilder", { defaultValue: "Flow Builder" })}
				</h1>
				<Select value={selectedFlowId ?? ""} onValueChange={onSelectFlow}>
					<SelectTrigger className="w-60">
						<SelectValue
							placeholder={t("flowBuilder.selectFlow", {
								defaultValue: "Select flow",
							})}
						/>
					</SelectTrigger>
					<SelectContent>
						{flows.map((flow) => (
							<SelectItem key={flow.id} value={flow.id}>
								{flow.name}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<Button variant="outline" size="sm" onClick={onCreateClick}>
					<Plus className="h-4 w-4 mr-1" />
					{t("buttons.add", { defaultValue: "Add" })}
				</Button>
			</div>
			<div className="flex items-center gap-2">
				{isDirty && (
					<span className="text-xs text-muted-foreground">
						{t("status.pending", { defaultValue: "Pending" })}
					</span>
				)}
				<AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
					<AlertDialogTrigger asChild>
						<Button
							variant="outline"
							size="sm"
							className="text-destructive"
							disabled={!selectedFlowId || isSaving || isDeleting}
						>
							<Trash2 className="h-4 w-4 mr-1" />
							{t("buttons.delete", { defaultValue: "Delete" })}
						</Button>
					</AlertDialogTrigger>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>
								{t("flowBuilder.deleteTitle", { defaultValue: "Delete flow?" })}
							</AlertDialogTitle>
							<AlertDialogDescription>
								{t("flowBuilder.deleteMessage", {
									defaultValue: "This will permanently delete the flow.",
								})}
								{selectedFlow?.name
									? ` ${t("flowBuilder.deleteName", {
											defaultValue: "Flow:",
										})} ${selectedFlow.name}.`
									: ""}
								{isDirty
									? ` ${t("flowBuilder.deleteUnsavedWarning", {
											defaultValue:
												"You have unsaved changes that will be lost.",
										})}`
									: ""}
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel disabled={isDeleting}>
								{t("buttons.cancel", { defaultValue: "Cancel" })}
							</AlertDialogCancel>
							<AlertDialogAction
								onClick={handleDeleteConfirm}
								disabled={isDeleting}
								className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							>
								{isDeleting
									? t("status.deleting", { defaultValue: "Deleting..." })
									: t("buttons.delete", { defaultValue: "Delete" })}
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
				<Button
					size="sm"
					onClick={onSave}
					disabled={!selectedFlowId || isSaving || isDeleting}
				>
					{isSaving
						? t("status.saving", { defaultValue: "Saving..." })
						: t("buttons.save", { defaultValue: "Save" })}
				</Button>
			</div>
		</div>
	);
};
