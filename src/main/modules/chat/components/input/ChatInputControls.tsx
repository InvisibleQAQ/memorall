import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
	Square,
	Plus,
	Brain,
	MessageCircle,
	ChevronDown,
	Tags,
	Trash2,
	MoreHorizontal,
	Settings2,
	Paperclip,
	FileText,
	Check,
} from "lucide-react";

import {
	PromptInputSubmit,
	PromptInputToolbar,
	PromptInputTools,
} from "@/main/components/ui/shadcn-io/ai/prompt-input";
import { Button } from "@/main/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/main/components/ui/dropdown-menu";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/main/components/ui/tooltip";
import type { ChatStatus } from "@/types/chat";
import { cn } from "@/lib/utils";

export interface ChatInputControlsProps {
	isLoading: boolean;
	model: string;
	status: ChatStatus;
	selectedTopic: string;
	setSelectedTopic: (topicId: string) => void;
	onInsertSeparator: () => void;
	onStop: () => void;
	abortController: AbortController | null;
	isLoadingTopics: boolean;
	topics: Array<{ id: string; name: string; agentId?: string | null }>;
	agentFlows: Array<{ id: string; name: string }>;
	selectedAgentFlowId: string | null;
	setSelectedAgentFlowId: (flowId: string) => void;
	onCreateAgentFlow?: () => void;
	onDeleteChat: () => void;
	onOpenAgentSettings?: () => void;
	isCustomMode: boolean;
	onAttachFileClick: () => void;
	onAttachDocumentClick: () => void;
	canSubmit: boolean;
}

