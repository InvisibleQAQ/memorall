/**
 * CreateTopicDialog Modal
 * Quick dialog for creating a new topic using nice-modal
 */

import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import NiceModal, { useModal } from "@ebay/nice-modal-react";
import { Loader2, Plus, Tags } from "lucide-react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/popup/components/ui/dialog";
import { Button } from "@/popup/components/ui/button";
import { Input } from "@/popup/components/ui/input";
import { Textarea } from "@/popup/components/ui/textarea";
import { Label } from "@/popup/components/ui/label";
import { topicService } from "@/modules/topics/services/topic-service";
import type { Topic } from "@/services/database/types";
import { logError, logInfo } from "@/utils/logger";

export const CreateTopicDialog = NiceModal.create(() => {
	const modal = useModal();
	const { t } = useTranslation("topics");
	const [topicName, setTopicName] = useState("");
	const [topicDescription, setTopicDescription] = useState("");
	const [creating, setCreating] = useState(false);

	// Reset form when dialog opens
	useEffect(() => {
		if (modal.visible) {
			setTopicName("");
			setTopicDescription("");
		}
	}, [modal.visible]);

	const handleCreate = async () => {
		if (!topicName.trim() || !topicDescription.trim() || creating) return;

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

			// Resolve with the created topic
			modal.resolve(newTopic);
			modal.hide();
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
			topicDescription.trim() &&
			!creating
		) {
			e.preventDefault();
			e.stopPropagation();
			handleCreate();
		}
	};

	return (
		<Dialog open={modal.visible} onOpenChange={(open) => !open && modal.hide()}>
			<DialogContent className="sm:max-w-[480px] max-h-[85vh] flex flex-col gap-0 p-0">
				<DialogHeader className="px-6 pt-6">
					<DialogTitle className="flex items-center gap-2">
						<Tags className="h-5 w-5 text-primary" />
						{t("create.title")}
					</DialogTitle>
					<DialogDescription>{t("create.description")}</DialogDescription>
				</DialogHeader>

				<div
					className="flex-1 overflow-y-auto px-6 py-4 space-y-4 min-h-0"
					onKeyDown={handleKeyDown}
				>
					<div className="space-y-2">
						<Label htmlFor="topic-name">{t("create.topicName")} *</Label>
						<Input
							id="topic-name"
							placeholder={t("create.namePlaceholder")}
							value={topicName}
							onChange={(e) => setTopicName(e.target.value)}
							autoFocus
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="topic-description">
							{t("create.goalPurpose")} *
						</Label>
						<Textarea
							id="topic-description"
							placeholder={t("create.descriptionPlaceholder")}
							value={topicDescription}
							onChange={(e) => setTopicDescription(e.target.value)}
							rows={3}
						/>
						<p className="text-xs text-muted-foreground">
							{t("create.example")}
						</p>
					</div>

					<p className="text-xs text-muted-foreground">
						{t("create.tip")}{" "}
						<kbd className="px-1 py-0.5 bg-muted rounded text-xs">
							{t("create.ctrlEnter")}
						</kbd>{" "}
						{t("create.toCreateQuickly")}
					</p>
				</div>

				<DialogFooter className="px-6 pb-6">
					<Button
						type="button"
						variant="outline"
						onClick={() => modal.hide()}
						disabled={creating}
					>
						{t("create.cancel")}
					</Button>
					<Button
						type="button"
						onClick={handleCreate}
						disabled={!topicName.trim() || !topicDescription.trim() || creating}
					>
						{creating ? (
							<>
								<Loader2 className="h-4 w-4 mr-2 animate-spin" />
								{t("create.creating")}
							</>
						) : (
							<>
								<Plus className="h-4 w-4 mr-2" />
								{t("create.createTopic")}
							</>
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
});
