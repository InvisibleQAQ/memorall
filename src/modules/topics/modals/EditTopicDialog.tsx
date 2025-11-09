/**
 * EditTopicDialog Modal
 * Dialog for editing an existing topic using nice-modal
 */

import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import NiceModal, { useModal } from "@ebay/nice-modal-react";
import { Edit2, Loader2 } from "lucide-react";
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
import type { Topic } from "@/services/database/types";
import { logError, logInfo } from "@/utils/logger";

interface EditTopicDialogProps {
	topic: Topic;
}

export const EditTopicDialog = NiceModal.create<EditTopicDialogProps>(
	({ topic }) => {
		const modal = useModal();
		const { t } = useTranslation("topics");
		const [topicName, setTopicName] = useState("");
		const [topicDescription, setTopicDescription] = useState("");
		const [updating, setUpdating] = useState(false);

		// Load topic data when dialog opens or topic changes
		useEffect(() => {
			if (modal.visible && topic) {
				setTopicName(topic.name);
				setTopicDescription(topic.description || "");
			}
		}, [modal.visible, topic]);

		const handleUpdate = async () => {
			if (!topic || !topicName.trim() || !topicDescription.trim()) return;

			try {
				setUpdating(true);
				const updatedTopic = await topicService.updateTopic(topic.id, {
					name: topicName.trim(),
					description: topicDescription.trim(),
				});

				logInfo("[EDIT_TOPIC_DIALOG] Updated topic:", updatedTopic);

				// Resolve with the updated topic
				modal.resolve(updatedTopic);
				modal.hide();
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

		return (
			<Dialog
				open={modal.visible}
				onOpenChange={(open) => !open && modal.hide()}
			>
				<DialogContent className="sm:max-w-[480px]">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<Edit2 className="h-5 w-5 text-primary" />
							{t("edit.title")}
						</DialogTitle>
						<DialogDescription>{t("edit.description")}</DialogDescription>
					</DialogHeader>

					<div className="space-y-4 py-4" onKeyDown={handleKeyDown}>
						<div className="space-y-2">
							<Label htmlFor="edit-topic-name">{t("edit.topicName")} *</Label>
							<Input
								id="edit-topic-name"
								placeholder={t("edit.namePlaceholder")}
								value={topicName}
								onChange={(e) => setTopicName(e.target.value)}
								autoFocus
							/>
						</div>

						<div className="space-y-2">
							<Label htmlFor="edit-topic-description">
								{t("edit.goalPurpose")} *
							</Label>
							<Textarea
								id="edit-topic-description"
								placeholder={t("edit.descriptionPlaceholder")}
								value={topicDescription}
								onChange={(e) => setTopicDescription(e.target.value)}
								rows={3}
							/>
						</div>

						<p className="text-xs text-muted-foreground">
							{t("edit.tip")}{" "}
							<kbd className="px-1 py-0.5 bg-muted rounded text-xs">
								{t("edit.ctrlEnter")}
							</kbd>{" "}
							{t("edit.toSaveQuickly")}
						</p>
					</div>

					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => modal.hide()}
							disabled={updating}
						>
							{t("edit.cancel")}
						</Button>
						<Button
							onClick={handleUpdate}
							disabled={
								!topicName.trim() || !topicDescription.trim() || updating
							}
						>
							{updating ? (
								<>
									<Loader2 className="h-4 w-4 mr-2 animate-spin" />
									{t("edit.saving")}
								</>
							) : (
								<>
									<Edit2 className="h-4 w-4 mr-2" />
									{t("edit.saveChanges")}
								</>
							)}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		);
	},
);
