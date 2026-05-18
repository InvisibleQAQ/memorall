import React from "react";
import NiceModal, { useModal } from "@ebay/nice-modal-react";
import { useTranslation } from "react-i18next";
import { Network, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/main/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/main/components/ui/dialog";
import type { Topic } from "@/services/database/types";

interface AgentDeleteDialogProps {
	agentName?: string;
	memoryTopic?: Topic | null;
	canDelete: boolean;
	isDeleting: boolean;
	onDelete: (options?: { deleteLinkedMemory: boolean }) => void;
}

interface AgentResetConfigDialogProps {
	onResetConfig: () => void;
}

export const AgentDeleteDialog = NiceModal.create<AgentDeleteDialogProps>(
	({ agentName, memoryTopic, canDelete, isDeleting, onDelete }) => {
		const modal = useModal();
		const { t } = useTranslation(["agents"]);
		const ta = (key: string, opts?: Record<string, unknown>) =>
			t(key, { ns: "agents", ...opts });
		const [deleteLinkedMemory, setDeleteLinkedMemory] = React.useState(
			Boolean(memoryTopic),
		);

		React.useEffect(() => {
			if (!modal.visible) return;
			setDeleteLinkedMemory(Boolean(memoryTopic));
		}, [modal.visible, memoryTopic]);

		const handleCancel = () => {
			modal.hide();
		};

		const handleDelete = () => {
			onDelete({
				deleteLinkedMemory: Boolean(memoryTopic) && deleteLinkedMemory,
			});
			modal.hide();
		};

		return (
			<Dialog
				open={modal.visible}
				onOpenChange={(open) => !open && handleCancel()}
			>
				<DialogContent className="w-[calc(100vw-1rem)] max-w-[460px] overflow-hidden gap-0 rounded-2xl border-border/60 p-0 shadow-2xl">
					<DialogHeader className="border-b px-5 pb-4 pt-5">
						<div className="flex items-start gap-3">
							<span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
								<Trash2 size={17} />
							</span>
							<div className="min-w-0 space-y-1">
								<DialogTitle className="text-base">
									{ta("delete.title")}
								</DialogTitle>
								<DialogDescription className="text-sm leading-relaxed">
									{ta("delete.description", {
										name: agentName || ta("overview.untitled"),
									})}
								</DialogDescription>
							</div>
						</div>
					</DialogHeader>

					<div className="space-y-3 px-5 py-4">
						{!canDelete ? (
							<div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
								{ta("delete.lastPresetHint")}
							</div>
						) : null}

						{memoryTopic ? (
							<label
								htmlFor="delete-linked-memory"
								className="flex cursor-pointer gap-3 rounded-xl border border-emerald-500/50 bg-emerald-500/10 p-3 text-sm transition-colors hover:bg-emerald-500/15"
							>
								<input
									id="delete-linked-memory"
									type="checkbox"
									checked={deleteLinkedMemory}
									onChange={(event) =>
										setDeleteLinkedMemory(event.target.checked)
									}
									className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-500"
								/>
								<span className="min-w-0 space-y-1">
									<span className="flex items-center gap-1.5 font-medium text-foreground">
										<Network size={14} />
										{ta("delete.linkedMemoryTitle")}
									</span>
									<span className="block text-xs leading-relaxed text-muted-foreground">
										{ta("delete.linkedMemoryDescription", {
											name: memoryTopic.name,
										})}
									</span>
								</span>
							</label>
						) : (
							<div className="flex items-center gap-1.5 rounded-xl border border-border/50 bg-muted/40 p-3 text-sm text-muted-foreground">
								<Network size={14} className="shrink-0" />
								{ta("delete.noLinkedMemory")}
							</div>
						)}
					</div>

					<DialogFooter className="border-t px-5 py-4">
						<Button type="button" variant="outline" onClick={handleCancel}>
							{ta("actions.cancel")}
						</Button>
						<Button
							type="button"
							variant="destructive"
							onClick={handleDelete}
							disabled={!canDelete || isDeleting}
						>
							{ta("actions.delete")}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		);
	},
);

export const AgentResetConfigDialog =
	NiceModal.create<AgentResetConfigDialogProps>(({ onResetConfig }) => {
		const modal = useModal();
		const { t } = useTranslation(["agents"]);
		const ta = (key: string, opts?: Record<string, unknown>) =>
			t(key, { ns: "agents", ...opts });

		const handleCancel = () => {
			modal.hide();
		};

		const handleReset = () => {
			onResetConfig();
			modal.hide();
		};

		return (
			<Dialog
				open={modal.visible}
				onOpenChange={(open) => !open && handleCancel()}
			>
				<DialogContent className="w-[calc(100vw-1rem)] max-w-[420px] overflow-hidden gap-0 rounded-2xl border-border/60 p-0 shadow-2xl">
					<DialogHeader className="border-b px-5 pb-4 pt-5">
						<div className="flex items-start gap-3">
							<span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
								<RotateCcw size={17} />
							</span>
							<div className="min-w-0 space-y-1">
								<DialogTitle className="text-base">
									{ta("reset.title")}
								</DialogTitle>
								<DialogDescription className="text-sm leading-relaxed">
									{ta("reset.description")}
								</DialogDescription>
							</div>
						</div>
					</DialogHeader>

					<DialogFooter className="border-t px-5 py-4">
						<Button type="button" variant="outline" onClick={handleCancel}>
							{ta("actions.cancel")}
						</Button>
						<Button type="button" onClick={handleReset}>
							{ta("actions.resetConfig")}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		);
	});
