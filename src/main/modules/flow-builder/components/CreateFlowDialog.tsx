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

interface CreateFlowDialogProps<TExtra = undefined> {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onCreateFlow: (name: string, extra: TExtra) => void;
	title?: string;
	description?: string;
	namePlaceholder?: string;
	submitLabel?: string;
	children?: (extraState: {
		resetToken: number;
		setExtra: (extra: TExtra) => void;
	}) => React.ReactNode;
	afterFooter?: React.ReactNode;
}

export const CreateFlowDialog = <TExtra,>({
	open,
	onOpenChange,
	onCreateFlow,
	title,
	description,
	namePlaceholder,
	submitLabel,
	children,
	afterFooter,
}: CreateFlowDialogProps<TExtra>) => {
	const { t } = useTranslation();
	const [newFlowName, setNewFlowName] = React.useState("");
	const [extra, setExtra] = React.useState<TExtra | undefined>(undefined);
	const [resetToken, setResetToken] = React.useState(0);

	const handleCreate = () => {
		if (!newFlowName.trim()) return;
		onCreateFlow(newFlowName.trim(), extra as TExtra);
		setNewFlowName("");
		setResetToken((value) => value + 1);
		onOpenChange(false);
	};

	const handleCancel = () => {
		setNewFlowName("");
		setResetToken((value) => value + 1);
		onOpenChange(false);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>
						{title ??
							t("flowBuilder.createFlow.title", {
								defaultValue: "Create Flow",
							})}
					</DialogTitle>
					<DialogDescription>
						{description ??
							t("flowBuilder.createFlow.description", {
								defaultValue: "Name your flow to start building.",
							})}
					</DialogDescription>
				</DialogHeader>
				<Input
					autoFocus
					placeholder={
						namePlaceholder ??
						t("flowBuilder.createFlow.namePlaceholder", {
							defaultValue: "Flow name",
						})
					}
					value={newFlowName}
					onChange={(event) => setNewFlowName(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === "Enter") {
							handleCreate();
						}
					}}
				/>
				{children?.({ resetToken, setExtra })}
				<DialogFooter className="gap-2 sm:gap-0">
					<Button variant="outline" onClick={handleCancel}>
						{t("buttons.cancel", { defaultValue: "Cancel" })}
					</Button>
					<Button onClick={handleCreate}>
						{submitLabel ?? t("buttons.save", { defaultValue: "Save" })}
					</Button>
				</DialogFooter>
				{afterFooter}
			</DialogContent>
		</Dialog>
	);
};
