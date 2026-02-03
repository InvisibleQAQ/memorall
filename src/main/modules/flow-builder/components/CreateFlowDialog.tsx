import React from "react";
import { useTranslation } from "react-i18next";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/main/components/ui/dialog";
import { Button } from "@/main/components/ui/button";
import { Input } from "@/main/components/ui/input";

interface CreateFlowDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onCreateFlow: (name: string) => void;
}

export const CreateFlowDialog: React.FC<CreateFlowDialogProps> = ({
	open,
	onOpenChange,
	onCreateFlow,
}) => {
	const { t } = useTranslation();
	const [newFlowName, setNewFlowName] = React.useState("");

	const handleCreate = () => {
		if (!newFlowName.trim()) return;
		onCreateFlow(newFlowName.trim());
		setNewFlowName("");
		onOpenChange(false);
	};

	const handleCancel = () => {
		setNewFlowName("");
		onOpenChange(false);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>
						{t("flowBuilder.createFlow.title", { defaultValue: "Create Flow" })}
					</DialogTitle>
					<DialogDescription>
						{t("flowBuilder.createFlow.description", {
							defaultValue: "Name your flow to start building.",
						})}
					</DialogDescription>
				</DialogHeader>
				<Input
					autoFocus
					placeholder={t("flowBuilder.createFlow.namePlaceholder", {
						defaultValue: "Flow name",
					})}
					value={newFlowName}
					onChange={(event) => setNewFlowName(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === "Enter") {
							handleCreate();
						}
					}}
				/>
				<DialogFooter className="gap-2 sm:gap-0">
					<Button variant="outline" onClick={handleCancel}>
						{t("buttons.cancel", { defaultValue: "Cancel" })}
					</Button>
					<Button onClick={handleCreate}>
						{t("buttons.save", { defaultValue: "Save" })}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
