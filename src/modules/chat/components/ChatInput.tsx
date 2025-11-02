import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
	Square,
	Minus,
	Bot,
	Brain,
	MessageCircle,
	ChevronDown,
	Tags,
	Trash2,
	MoreHorizontal,
} from "lucide-react";
import {
	PromptInput,
	PromptInputButton,
	PromptInputSubmit,
	PromptInputTextarea,
	PromptInputToolbar,
	PromptInputTools,
} from "@/components/ui/shadcn-io/ai/prompt-input";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ChatStatus } from "ai";
import type { ChatMode } from "@/modules/chat/services/chat-service";

interface ChatInputProps {
	inputValue: string;
	setInputValue: (value: string) => void;
	onSubmit: (e: React.FormEvent) => void;
	isLoading: boolean;
	model: string;
	status: ChatStatus;
	chatMode: ChatMode;
	setChatMode: (mode: ChatMode) => void;
	selectedTopic: string;
	setSelectedTopic: (topicId: string) => void;
	onInsertSeparator: () => void;
	onStop: () => void;
	abortController: AbortController | null;
	isLoadingTopics: boolean;
	topics: Array<{ id: string; name: string }>;
	onDeleteChat: () => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
	inputValue,
	setInputValue,
	onSubmit,
	isLoading,
	model,
	status,
	chatMode,
	setChatMode,
	selectedTopic,
	setSelectedTopic,
	onInsertSeparator,
	onStop,
	abortController,
	isLoadingTopics,
	onDeleteChat,
	topics,
}) => {
	const { t } = useTranslation("chat");
	const getModeIcon = (mode: ChatMode) => {
		switch (mode) {
			case "normal":
				return <MessageCircle size={14} />;
			case "knowledge":
				return <Brain size={14} />;
		}
	};

	return (
		<div className="px-4 py-2 w-full flex-shrink-0">
			<div className="max-w-3xl mx-auto">
				<PromptInput onSubmit={onSubmit}>
					<PromptInputTextarea
						value={inputValue}
						onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
							setInputValue(e.target.value)
						}
						placeholder={t("input.placeholder")}
						disabled={isLoading}
					/>
					<PromptInputToolbar>
						<div className="flex items-center gap-2 min-w-0 flex-1">
							{/* Scrollable tools container */}
							<div className="flex-1 min-w-0 overflow-x-auto scrollbar-hide">
								<PromptInputTools>
									{/* Compact Mode Toggle */}
									<Button
										type="button"
										variant="ghost"
										size="sm"
										disabled={isLoading}
										onClick={() =>
											setChatMode(
												chatMode === "knowledge" ? "normal" : "knowledge",
											)
										}
										className={`
											relative flex items-center gap-1 text-xs whitespace-nowrap px-2
											transition-all duration-200 ease-in-out
											hover:scale-105 active:scale-95
											${
												chatMode === "knowledge"
													? "bg-blue-500/10 border border-blue-500/20 text-blue-600 hover:bg-blue-500/15"
													: "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
											}
										`}
										title={t("mode.selectMode")}
									>
										<div
											className={`
											transition-transform duration-200 ease-in-out
											${chatMode === "knowledge" ? "scale-110" : "scale-100"}
										`}
										>
											{getModeIcon(chatMode)}
										</div>
										{chatMode === "knowledge" && (
											<div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
										)}
									</Button>

									{/* Topic Selector - Only show when in knowledge mode */}
									{chatMode === "knowledge" && (
										<DropdownMenu>
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
															: selectedTopic === "__all__"
																? t("topic.all")
																: topics.find(
																		(topic) => topic.id === selectedTopic,
																	)?.name || t("topic.select")}
													</span>
													<ChevronDown size={10} className="opacity-50" />
												</Button>
											</DropdownMenuTrigger>
											<DropdownMenuContent align="start">
												<DropdownMenuItem
													onClick={() => setSelectedTopic("default")}
													className="flex items-center gap-2"
												>
													<Tags size={14} />
													<span>{t("topic.default")}</span>
												</DropdownMenuItem>
												{topics.map((topic) => (
													<DropdownMenuItem
														key={topic.id}
														onClick={() => setSelectedTopic(topic.id)}
														className="flex items-center gap-2"
													>
														<Tags size={14} />
														<span>{topic.name}</span>
													</DropdownMenuItem>
												))}
											</DropdownMenuContent>
										</DropdownMenu>
									)}
								</PromptInputTools>
							</div>
							{/* Actions and send button */}
							<div className="flex items-center gap-2 flex-shrink-0">
								{/* Clear Button - frequently used */}
								<Button
									type="button"
									variant="ghost"
									size="sm"
									disabled={isLoading}
									onClick={onInsertSeparator}
									className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground whitespace-nowrap px-2"
									title={t("input.clearTitle")}
								>
									<Minus size={12} />
									<span>{t("input.clearButton")}</span>
								</Button>

								{/* Actions Menu - less frequent actions */}
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button
											type="button"
											variant="ghost"
											size="sm"
											disabled={isLoading}
											className="text-muted-foreground hover:text-foreground"
											title={t("actions.moreActions")}
										>
											<MoreHorizontal size={14} />
										</Button>
									</DropdownMenuTrigger>
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

								{/* Send/Stop Button */}
								{isLoading && abortController ? (
									<Button
										type="button"
										onClick={onStop}
										size="sm"
										variant="outline"
										className="border-red-200 text-red-600 hover:bg-red-50"
									>
										<Square size={16} />
									</Button>
								) : (
									<PromptInputSubmit
										disabled={!inputValue.trim() || isLoading || !model}
										status={status}
									/>
								)}
							</div>
						</div>
					</PromptInputToolbar>
				</PromptInput>
			</div>
		</div>
	);
};
