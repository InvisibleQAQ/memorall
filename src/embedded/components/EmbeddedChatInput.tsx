import React from "react";
import {
	PromptInput,
	PromptInputSubmit,
	PromptInputTextarea,
	PromptInputToolbar,
	PromptInputTools,
} from "./MessageControl";
import type { Language } from "@/constants/language";
import { EMBEDDED_TRANSLATIONS } from "../language";

interface EmbeddedChatInputProps {
	inputValue: string;
	setInputValue: (value: string) => void;
	onSubmit: React.FormEventHandler<HTMLFormElement>;
	isTyping: boolean;
	modelAvailable: boolean;
	selectedAgentFlowId: string;
	setSelectedAgentFlowId: (flowId: string) => void;
	agentFlows: Array<{ id: string; name: string }>;
	selectedTopic: string;
	setSelectedTopic: (topicId: string) => void;
	topics: Array<{ id: string; name: string }>;
	topicsLoading: boolean;
	hasTopics: boolean;
	messages: any[];
	onDeleteChat: () => void;
	onStop: () => void;
	onOpenSettings: () => void;
	language: Language;
}

export const EmbeddedChatInput: React.FC<EmbeddedChatInputProps> = ({
	inputValue,
	setInputValue,
	onSubmit,
	isTyping,
	modelAvailable,
	selectedAgentFlowId,
	setSelectedAgentFlowId,
	agentFlows,
	selectedTopic,
	setSelectedTopic,
	topics,
	topicsLoading,
	hasTopics,
	messages,
	onDeleteChat,
	onStop,
	onOpenSettings,
	language,
}) => {
	const texts = EMBEDDED_TRANSLATIONS[language];
	const isKnowledgeMode = selectedAgentFlowId !== "chat";
	const flowOptions = [
		{ id: "chat", name: texts.input.modeGeneral },
		...agentFlows,
	];

	return (
		<div className="border-t p-3 flex-shrink-0">
			<PromptInput onSubmit={onSubmit}>
				<PromptInputTextarea
					value={inputValue}
					onChange={(e) => setInputValue(e.target.value)}
					placeholder={
						!modelAvailable
							? texts.input.noModelAvailable
							: texts.input.typeMessage
					}
					disabled={isTyping || !modelAvailable}
				/>
				<PromptInputToolbar>
					<div className="flex items-center gap-2 min-w-0 flex-1">
						{/* Scrollable tools container */}
						<div className="flex-1 min-w-0 overflow-x-auto scrollbar-hide">
							<PromptInputTools>
								<div className="flex items-center gap-1.5">
									<select
										value={selectedAgentFlowId}
										onChange={(e) => setSelectedAgentFlowId(e.target.value)}
										disabled={isTyping}
										className="text-xs px-2 py-1 rounded-md border bg-background text-foreground border-border min-w-24 hover:border-accent-foreground focus:border-primary focus:outline-none"
										onKeyDown={(e) => e.stopPropagation()}
										onKeyUp={(e) => e.stopPropagation()}
										onKeyPress={(e) => e.stopPropagation()}
									>
										{flowOptions.map((flow) => (
											<option key={flow.id} value={flow.id}>
												{flow.name}
											</option>
										))}
									</select>
								</div>

								{/* Topic Selector - Only show when in knowledge mode */}
								{isKnowledgeMode && (
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
												<option value="">{texts.input.loadingTopics}</option>
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

								{isKnowledgeMode && (
									<button
										type="button"
										onClick={onOpenSettings}
										className="flex items-center justify-center p-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-colors"
										onKeyDown={(e) => e.stopPropagation()}
										onKeyUp={(e) => e.stopPropagation()}
										onKeyPress={(e) => e.stopPropagation()}
										title={texts.messageControl.openFullVersion}
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
												d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
											/>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
											/>
										</svg>
									</button>
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
									title={texts.input.clearChat}
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
								texts={texts.messageControl}
							/>
						</div>
					</div>
				</PromptInputToolbar>
			</PromptInput>
		</div>
	);
};

export default EmbeddedChatInput;
