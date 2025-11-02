import React from "react";
import {
	PromptInput,
	PromptInputSubmit,
	PromptInputTextarea,
	PromptInputToolbar,
	PromptInputTools,
} from "./MessageControl";
import { MESSAGE_CONTROL_TEXTS } from "./MessageControl";
import type { Language } from "@/constants/language";

// Chat mode type
type ChatMode = "general" | "knowledge";

// Icon components
const MessageCircleIcon: React.FC<{ size?: number }> = ({ size = 14 }) => (
	<svg
		width={size}
		height={size}
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
	>
		<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
	</svg>
);

const BrainIcon: React.FC<{ size?: number }> = ({ size = 14 }) => (
	<svg
		width={size}
		height={size}
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
	>
		<path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
		<path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
		<path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4" />
		<path d="M17.599 6.5a3 3 0 0 0 .399-1.375" />
		<path d="M6.003 5.125A3 3 0 0 0 6.401 6.5" />
		<path d="M3.477 10.896a4 4 0 0 1 .585-.396" />
		<path d="M19.938 10.5a4 4 0 0 1 .585.396" />
		<path d="M6 18a4 4 0 0 1-1.967-.516" />
		<path d="M19.967 17.484A4 4 0 0 1 18 18" />
	</svg>
);

const TagsIcon: React.FC<{ size?: number; className?: string }> = ({
	size = 12,
	className,
}) => (
	<svg
		width={size}
		height={size}
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
		className={className}
	>
		<path d="M9 5H2v7l6.29 6.29c.94.94 2.48.94 3.42 0l3.58-3.58c.94-.94.94-2.48 0-3.42L9 5Z" />
		<path d="M6 9.01V9" />
		<path d="m15 5 6.3 6.3a2.4 2.4 0 0 1 0 3.4L17 19" />
	</svg>
);

const ChevronDownIcon: React.FC<{ size?: number }> = ({ size = 10 }) => (
	<svg
		width={size}
		height={size}
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
	>
		<path d="m6 9 6 6 6-6" />
	</svg>
);

// Translation texts for input
const EMBEDDED_INPUT_TEXTS = {
	en: {
		noModelAvailable: "No model available...",
		typeMessage: "Type your message...",
		clearChat: "Clear chat",
		noTopics: "No topics",
		loadingTopics: "Loading topics...",
		allTopics: "All Topics",
		selectTopic: "Select Topic",
		modeGeneral: "General",
		modeKnowledge: "Knowledge",
		selectMode: "Select chat mode",
	},
	vn: {
		noModelAvailable: "Không có mô hình khả dụng...",
		typeMessage: "Nhập tin nhắn của bạn...",
		clearChat: "Xóa cuộc trò chuyện",
		noTopics: "Không có chủ đề",
		loadingTopics: "Đang tải chủ đề...",
		allTopics: "Tất cả chủ đề",
		selectTopic: "Chọn chủ đề",
		modeGeneral: "Tổng quát",
		modeKnowledge: "Kiến thức",
		selectMode: "Chọn chế độ trò chuyện",
	},
};

interface EmbeddedChatInputProps {
	inputValue: string;
	setInputValue: (value: string) => void;
	onSubmit: React.FormEventHandler<HTMLFormElement>;
	isTyping: boolean;
	modelAvailable: boolean;
	chatMode: ChatMode;
	setChatMode: (mode: ChatMode) => void;
	selectedTopic: string;
	setSelectedTopic: (topicId: string) => void;
	topics: Array<{ id: string; name: string }>;
	topicsLoading: boolean;
	hasTopics: boolean;
	messages: any[];
	onDeleteChat: () => void;
	onStop: () => void;
	language: Language;
}

