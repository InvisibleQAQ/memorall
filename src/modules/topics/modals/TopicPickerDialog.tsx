/**
 * TopicPickerDialog - Simple single topic selection
 */

import React, { useState, useEffect } from "react";
import NiceModal, { useModal } from "@ebay/nice-modal-react";
import { Tags, Loader2 } from "lucide-react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { topicService } from "@/modules/topics/services/topic-service";
import type { Topic } from "@/services/database/entities/topics";
import { logError } from "@/utils/logger";

interface TopicPickerDialogProps {
	fileName: string;
}

export const TopicPickerDialog = NiceModal.create<TopicPickerDialogProps>(
	({ fileName }) => {
		const modal = useModal();

		const [loading, setLoading] = useState(false);
		const [topics, setTopics] = useState<Topic[]>([]);
		const [selectedTopicId, setSelectedTopicId] = useState<string | undefined>(
			undefined,
		);

		// Load topics when dialog opens
		useEffect(() => {
			if (modal.visible) {
				loadTopics();
			}
		}, [modal.visible]);

		const loadTopics = async () => {
			try {
				setLoading(true);
				const allTopics = await topicService.getTopics();
				setTopics(Array.isArray(allTopics) ? allTopics : []);
			} catch (error) {
				logError("Failed to load topics:", error);
				setTopics([]);
			} finally {
				setLoading(false);
			}
		};

		const handleSelect = () => {
			modal.resolve(selectedTopicId);
			modal.hide();
		};

		const handleCancel = () => {
			modal.resolve(null);
			modal.hide();
		};

		return (
			<Dialog
				open={modal.visible}
				onOpenChange={(open) => !open && handleCancel()}
			>
				<DialogContent className="sm:max-w-[400px]">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<Tags className="h-5 w-5 text-primary" />
							Select Topic
						</DialogTitle>
						<DialogDescription>Choose topic for "{fileName}"</DialogDescription>
					</DialogHeader>

					<div className="space-y-4">
						{loading ? (
							<div className="flex items-center justify-center py-8">
								<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
							</div>
						) : (
							<ScrollArea className="h-[300px] border rounded-md">
								<div className="p-2 space-y-1">
									{/* Default option */}
									<button
										type="button"
										onClick={() => setSelectedTopicId(undefined)}
										className={cn(
											"w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left",
											"hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
											selectedTopicId === undefined && "bg-muted",
										)}
									>
										<div
											className={cn(
												"h-4 w-4 border rounded-full flex items-center justify-center flex-shrink-0",
												selectedTopicId === undefined
													? "bg-primary border-primary"
													: "border-input",
											)}
										>
											{selectedTopicId === undefined && (
												<div className="h-2 w-2 bg-primary-foreground rounded-full" />
											)}
										</div>
										<div>
											<div className="font-medium">Default</div>
											<div className="text-sm text-muted-foreground">
												No topic association
											</div>
										</div>
									</button>

									{/* Topic options */}
									{topics.length === 0 ? (
										<div className="py-8 text-center text-sm text-muted-foreground">
											No topics available
										</div>
									) : (
										topics.map((topic) => (
											<button
												key={topic.id}
												type="button"
												onClick={() => setSelectedTopicId(topic.id)}
												className={cn(
													"w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left",
													"hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
													selectedTopicId === topic.id && "bg-muted",
												)}
											>
												<div
													className={cn(
														"h-4 w-4 border rounded-full flex items-center justify-center flex-shrink-0",
														selectedTopicId === topic.id
															? "bg-primary border-primary"
															: "border-input",
													)}
												>
													{selectedTopicId === topic.id && (
														<div className="h-2 w-2 bg-primary-foreground rounded-full" />
													)}
												</div>
												<div>
													<div className="font-medium">{topic.name}</div>
													{topic.description && (
														<div className="text-sm text-muted-foreground line-clamp-1">
															{topic.description}
														</div>
													)}
												</div>
											</button>
										))
									)}
								</div>
							</ScrollArea>
						)}
					</div>

					<DialogFooter>
						<Button variant="outline" onClick={handleCancel}>
							Cancel
						</Button>
						<Button onClick={handleSelect}>Select</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		);
	},
);
