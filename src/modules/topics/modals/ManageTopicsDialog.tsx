/**
 * ManageTopicsDialog Modal
 * Dialog for viewing, editing, and deleting all topics using nice-modal
 */

import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import NiceModal, { useModal } from "@ebay/nice-modal-react";
import {
	Edit2,
	Loader2,
	MoreVertical,
	Plus,
	Search,
	Tags,
	Trash2,
	X,
} from "lucide-react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { topicService } from "@/modules/topics/services/topic-service";
import type { Topic } from "@/services/database/entities/topics";
import { logError, logInfo } from "@/utils/logger";
import { EditTopicDialog } from "./EditTopicDialog";
import { CreateTopicDialog } from "./CreateTopicDialog";

interface TopicWithFileCount extends Topic {
	fileCount: number;
}

export const ManageTopicsDialog = NiceModal.create(() => {
	const modal = useModal();
	const { t } = useTranslation("topics");
	const [topics, setTopics] = useState<TopicWithFileCount[]>([]);
	const [loading, setLoading] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [deletingTopic, setDeletingTopic] = useState<Topic | null>(null);
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
	const [deleting, setDeleting] = useState(false);

	// Load topics when dialog opens
	useEffect(() => {
		if (modal.visible) {
			loadTopics();
			setSearchQuery("");
		}
	}, [modal.visible]);

	const loadTopics = async () => {
		try {
			setLoading(true);
			const topicsData = await topicService.getTopicsWithContentCount();
			setTopics(topicsData);
			logInfo("[MANAGE_TOPICS] Loaded topics:", topicsData.length);
		} catch (error) {
			logError("[MANAGE_TOPICS] Failed to load topics:", error);
		} finally {
			setLoading(false);
		}
	};

	// Filter topics based on search
	const filteredTopics = React.useMemo(() => {
		if (!searchQuery.trim()) return topics;

		const query = searchQuery.toLowerCase();
		return topics.filter(
			(topic) =>
				topic.name.toLowerCase().includes(query) ||
				(topic.description && topic.description.toLowerCase().includes(query)),
		);
	}, [topics, searchQuery]);

	const handleDeleteClick = (topic: Topic) => {
		setDeletingTopic(topic);
		setShowDeleteConfirm(true);
	};

	const handleDeleteConfirm = async () => {
		if (!deletingTopic) return;

		try {
			setDeleting(true);
			await topicService.deleteTopic(deletingTopic.id);

			// Remove from local list
			setTopics((prev) => prev.filter((t) => t.id !== deletingTopic.id));

			logInfo("[MANAGE_TOPICS] Deleted topic:", deletingTopic);

			// Notify parent via resolve
			modal.resolve({ action: "deleted", topicId: deletingTopic.id });

			// Close confirm dialog
			setShowDeleteConfirm(false);
			setDeletingTopic(null);
		} catch (error) {
			logError("[MANAGE_TOPICS] Failed to delete topic:", error);
		} finally {
			setDeleting(false);
		}
	};

	const handleEditClick = async (topic: Topic) => {
		const updatedTopic = await NiceModal.show(EditTopicDialog, { topic });
		if (updatedTopic) {
			// Reload topics to reflect changes
			await loadTopics();
			modal.resolve({ action: "updated", topic: updatedTopic });
		}
	};

	const handleCreateClick = async () => {
		const newTopic = await NiceModal.show(CreateTopicDialog);
		if (newTopic) {
			// Reload topics to include the new one
			await loadTopics();
			modal.resolve({ action: "created", topic: newTopic });
		}
	};

	return (
		<>
			<Dialog
				open={modal.visible}
				onOpenChange={(open) => !open && modal.hide()}
			>
				<DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<Tags className="h-5 w-5 text-primary" />
							{t("manage.title")}
						</DialogTitle>
						<DialogDescription>{t("manage.description")}</DialogDescription>
					</DialogHeader>

					{/* Search */}
					<div className="relative">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
						<Input
							placeholder={t("manage.searchPlaceholder")}
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="pl-9 pr-9"
						/>
						{searchQuery && (
							<button
								type="button"
								onClick={() => setSearchQuery("")}
								className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
							>
								<X className="h-4 w-4" />
							</button>
						)}
					</div>

					{/* Topics List */}
					{loading ? (
						<div className="flex items-center justify-center py-12">
							<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
						</div>
					) : (
						<ScrollArea className="flex-1 -mx-6 px-6">
							{filteredTopics.length === 0 ? (
								<div className="py-12 text-center text-muted-foreground">
									<Tags className="h-12 w-12 mx-auto mb-3 opacity-50" />
									<p className="text-sm">
										{searchQuery
											? t("manage.noTopicsFound")
											: t("manage.noTopicsCreated")}
									</p>
								</div>
							) : (
								<div className="space-y-2">
									{filteredTopics.map((topic) => (
										<div
											key={topic.id}
											className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors group"
										>
											<Tags className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />

											<div className="flex-1 min-w-0">
												<h3 className="font-medium text-sm mb-1">
													{topic.name}
												</h3>
												<p className="text-xs text-muted-foreground line-clamp-2 mb-2">
													{topic.description}
												</p>
												<div className="flex items-center gap-2 text-xs text-muted-foreground">
													<Badge variant="secondary" className="text-xs">
														{t("manage.fileCount", { count: topic.fileCount })}
													</Badge>
													<span>
														{t("manage.createdDate", {
															date: new Date(
																topic.createdAt,
															).toLocaleDateString(),
														})}
													</span>
												</div>
											</div>

											<DropdownMenu>
												<DropdownMenuTrigger asChild>
													<Button
														variant="ghost"
														size="sm"
														className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
													>
														<MoreVertical className="h-4 w-4" />
													</Button>
												</DropdownMenuTrigger>
												<DropdownMenuContent align="end">
													<DropdownMenuItem
														onClick={() => handleEditClick(topic)}
													>
														<Edit2 className="h-4 w-4 mr-2" />
														{t("manage.edit")}
													</DropdownMenuItem>
													<DropdownMenuSeparator />
													<DropdownMenuItem
														onClick={() => handleDeleteClick(topic)}
														className="text-destructive"
													>
														<Trash2 className="h-4 w-4 mr-2" />
														{t("manage.delete")}
													</DropdownMenuItem>
												</DropdownMenuContent>
											</DropdownMenu>
										</div>
									))}
								</div>
							)}
						</ScrollArea>
					)}

					{/* Footer */}
					<div className="flex items-center justify-between pt-4 border-t">
						<Button
							variant="outline"
							size="sm"
							onClick={handleCreateClick}
							className="gap-2"
						>
							<Plus className="h-4 w-4" />
							{t("manage.newTopic")}
						</Button>
						<Button variant="outline" onClick={() => modal.hide()}>
							{t("manage.close")}
						</Button>
					</div>
				</DialogContent>
			</Dialog>

			{/* Delete Confirmation Dialog */}
			<AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							{t("manage.deleteConfirmTitle")}
						</AlertDialogTitle>
						<AlertDialogDescription>
							{t("manage.deleteConfirmMessage", { name: deletingTopic?.name })}
							<br />
							<br />
							{t("manage.deleteWarning")}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={deleting}>
							{t("manage.cancel")}
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleDeleteConfirm}
							disabled={deleting}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							{deleting ? (
								<>
									<Loader2 className="h-4 w-4 mr-2 animate-spin" />
									{t("manage.deleting")}
								</>
							) : (
								t("manage.deleteButton")
							)}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
});