export const EmbeddedChatInput: React.FC<EmbeddedChatInputProps> = ({
	inputValue,
	setInputValue,
	onSubmit,
	isTyping,
	modelAvailable,
	chatMode,
	setChatMode,
	selectedTopic,
	setSelectedTopic,
	topics,
	topicsLoading,
	hasTopics,
	messages,
	onDeleteChat,
	onStop,
	language,
}) => {
	const texts = EMBEDDED_INPUT_TEXTS[language];
	const messageControlTexts = MESSAGE_CONTROL_TEXTS[language];

	// Helper functions for chat mode
	const getModeIcon = (mode: ChatMode) => {
		switch (mode) {
			case "general":
				return <MessageCircleIcon size={14} />;
			case "knowledge":
				return <BrainIcon size={14} />;
		}
	};

	return (
		<div className="border-t p-3 flex-shrink-0">
			<PromptInput onSubmit={onSubmit}>
				<PromptInputTextarea
					value={inputValue}
					onChange={(e) => setInputValue(e.target.value)}
					placeholder={
						!modelAvailable ? texts.noModelAvailable : texts.typeMessage
					}
					disabled={isTyping || !modelAvailable}
				/>
				<PromptInputToolbar>
					<div className="flex items-center gap-2 min-w-0 flex-1">
						{/* Scrollable tools container */}
						<div className="flex-1 min-w-0 overflow-x-auto scrollbar-hide">
							<PromptInputTools>
								{/* Chat Mode Toggle */}
								<button
									type="button"
									disabled={isTyping}
									onClick={() =>
										setChatMode(
											chatMode === "knowledge" ? "general" : "knowledge",
										)
									}
									className={`
										relative flex items-center gap-1 text-xs whitespace-nowrap px-2 py-1 rounded-md
										transition-all duration-200 ease-in-out
										hover:scale-105 active:scale-95
										${
											chatMode === "knowledge"
												? "bg-blue-500/10 text-blue-600 hover:bg-blue-500/15"
												: "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
										}
									`}
									title={texts.selectMode}
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
								</button>

								{/* Topic Selector - Only show when in knowledge mode */}
								{chatMode === "knowledge" && (
									<div className="flex items-center gap-1.5">
										<select
											value={selectedTopic}
											onChange={(e) => setSelectedTopic(e.target.value)}
											disabled={topicsLoading}
											className="text-xs px-2 py-1 rounded-md border bg-background text-foreground border-border min-w-24 hover:border-accent-foreground focus:border-primary focus:outline-none"
											onKeyDown={(e) => e.stopPropagation()}
											onKeyUp={(e) => e.stopPropagation()}
											onKeyPress={(e) => e.stopPropagation()}
										>
											{topicsLoading ? (
												<option value="">{texts.loadingTopics}</option>
											) : (
												<>
													<option value="">Default</option>
													{topics.map((topic) => (
														<option key={topic.id} value={topic.id}>
															{topic.name}
														</option>
													))}
												</>
											)}
										</select>
									</div>
								)}

								{!hasTopics && chatMode === "knowledge" && (
									<span className="text-xs text-muted-foreground px-3 py-1.5">
										{texts.noTopics}
									</span>
								)}
							</PromptInputTools>
						</div>
						{/* Actions and Submit button */}
						<div className="flex items-center gap-2 flex-shrink-0">
							{/* Clear Chat Button */}
							{messages.length > 0 && (
								<button
									onClick={onDeleteChat}
									className="flex items-center justify-center p-2 text-red-600 hover:text-white hover:bg-red-600 rounded-md transition-colors"
									onKeyDown={(e) => e.stopPropagation()}
									onKeyUp={(e) => e.stopPropagation()}
									onKeyPress={(e) => e.stopPropagation()}
									title={texts.clearChat}
								>
									<svg
										className="w-4 h-4"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
										/>
									</svg>
								</button>
							)}
							<PromptInputSubmit
								disabled={!inputValue.trim() || isTyping || !modelAvailable}
								status={isTyping ? "streaming" : "ready"}
								onStop={onStop}
								texts={messageControlTexts}
							/>
						</div>
					</div>
				</PromptInputToolbar>
			</PromptInput>
		</div>
	);
};

export default EmbeddedChatInput;
