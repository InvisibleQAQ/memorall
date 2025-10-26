/**
 * CreateTopicDialog Component
 * Quick dialog for creating a new topic
 */

import React, { useState, useEffect } from "react";
import { Loader2, Plus, Tags } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { topicService } from "@/modules/topics/services/topic-service";
import type { Topic } from "@/services/database/entities/topics";
import { logError, logInfo } from "@/utils/logger";

interface CreateTopicDialogProps {
	/** Whether dialog is open */
	open: boolean;
	/** Callback when dialog should close */
	onOpenChange: (open: boolean) => void;
	/** Callback when topic is created successfully */
	onTopicCreated?: (topic: Topic) => void;
}

export const CreateTopicDialog: React.FC<CreateTopicDialogProps> = ({
	open,
	onOpenChange,
	onTopicCreated,
}) => {
	const [topicName, setTopicName] = useState("");
	const [topicDescription, setTopicDescription] = useState("");
	const [creating, setCreating] = useState(false);

	// Reset form when dialog opens
	useEffect(() => {
		if (open) {
			setTopicName("");
			setTopicDescription("");
		}
	}, [open]);

	const handleCreate = async () => {
		if (!topicName.trim() || !topicDescription.trim()) return;

		try {
			setCreating(true);
			const newTopic = await topicService.createTopic({
				name: topicName.trim(),
				description: topicDescription.trim(),
			});

			logInfo("[CREATE_TOPIC_DIALOG] Created new topic:", newTopic);

			// Reset form
			setTopicName("");
			setTopicDescription("");

			// Notify parent
			onTopicCreated?.(newTopic);

			// Close dialog
			onOpenChange(false);
		} catch (error) {
			logError("[CREATE_TOPIC_DIALOG] Failed to create topic:", error);
		} finally {
			setCreating(false);
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		// Submit on Ctrl+Enter or Cmd+Enter
		if (
			(e.ctrlKey || e.metaKey) &&
			e.key === "Enter" &&
			topicName.trim() &&
			topicDescription.trim()
		) {
			handleCreate();
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[480px]">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Tags className="h-5 w-5 text-primary" />
						Create New Topic
					</DialogTitle>
					<DialogDescription>
						Organize your documents by creating focused topics for different
						areas of knowledge.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 py-4" onKeyDown={handleKeyDown}>
					<div className="space-y-2">
						<Label htmlFor="topic-name">Topic Name *</Label>
						<Input
							id="topic-name"
							placeholder="e.g., Machine Learning, React Development..."
							value={topicName}
							onChange={(e) => setTopicName(e.target.value)}
							autoFocus
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="topic-description">Goal & Purpose *</Label>
						<Textarea
							id="topic-description"
							placeholder="Describe what you want to achieve with this topic. What specific knowledge or skills are you building? This helps organize relevant information effectively."
							value={topicDescription}
							onChange={(e) => setTopicDescription(e.target.value)}
							rows={3}
						/>
						<p className="text-xs text-muted-foreground">
							Example: "Learn modern React patterns and best practices for
							building scalable web applications"
						</p>
					</div>

					<p className="text-xs text-muted-foreground">
						💡 Tip: Press{" "}
						<kbd className="px-1 py-0.5 bg-muted rounded text-xs">
							Ctrl+Enter
						</kbd>{" "}
						to create quickly
					</p>
				</div>

				<DialogFooter>
					<Button
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={creating}
					>
						Cancel
					</Button>
					<Button
						onClick={handleCreate}
						disabled={!topicName.trim() || !topicDescription.trim() || creating}
					>
						{creating ? (
							<>
								<Loader2 className="h-4 w-4 mr-2 animate-spin" />
								Creating...
							</>
						) : (
							<>
								<Plus className="h-4 w-4 mr-2" />
								Create Topic
							</>
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
