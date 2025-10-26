/**
 * TopicSelectorDialog Component
 * Dialog for managing topics assigned to a file
 */

import React, { useState, useMemo, useEffect } from "react";
import { Check, Loader2, Plus, Search, Tags, X } from "lucide-react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { topicService } from "@/modules/topics/services/topic-service";
import type { Topic } from "@/services/database/entities/topics";
import { logError, logInfo } from "@/utils/logger";

interface TopicSelectorDialogProps {
	/** Whether dialog is open */
	open: boolean;
	/** Callback when dialog should close */
	onOpenChange: (open: boolean) => void;
	/** File path being edited */
	filePath: string;
	/** File name for display */
	fileName: string;
	/** Initial selected topic IDs */
	initialTopicIds: string[];
	/** Callback when topics are saved */
	onSave: (topicIds: string[]) => void;
}

type ViewMode = "select" | "create";

export const TopicSelectorDialog: React.FC<TopicSelectorDialogProps> = ({
	open,
	onOpenChange,
	filePath,
	fileName,
	initialTopicIds,
	onSave,
}) => {
	// State
	const [viewMode, setViewMode] = useState<ViewMode>("select");
	const [loading, setLoading] = useState(false);
	const [saving, setSaving] = useState(false);
	const [topics, setTopics] = useState<Topic[]>([]);
	const [selectedTopicIds, setSelectedTopicIds] =
		useState<string[]>(initialTopicIds);
	const [searchQuery, setSearchQuery] = useState("");

	// Create new topic state
	const [newTopicName, setNewTopicName] = useState("");
	const [newTopicDescription, setNewTopicDescription] = useState("");
	const [creating, setCreating] = useState(false);

	// Load topics when dialog opens
	useEffect(() => {
		if (open) {
			loadTopics();
			setSelectedTopicIds(initialTopicIds);
			setViewMode("select");
			setSearchQuery("");
		}
	}, [open, initialTopicIds]);

	// Load all topics
	const loadTopics = async () => {
		try {
			setLoading(true);
			const allTopics = await topicService.getTopics();
			setTopics(allTopics);
		} catch (error) {
			logError("[TOPIC_SELECTOR] Failed to load topics:", error);
		} finally {
			setLoading(false);
		}
	};

	// Filter topics based on search
	const filteredTopics = useMemo(() => {
		if (!searchQuery.trim()) return topics;

		const query = searchQuery.toLowerCase();
		return topics.filter(
			(topic) =>
				topic.name.toLowerCase().includes(query) ||
				(topic.description && topic.description.toLowerCase().includes(query)),
		);
	}, [topics, searchQuery]);

	// Toggle topic selection
	const handleToggleTopic = (topicId: string) => {
		setSelectedTopicIds((prev) =>
			prev.includes(topicId)
				? prev.filter((id) => id !== topicId)
				: [...prev, topicId],
		);
	};

	// Create new topic
	const handleCreateTopic = async () => {
		if (!newTopicName.trim() || !newTopicDescription.trim()) return;

		try {
			setCreating(true);
			const newTopic = await topicService.createTopic({
				name: newTopicName.trim(),
				description: newTopicDescription.trim(),
			});

			// Add to topics list and select it
			setTopics((prev) => [newTopic, ...prev]);
			setSelectedTopicIds((prev) => [...prev, newTopic.id]);

			// Reset form and go back to select mode
			setNewTopicName("");
			setNewTopicDescription("");
			setViewMode("select");

			logInfo("[TOPIC_SELECTOR] Created new topic:", newTopic);
		} catch (error) {
			logError("[TOPIC_SELECTOR] Failed to create topic:", error);
		} finally {
			setCreating(false);
		}
	};

	// Save topic selections
	const handleSave = async () => {
		try {
			setSaving(true);
			await topicService.setFileTopics(filePath, selectedTopicIds);
			onSave(selectedTopicIds);
			onOpenChange(false);
			logInfo("[TOPIC_SELECTOR] Saved topics for file:", {
				filePath,
				topicIds: selectedTopicIds,
			});
		} catch (error) {
			logError("[TOPIC_SELECTOR] Failed to save topics:", error);
		} finally {
			setSaving(false);
		}
	};

	// Check if selection has changed
	const hasChanges = useMemo(() => {
		if (selectedTopicIds.length !== initialTopicIds.length) return true;
		return !selectedTopicIds.every((id) => initialTopicIds.includes(id));
	}, [selectedTopicIds, initialTopicIds]);

	const selectedCount = selectedTopicIds.length;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[500px]">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Tags className="h-5 w-5 text-primary" />
						Manage Topics
					</DialogTitle>
					<DialogDescription className="truncate">{fileName}</DialogDescription>
				</DialogHeader>

				{viewMode === "select" ? (
					<>
						{/* Topic Selection View */}
						<div className="space-y-4">
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

							{/* Selection Info */}
							{selectedCount > 0 && (
								<div className="text-sm text-muted-foreground">
									{selectedCount} topic{selectedCount > 1 ? "s" : ""} selected
								</div>
							)}

							{/* Topics List */}
							{loading ? (
								<div className="flex items-center justify-center py-8">
									<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
								</div>
							) : (
								<ScrollArea className="h-[300px] border rounded-md">
									<div className="p-2 space-y-1">
										{filteredTopics.length === 0 ? (
											<div className="py-8 text-center text-sm text-muted-foreground">
												{searchQuery
													? "No topics found"
													: "No topics available"}
											</div>
										) : (
											filteredTopics.map((topic) => {
												const isSelected = selectedTopicIds.includes(topic.id);

												return (
													<button
														key={topic.id}
														type="button"
														onClick={() => handleToggleTopic(topic.id)}
														className={cn(
															"w-full flex items-start gap-3 p-3 rounded-lg transition-colors",
															"hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
															isSelected && "bg-muted",
														)}
													>
														{/* Checkbox */}
														<div
															className={cn(
																"h-5 w-5 border rounded flex items-center justify-center flex-shrink-0 mt-0.5",
																isSelected
																	? "bg-primary border-primary"
																	: "border-input",
															)}
														>
															{isSelected && (
																<Check className="h-3.5 w-3.5 text-primary-foreground" />
															)}
														</div>

														{/* Topic Info */}
														<div className="flex-1 text-left min-w-0">
															<div className="font-medium text-sm">
																{topic.name}
															</div>
															{topic.description && (
																<div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
																	{topic.description}
																</div>
															)}
														</div>
													</button>
												);
											})
										)}
									</div>
								</ScrollArea>
							)}

							{/* Create New Topic Button */}
							<Button
								variant="outline"
								onClick={() => setViewMode("create")}
								className="w-full gap-2"
							>
								<Plus className="h-4 w-4" />
								Create New Topic
							</Button>
						</div>

						<DialogFooter>
							<Button
								variant="outline"
								onClick={() => onOpenChange(false)}
								disabled={saving}
							>
								Cancel
							</Button>
							<Button onClick={handleSave} disabled={saving || !hasChanges}>
								{saving ? (
									<>
										<Loader2 className="h-4 w-4 mr-2 animate-spin" />
										Saving...
									</>
								) : (
									"Save"
								)}
							</Button>
						</DialogFooter>
					</>
				) : (
					<>
						{/* Create Topic View */}
						<div className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="new-topic-name">Topic Name *</Label>
								<Input
									id="new-topic-name"
									placeholder="e.g., Machine Learning, React Development..."
									value={newTopicName}
									onChange={(e) => setNewTopicName(e.target.value)}
									onKeyDown={(e) => {
										if (
											e.key === "Enter" &&
											newTopicName.trim() &&
											newTopicDescription.trim()
										) {
											handleCreateTopic();
										}
									}}
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="new-topic-description">Goal & Purpose *</Label>
								<Textarea
									id="new-topic-description"
									placeholder="Describe what you want to achieve with this topic. What specific knowledge or skills are you building?"
									value={newTopicDescription}
									onChange={(e) => setNewTopicDescription(e.target.value)}
									rows={3}
								/>
								<p className="text-xs text-muted-foreground">
									Example: "Learn modern React patterns and best practices for
									building scalable web applications"
								</p>
							</div>
						</div>

						<DialogFooter>
							<Button
								variant="outline"
								onClick={() => setViewMode("select")}
								disabled={creating}
							>
								Back
							</Button>
							<Button
								onClick={handleCreateTopic}
								disabled={
									!newTopicName.trim() ||
									!newTopicDescription.trim() ||
									creating
								}
							>
								{creating ? (
									<>
										<Loader2 className="h-4 w-4 mr-2 animate-spin" />
										Creating...
									</>
								) : (
									<>
										<Plus className="h-4 w-4 mr-2" />
										Create & Add
									</>
								)}
							</Button>
						</DialogFooter>
					</>
				)}
			</DialogContent>
		</Dialog>
	);
};
