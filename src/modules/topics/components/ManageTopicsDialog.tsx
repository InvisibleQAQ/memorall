/**
 * ManageTopicsDialog Component
 * Dialog for viewing, editing, and deleting all topics
 */

import React, { useState, useEffect } from "react";
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

interface TopicWithFileCount extends Topic {
	fileCount: number;
}

interface ManageTopicsDialogProps {
	/** Whether dialog is open */
	open: boolean;
	/** Callback when dialog should close */
	onOpenChange: (open: boolean) => void;
	/** Callback when a topic is edited */
	onEditTopic?: (topic: Topic) => void;
	/** Callback when topics are updated */
	onTopicsChanged?: () => void;
	/** Callback to create a new topic */
	onCreateTopic?: () => void;
}

export const ManageTopicsDialog: React.FC<ManageTopicsDialogProps> = ({
	open,
	onOpenChange,
	onEditTopic,
	onTopicsChanged,
	onCreateTopic,
}) => {
	const [topics, setTopics] = useState<TopicWithFileCount[]>([]);
	const [loading, setLoading] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [deletingTopic, setDeletingTopic] = useState<Topic | null>(null);
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
	const [deleting, setDeleting] = useState(false);

	// Load topics when dialog opens
	useEffect(() => {
		if (open) {
			loadTopics();
			setSearchQuery("");
		}
	}, [open]);

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

			// Notify parent
			onTopicsChanged?.();

			// Close confirm dialog
			setShowDeleteConfirm(false);
			setDeletingTopic(null);
		} catch (error) {
			logError("[MANAGE_TOPICS] Failed to delete topic:", error);
		} finally {
			setDeleting(false);
		}
	};

	const handleEditClick = (topic: Topic) => {
		onEditTopic?.(topic);
	};

	const handleCreateClick = () => {
		onOpenChange(false);
		onCreateTopic?.();
	};

	return (
		<>
			<Dialog open={open} onOpenChange={onOpenChange}>
				<DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<Tags className="h-5 w-5 text-primary" />
							Manage Topics
						</DialogTitle>
						<DialogDescription>
							View, edit, and organize all your topics in one place.
						</DialogDescription>
					</DialogHeader>

					{/* Search */}
					<div className="relative">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
						<Input
							placeholder="Search topics..."
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
										{searchQuery ? "No topics found" : "No topics created yet"}
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
														{topic.fileCount} file
														{topic.fileCount !== 1 ? "s" : ""}
													</Badge>
													<span>
														Created{" "}
														{new Date(topic.createdAt).toLocaleDateString()}
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
														Edit
													</DropdownMenuItem>
													<DropdownMenuSeparator />
													<DropdownMenuItem
														onClick={() => handleDeleteClick(topic)}
														className="text-destructive"
													>
														<Trash2 className="h-4 w-4 mr-2" />
														Delete
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
							New Topic
						</Button>
						<Button variant="outline" onClick={() => onOpenChange(false)}>
							Close
						</Button>
					</div>
				</DialogContent>
			</Dialog>

			{/* Delete Confirmation Dialog */}
			<AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete Topic?</AlertDialogTitle>
						<AlertDialogDescription>
							Are you sure you want to delete "{deletingTopic?.name}"?
							<br />
							<br />
							This will remove the topic from all associated files. This action
							cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleDeleteConfirm}
							disabled={deleting}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							{deleting ? (
								<>
									<Loader2 className="h-4 w-4 mr-2 animate-spin" />
									Deleting...
								</>
							) : (
								"Delete"
							)}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
};