export const ChatInputControls: React.FC<ChatInputControlsProps> = ({
	isLoading,
	model,
	status,
	selectedTopic,
	setSelectedTopic,
	onInsertSeparator,
	onStop,
	abortController,
	isLoadingTopics,
	topics,
	agentFlows,
	selectedAgentFlowId,
	setSelectedAgentFlowId,
	onCreateAgentFlow,
	onDeleteChat,
	onOpenAgentSettings,
	isCustomMode,
	onAttachFileClick,
	onAttachDocumentClick,
	canSubmit,
}) => {
	const { t } = useTranslation("chat");
	const [isAttachMenuOpen, setIsAttachMenuOpen] = useState(false);
	const flowOptions = [
		{ id: "chat", name: t("flowSelector.chat") },
		...agentFlows,
	];
	const selectedFlow = flowOptions.find(
		(flow) => flow.id === selectedAgentFlowId,
	);
	const currentAgentTopicId = topics.find(
		(topic) =>
			selectedAgentFlowId &&
			selectedAgentFlowId !== "chat" &&
			topic.agentId === selectedAgentFlowId,
	)?.id;
	const isDefaultTopicSelected = selectedTopic === "default" || !selectedTopic;
	const selectedTopicName =
		selectedTopic === "__all__"
			? t("topic.all")
			: isDefaultTopicSelected
				? t("topic.default")
				: topics.find((topic) => topic.id === selectedTopic)?.name ||
					t("topic.select");

	return (
		<PromptInputToolbar>
			<div className="flex items-center gap-2 min-w-0 flex-1">
				<div className="flex-1 min-w-0 overflow-x-auto scrollbar-hide">
					<PromptInputTools>
						<DropdownMenu
							open={isAttachMenuOpen}
							onOpenChange={setIsAttachMenuOpen}
						>
							<Tooltip>
								<TooltipTrigger asChild>
									<DropdownMenuTrigger asChild>
										<Button
											type="button"
											variant="ghost"
											size="sm"
											disabled={isLoading}
											onMouseEnter={() => setIsAttachMenuOpen(true)}
											className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground whitespace-nowrap px-2"
										>
											<Paperclip size={12} />
										</Button>
									</DropdownMenuTrigger>
								</TooltipTrigger>
								<TooltipContent>
									<p className="text-xs">{t("input.attachImage")}</p>
								</TooltipContent>
							</Tooltip>
							<DropdownMenuContent
								align="start"
								onMouseEnter={() => setIsAttachMenuOpen(true)}
								onMouseLeave={() => setIsAttachMenuOpen(false)}
							>
								<DropdownMenuItem
									onClick={onAttachFileClick}
									className="flex items-center gap-2"
								>
									<Paperclip size={14} />
									<span>Select From File</span>
								</DropdownMenuItem>
								<DropdownMenuItem
									onClick={onAttachDocumentClick}
									className="flex items-center gap-2"
								>
									<FileText size={14} />
									<span>Select From Document</span>
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>

						<Tooltip>
							<DropdownMenu>
								<TooltipTrigger asChild>
									<DropdownMenuTrigger asChild>
										<Button
											type="button"
											variant="ghost"
											size="sm"
											className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground whitespace-nowrap px-2"
										>
											{selectedFlow?.id === "chat" ? (
												<MessageCircle size={12} />
											) : (
												<Brain size={12} />
											)}
											<span className="max-w-24 truncate">
												{selectedFlow?.name ?? t("flowSelector.chat")}
											</span>
											<ChevronDown size={10} className="opacity-50" />
										</Button>
									</DropdownMenuTrigger>
								</TooltipTrigger>
								<DropdownMenuContent align="start">
									{flowOptions.map((flow) => (
										<DropdownMenuItem
											key={flow.id}
											onClick={() => setSelectedAgentFlowId(flow.id)}
											className="flex items-center gap-2"
										>
											{flow.id === "chat" ? (
												<MessageCircle size={14} />
											) : (
												<Brain size={14} />
											)}
											<span>{flow.name}</span>
										</DropdownMenuItem>
									))}
									<DropdownMenuItem
										onClick={onCreateAgentFlow}
										className="flex items-center gap-2"
									>
										<Plus size={14} />
										<span>{t("flowSelector.create")}</span>
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
							<TooltipContent>
								<p className="text-xs">{t("tooltips.flowSelector")}</p>
							</TooltipContent>
						</Tooltip>

						{isCustomMode && (
							<>
								<Tooltip>
									<DropdownMenu>
										<TooltipTrigger asChild>
											<DropdownMenuTrigger asChild>
												<Button
													type="button"
													variant="ghost"
													size="sm"
													disabled={isLoadingTopics}
													className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground whitespace-nowrap px-2"
												>
													<Tags size={12} />
													<span className="max-w-20 truncate">
														{isLoadingTopics
															? t("topic.loading")
															: selectedTopicName}
													</span>
													<ChevronDown size={10} className="opacity-50" />
												</Button>
											</DropdownMenuTrigger>
										</TooltipTrigger>
										<DropdownMenuContent align="start">
											<DropdownMenuItem
												onClick={() => setSelectedTopic("default")}
												className={cn(
													"flex items-center gap-2",
													isDefaultTopicSelected &&
														"bg-accent/60 text-accent-foreground",
												)}
											>
												<Tags size={14} />
												<span>{t("topic.default")}</span>
												{isDefaultTopicSelected && (
													<Check size={13} className="ml-auto text-primary" />
												)}
											</DropdownMenuItem>
											{topics.map((topic) => {
												const isSelectedTopic = topic.id === selectedTopic;
												const isCurrentAgentMemory =
													topic.id === currentAgentTopicId;

												return (
													<DropdownMenuItem
														key={topic.id}
														onClick={() => setSelectedTopic(topic.id)}
														className={cn(
															"flex items-center gap-2",
															isSelectedTopic &&
																"bg-accent/60 text-accent-foreground",
														)}
													>
														{isCurrentAgentMemory ? (
															<Brain size={14} className="text-primary" />
														) : (
															<Tags size={14} />
														)}
														<span>{topic.name}</span>
														{isSelectedTopic && (
															<Check
																size={13}
																className="ml-auto text-primary"
															/>
														)}
													</DropdownMenuItem>
												);
											})}
										</DropdownMenuContent>
									</DropdownMenu>
									<TooltipContent>
										<p className="text-xs">{t("tooltips.topicSelector")}</p>
									</TooltipContent>
								</Tooltip>

								<Tooltip>
									<TooltipTrigger asChild>
										<Button
											type="button"
											variant="ghost"
											size="sm"
											onClick={onOpenAgentSettings}
											className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground whitespace-nowrap px-2"
										>
											<Settings2 size={12} />
										</Button>
									</TooltipTrigger>
									<TooltipContent>
										<p className="text-xs">{t("tooltips.agentSettings")}</p>
									</TooltipContent>
								</Tooltip>
							</>
						)}
					</PromptInputTools>
				</div>

				<div className="flex items-center gap-2 flex-shrink-0">
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								disabled={isLoading}
								onClick={onInsertSeparator}
								className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground whitespace-nowrap px-2"
							>
								<Plus size={12} />
								<span>{t("input.clearButton")}</span>
							</Button>
						</TooltipTrigger>
						<TooltipContent>
							<p className="text-xs">{t("tooltips.newMessage")}</p>
						</TooltipContent>
					</Tooltip>

					<Tooltip>
						<DropdownMenu>
							<TooltipTrigger asChild>
								<DropdownMenuTrigger asChild>
									<Button
										type="button"
										variant="ghost"
										size="sm"
										disabled={isLoading}
										className="text-muted-foreground hover:text-foreground"
									>
										<MoreHorizontal size={14} />
									</Button>
								</DropdownMenuTrigger>
							</TooltipTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuItem
									onClick={onDeleteChat}
									className="flex items-center gap-2 text-red-600 hover:text-red-700"
								>
									<Trash2 size={14} />
									<span>{t("actions.deleteChat")}</span>
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
						<TooltipContent>
							<p className="text-xs">{t("tooltips.moreActions")}</p>
						</TooltipContent>
					</Tooltip>

					{isLoading && abortController ? (
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									type="button"
									onClick={onStop}
									size="sm"
									variant="outline"
									className="border-red-200 text-red-600 hover:bg-red-50"
								>
									<Square size={16} />
								</Button>
							</TooltipTrigger>
							<TooltipContent>
								<p className="text-xs">{t("tooltips.stopGeneration")}</p>
							</TooltipContent>
						</Tooltip>
					) : (
						<Tooltip>
							<TooltipTrigger asChild>
								<PromptInputSubmit
									disabled={!canSubmit || isLoading || !model}
									status={status}
								/>
							</TooltipTrigger>
							<TooltipContent>
								<p className="text-xs">{t("tooltips.sendMessage")}</p>
							</TooltipContent>
						</Tooltip>
					)}
				</div>
			</div>
		</PromptInputToolbar>
	);
};
