import React, { useEffect, useState } from "react";
import NiceModal, { useModal } from "@ebay/nice-modal-react";
import { Loader2, Tags } from "lucide-react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/main/components/ui/dialog";
import { Button } from "@/main/components/ui/button";
import { Label } from "@/main/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/main/components/ui/select";
import { cn } from "@/lib/utils";
import { topicService } from "@/main/modules/topics/services/topic-service";
import type { Topic } from "@/services/database/types";
import type { KnowledgeGrowMode } from "@/main/modules/knowledge/services/knowledge-graph-service";
import { logError } from "@/utils/logger";

interface KnowledgeConversionDialogProps {
	fileName: string;
}

export interface KnowledgeConversionSelection {
	topicId?: string;
	growMode: KnowledgeGrowMode;
}

export const KnowledgeConversionDialog =
	NiceModal.create<KnowledgeConversionDialogProps>(({ fileName }) => {
		const modal = useModal();
		const [loading, setLoading] = useState(false);
		const [topics, setTopics] = useState<Topic[]>([]);
		const [selectedTopicId, setSelectedTopicId] = useState<string | undefined>(
			undefined,
		);
		const [growMode, setGrowMode] = useState<KnowledgeGrowMode>("knowledge");

		useEffect(() => {
			if (!modal.visible) return;
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
			void loadTopics();
		}, [modal.visible]);

		const handleSelect = () => {
			modal.resolve({
				topicId: selectedTopicId,
				growMode,
			} satisfies KnowledgeConversionSelection);
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
				<DialogContent className="sm:max-w-[440px] max-h-[88vh] flex flex-col gap-0 p-0">
					<DialogHeader className="px-6 pt-6">
						<DialogTitle className="flex items-center gap-2">
							<Tags className="h-5 w-5 text-primary" />
							Convert to Knowledge
						</DialogTitle>
						<DialogDescription>
							Choose topic and grow mode for "{fileName}"
						</DialogDescription>
					</DialogHeader>

					<div className="flex-1 overflow-y-auto px-6 py-4 min-h-0 space-y-4">
						<div className="space-y-2">
							<Label className="text-xs font-medium">Grow Mode</Label>
							<Select
								value={growMode}
								onValueChange={(value) =>
									setGrowMode(value as KnowledgeGrowMode)
								}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="knowledge">Knowledge Graph</SelectItem>
									<SelectItem value="structmem">StructMem</SelectItem>
								</SelectContent>
							</Select>
							<p className="text-xs text-muted-foreground">
								Knowledge Graph extracts entities and facts. StructMem stores
								timestamped event memories and cross-event syntheses.
							</p>
						</div>

						<div className="space-y-2">
							<Label className="text-xs font-medium">Topic</Label>
							{loading ? (
								<div className="flex items-center justify-center rounded-md border py-8">
									<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
								</div>
							) : (
								<div className="border rounded-md max-h-[300px] overflow-y-auto">
									<div className="p-2 space-y-1">
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
								</div>
							)}
						</div>
					</div>

					<DialogFooter className="px-6 pb-6">
						<Button variant="outline" onClick={handleCancel}>
							Cancel
						</Button>
						<Button onClick={handleSelect}>Convert</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		);
	});
