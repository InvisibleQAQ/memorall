/**
 * EditTopicDialog Component
 * Dialog for editing an existing topic
 */

import React, { useState, useEffect } from "react";
import { Edit2, Loader2, Tags } from "lucide-react";
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

interface EditTopicDialogProps {
	/** Whether dialog is open */
	open: boolean;
	/** Callback when dialog should close */
	onOpenChange: (open: boolean) => void;
	/** Topic to edit */
	topic: Topic | null;
	/** Callback when topic is updated successfully */
	onTopicUpdated?: (topic: Topic) => void;
}

export const EditTopicDialog: React.FC<EditTopicDialogProps> = ({
	open,
	onOpenChange,
	topic,
	onTopicUpdated,
}) => {
	const [topicName, setTopicName] = useState("");
	const [topicDescription, setTopicDescription] = useState("");
	const [updating, setUpdating] = useState(false);

	// Load topic data when dialog opens or topic changes
	useEffect(() => {
		if (open && topic) {
			setTopicName(topic.name);
			setTopicDescription(topic.description || "");
		}
	}, [open, topic]);

	const handleUpdate = async () => {
		if (!topic || !topicName.trim() || !topicDescription.trim()) return;

		try {
			setUpdating(true);
			const updatedTopic = await topicService.updateTopic(topic.id, {
				name: topicName.trim(),
				description: topicDescription.trim(),
			});

			logInfo("[EDIT_TOPIC_DIALOG] Updated topic:", updatedTopic);

			// Notify parent
			onTopicUpdated?.(updatedTopic);

			// Close dialog
			onOpenChange(false);
		} catch (error) {
			logError("[EDIT_TOPIC_DIALOG] Failed to update topic:", error);
		} finally {
			setUpdating(false);
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
			handleUpdate();
		}
	};

	if (!topic) return null;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[480px]">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Edit2 className="h-5 w-5 text-primary" />
						Edit Topic
					</DialogTitle>
					<DialogDescription>
						Update the name and description of this topic.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 py-4" onKeyDown={handleKeyDown}>
					<div className="space-y-2">
						<Label htmlFor="edit-topic-name">Topic Name *</Label>
						<Input
							id="edit-topic-name"
							placeholder="e.g., Machine Learning, React Development..."
							value={topicName}
							onChange={(e) => setTopicName(e.target.value)}
							autoFocus
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="edit-topic-description">Goal & Purpose *</Label>
						<Textarea
							id="edit-topic-description"
							placeholder="Describe what you want to achieve with this topic..."
							value={topicDescription}
							onChange={(e) => setTopicDescription(e.target.value)}
							rows={3}
						/>
					</div>

					<p className="text-xs text-muted-foreground">
						💡 Tip: Press{" "}
						<kbd className="px-1 py-0.5 bg-muted rounded text-xs">
							Ctrl+Enter
						</kbd>{" "}
						to save quickly
					</p>
				</div>

				<DialogFooter>
					<Button
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={updating}
					>
						Cancel
					</Button>
					<Button
						onClick={handleUpdate}
						disabled={!topicName.trim() || !topicDescription.trim() || updating}
					>
						{updating ? (
							<>
								<Loader2 className="h-4 w-4 mr-2 animate-spin" />
								Saving...
							</>
						) : (
							<>
								<Edit2 className="h-4 w-4 mr-2" />
								Save Changes
							</>
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
