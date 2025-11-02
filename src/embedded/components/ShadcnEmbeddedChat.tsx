import React, {
	useCallback,
	useEffect,
	useState,
	type FormEventHandler,
} from "react";
import { createRoot } from "react-dom/client";
import { nanoid } from "nanoid";
import type { ChatModalProps, ChatMessage, ChatAction } from "../types";
import { embeddedChatService } from "../chat-service";
import { DEFAULT_LANGUAGE, type Language } from "@/constants/language";
import { Loader } from "./Icons";
import {
	ChatHeader,
	Conversation,
	ConversationContent,
	Message,
	MessageContent,
	Reasoning,
	ReasoningContent,
	ReasoningTrigger,
	Source,
	Sources,
	SourcesContent,
	SourcesTrigger,
} from "./MessageControl";

import {
	ShadcnEmbeddedContextSections,
	CONTEXT_SECTIONS_TEXTS,
} from "./ContextSections";
import { MESSAGE_CONTROL_TEXTS } from "./MessageControl";
import { loadLanguageFromStorage } from "../language";
import { EmbeddedMessageRenderer } from "./EmbeddedMessageRenderer";
import { EmbeddedChatInput } from "./EmbeddedChatInput";
import { backgroundJob } from "@/services/background-jobs/background-job";
import { customStyles } from "./styles/customStyles";

// Chat mode type
type ChatMode = "general" | "knowledge";

// Translation map for embedded chat (simplified - input texts moved to EmbeddedChatInput)
const EMBEDDED_CHAT_TEXTS = {
	en: {
		defaultTopic: "Default",
		recallKnowledge: "Recall Knowledge",
		recallDescription:
			"Ask me anything about your saved knowledge and I'll help you recall relevant information.",
		context: "Context",
		closeChat: "Close chat?",
		closeConfirmation:
			"You have unsaved messages or input. Are you sure you want to close?",
		cancel: "Cancel",
		closeAnyway: "Close anyway",
		contextFromPage: "Context from page:",
		tellMeAboutTopics: "Tell me about topics related to:",
		whatDoYouKnow: "What do you know about:",
		errorMessage:
			"Sorry, I encountered an error while processing your request. Please try again.",
	},
	vn: {
		defaultTopic: "Mặc định",
		recallKnowledge: "Gợi nhớ kiến thức",
		recallDescription:
			"Hỏi tôi bất cứ điều gì về kiến thức đã lưu và tôi sẽ giúp bạn gợi nhớ thông tin liên quan.",
		context: "Ngữ cảnh",
		closeChat: "Đóng cuộc trò chuyện?",
		closeConfirmation:
			"Bạn có tin nhắn hoặc đầu vào chưa lưu. Bạn có chắc chắn muốn đóng không?",
		cancel: "Hủy",
		closeAnyway: "Vẫn đóng",
		contextFromPage: "Ngữ cảnh từ trang:",
		tellMeAboutTopics: "Hãy nói cho tôi biết về các chủ đề liên quan đến:",
		whatDoYouKnow: "Bạn biết gì về:",
		errorMessage:
			"Xin lỗi, tôi gặp lỗi khi xử lý yêu cầu của bạn. Vui lòng thử lại.",
	},
};

interface EmbeddedChatProps extends ChatModalProps {
	language?: Language;
}

const ShadcnEmbeddedChat: React.FC<EmbeddedChatProps> = ({
	context,
	mode = "general",
	pageUrl,
	pageTitle,
	contextOptions,
	language = DEFAULT_LANGUAGE,
	onClose,
}) => {
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [inputValue, setInputValue] = useState("");
	const [selectedModel, setSelectedModel] = useState<string>("");
	const [selectedProvider, setSelectedProvider] = useState<string>("");
	const [modelAvailable, setModelAvailable] = useState(false);
	const [topics, setTopics] = useState<Array<{ id: string; name: string }>>([]);
	const [selectedTopic, setSelectedTopic] = useState<string>("");
	const [topicsLoading, setTopicsLoading] = useState(true);
	const [, setStreamingMessageId] = useState<string | null>(null);
	const [isTyping, setIsTyping] = useState(false);
	const [chatMode, setChatMode] = useState<ChatMode>("knowledge"); // Default to knowledge mode for embedded

	// Get translation texts based on current language
	const texts = EMBEDDED_CHAT_TEXTS[language];
	const messageControlTexts = MESSAGE_CONTROL_TEXTS[language];
	const contextSectionTexts = CONTEXT_SECTIONS_TEXTS[language];

	const [abortController, setAbortController] =
		useState<AbortController | null>(null);
	const [selectedContexts, setSelectedContexts] = useState<
		Array<{ type: string; label: string; content: string }>
	>([]);
	const [availableContexts, setAvailableContexts] = useState<
		Array<{ type: string; label: string; content: string }>
	>(contextOptions || []);
	const [showConfirmClose, setShowConfirmClose] = useState(false);
	const [showContextSection, setShowContextSection] = useState(true);

	// Check if there's unsaved content
	const hasUnsavedContent = useCallback(() => {
		return messages.length > 0 || inputValue.trim().length > 0;
	}, [messages, inputValue]);

	// Handle overlay click - show confirmation if there's unsaved content
	const handleOverlayClick = useCallback(() => {
		if (hasUnsavedContent()) {
			setShowConfirmClose(true);
		} else {
			onClose();
		}
	}, [hasUnsavedContent, onClose]);

	// Handle confirmed close
	const handleConfirmedClose = useCallback(() => {
		setShowConfirmClose(false);
		onClose();
	}, [onClose]);

	// Handle cancel close
	const handleCancelClose = useCallback(() => {
		setShowConfirmClose(false);
	}, []);

	// Handle close button click (header X button)
	const handleCloseButtonClick = useCallback(() => {
		if (hasUnsavedContent()) {
			setShowConfirmClose(true);
		} else {
			onClose();
		}
	}, [hasUnsavedContent, onClose]);

	// Handle delete chat - clear messages and restore context options
	const handleDeleteChat = useCallback(() => {
		setMessages([]);
		setInputValue("");
		setSelectedContexts([]);
		setAvailableContexts(contextOptions || []);
	}, [contextOptions]);

	// Handle toggle context section
	const handleToggleContextSection = useCallback(() => {
		setShowContextSection((prev) => !prev);
	}, []);

	// Auto-scroll state
	const conversationRef = React.useRef<HTMLDivElement>(null);
	const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

	// Topic status
	const hasTopics = topics.length > 0;

	// Initialize model on mount
	useEffect(() => {
		const initializeModel = async () => {
			try {
				// Get current model from the service
				const result = await backgroundJob.execute(
					"get-current-model",
					{},
					{ stream: false },
				);

				if (!("promise" in result)) {
					return;
				}
				const jobResult = await result.promise;

				if (jobResult.status === "completed" && jobResult.result) {
					const modelInfo = jobResult.result.modelInfo;
					if (
						modelInfo &&
						typeof modelInfo === "object" &&
						"modelId" in modelInfo &&
						"provider" in modelInfo
					) {
						setSelectedModel(`${modelInfo.modelId}`);
						setSelectedProvider(`${modelInfo.provider}`);
						setModelAvailable(true);
					} else {
						setModelAvailable(false);
					}
				}
			} catch (error) {
				console.error("Failed to initialize model:", error);
				setModelAvailable(false);
			}
		};
		initializeModel();
	}, []);

	// Load topics on mount
	useEffect(() => {
		const loadTopics = async () => {
			try {
				setTopicsLoading(true);
				const result = await backgroundJob.execute(
					"get-topics",
					{},
					{ stream: false },
				);

				if (!("promise" in result)) {
					return;
				}
				const jobResult = await result.promise;

				if (
					jobResult.status === "completed" &&
					jobResult.result &&
					"topics" in jobResult.result
				) {
					const topicList = jobResult.result.topics;
					if (Array.isArray(topicList)) {
						setTopics(
							topicList.map((topic) => ({
								id: topic.id,
								name: topic.name,
							})),
						);
					}
				}
			} catch (error) {
				console.error("Failed to load topics:", error);
			} finally {
				setTopicsLoading(false);
			}
		};
		loadTopics();
	}, []);

	// Auto-scroll to bottom helper
	const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
		if (conversationRef.current) {
			conversationRef.current.scrollTo({
				top: conversationRef.current.scrollHeight,
				behavior,
			});
		}
	}, []);

	// Check if user is near bottom of conversation
	const checkIfNearBottom = useCallback(() => {
		if (!conversationRef.current) return false;
		const { scrollTop, scrollHeight, clientHeight } = conversationRef.current;
		const threshold = 100; // pixels from bottom
		return scrollHeight - scrollTop - clientHeight < threshold;
	}, []);

	// Handle scroll to detect if user scrolled up
	const handleScroll = useCallback(() => {
		if (checkIfNearBottom()) {
			setShouldAutoScroll(true);
		} else {
			setShouldAutoScroll(false);
		}
	}, [checkIfNearBottom]);

	// Prevent scroll propagation when scrolling inside conversation
	const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
		const element = conversationRef.current;
		if (!element) return;

		const { scrollTop, scrollHeight, clientHeight } = element;
		const isScrollingDown = e.deltaY > 0;
		const isScrollingUp = e.deltaY < 0;

		// At top and scrolling up, or at bottom and scrolling down - prevent propagation
		const atTop = scrollTop === 0;
		const atBottom = scrollTop + clientHeight >= scrollHeight - 1;

		if ((atTop && isScrollingUp) || (atBottom && isScrollingDown)) {
			e.preventDefault();
			e.stopPropagation();
		}
	}, []);

	// Auto-scroll when messages change or streaming
	useEffect(() => {
		if (shouldAutoScroll) {
			scrollToBottom();
		}
	}, [messages, shouldAutoScroll, scrollToBottom]);

	// Prevent scroll on body when modal is open
	useEffect(() => {
		// Save current body overflow style
		const originalOverflow = document.body.style.overflow;

		// Prevent body scroll
		document.body.style.overflow = "hidden";

		// Restore on cleanup
		return () => {
			document.body.style.overflow = originalOverflow;
		};
	}, []);

	// Add initial context if provided
	useEffect(() => {
		if (context) {
			const contextMessage: ChatMessage = {
				id: nanoid(),
				content: `${texts.contextFromPage} "${context}"`,
				role: "user",
				timestamp: new Date(),
			};
			setMessages((prev) => [...prev, contextMessage]);

			// Auto-populate input with query
			const autoQuery =
				mode === "topic"
					? `${texts.tellMeAboutTopics} ${context}`
					: `${texts.whatDoYouKnow} ${context}`;
			setInputValue(autoQuery);
		}
	}, [context, mode, texts]);

	const handleStop = useCallback(() => {
		if (abortController) {
			abortController.abort();
			setAbortController(null);
			setIsTyping(false);
			setStreamingMessageId(null);
		}
	}, [abortController]);

	const handleSubmit: FormEventHandler<HTMLFormElement> = useCallback(
		async (event) => {
			event.preventDefault();

			if (!inputValue.trim() || isTyping || !modelAvailable) return;

			const userMessageContent = inputValue.trim();
			setInputValue("");
			setIsTyping(true);
			setShouldAutoScroll(true); // Enable auto-scroll when sending message

			// Create abort controller for this request
			const controller = new AbortController();
			setAbortController(controller);

			const userMessage: ChatMessage = {
				id: nanoid(),
				content: userMessageContent, // Display only user's message
				role: "user",
				timestamp: new Date(),
			};
			setMessages((prev) => [...prev, userMessage]);

			// Create assistant message placeholder
			const assistantMessageId = nanoid();
			const assistantMessage: ChatMessage = {
				id: assistantMessageId,
				content: "",
				role: "assistant",
				timestamp: new Date(),
				isStreaming: true,
			};
			setMessages((prev) => [...prev, assistantMessage]);
			setStreamingMessageId(assistantMessageId);

			try {
				// Build messages array with hidden context in the last message
				const messagesForAPI = [
					...messages,
					{
						id: userMessage.id,
						content: userMessageContent,
						role: userMessage.role,
						timestamp: userMessage.timestamp,
					},
				];

				const topicId = selectedTopic === "" ? undefined : selectedTopic;
				const serviceMode = chatMode === "knowledge" ? "knowledge" : "normal";

				await embeddedChatService.chatStream({
					messages: messagesForAPI,
					model: selectedModel,
					mode: serviceMode,
					topicId,
					signal: controller.signal,
					onProgress: (content: string, isComplete: boolean) => {
						setMessages((prev) =>
							prev.map((msg) => {
								if (msg.id === assistantMessageId) {
									return {
										...msg,
										content,
										isStreaming: !isComplete,
									};
								}
								return msg;
							}),
						);
					},
					onAction: (actions: ChatAction[]) => {
						setMessages((prev) =>
							prev.map((msg) => {
								if (msg.id === assistantMessageId) {
									return {
										...msg,
										metadata: {
											...msg.metadata,
											actions,
										},
									};
								}
								return msg;
							}),
						);
					},
					onError: (error: string) => {
						console.error("Chat error:", error);

						// Update message with error
						setMessages((prev) =>
							prev.map((msg) => {
								if (msg.id === assistantMessageId) {
									return {
										...msg,
										content: texts.errorMessage,
										isStreaming: false,
									};
								}
								return msg;
							}),
						);

						setIsTyping(false);
						setStreamingMessageId(null);
						setAbortController(null);
					},
				});
			} catch (error) {
				console.error("Chat submission error:", error);

				// Update message with error
				setMessages((prev) =>
					prev.map((msg) => {
						if (msg.id === assistantMessageId) {
							return {
								...msg,
								content: texts.errorMessage,
								isStreaming: false,
							};
						}
						return msg;
					}),
				);
			} finally {
				setIsTyping(false);
				setStreamingMessageId(null);
				setAbortController(null);

				// Scroll to bottom after streaming finishes
				setTimeout(() => scrollToBottom(), 100);
			}
		},
		[inputValue, isTyping, modelAvailable, messages, chatMode, scrollToBottom],
	);

	return (
		<div
			className="fixed inset-0 z-[999999] bg-black/30 animate-in fade-in duration-200"
			onClick={handleOverlayClick}
			onKeyDown={(e) => e.stopPropagation()}
			onKeyUp={(e) => e.stopPropagation()}
			onKeyPress={(e) => e.stopPropagation()}
		>
			<div
				className="fixed right-0 top-0 h-full w-full max-w-[30%] min-w-[400px] flex flex-col overflow-hidden bg-background shadow-2xl border-l animate-in slide-in-from-right duration-300"
				onClick={(e) => e.stopPropagation()}
				onKeyDown={(e) => e.stopPropagation()}
				onKeyUp={(e) => e.stopPropagation()}
				onKeyPress={(e) => e.stopPropagation()}
			>
				<ChatHeader
					mode={mode}
					onOpenFullVersion={() => {
						chrome.runtime.sendMessage({
							type: "OPEN_FULL_PAGE",
						});
					}}
					onClose={handleCloseButtonClick}
					modelId={selectedModel}
					provider={selectedProvider}
					modelAvailable={modelAvailable}
					texts={messageControlTexts}
				/>

				{/* Conversation Area - exact same structure as your example */}
				<Conversation
					ref={conversationRef}
					className="flex-1 overflow-y-auto"
					onScroll={handleScroll}
				>
					<ConversationContent className="space-y-4">
						{messages.length === 0 ? (
							<div className="flex flex-col items-center justify-center h-full text-center py-8 px-4">
								<div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3 overflow-hidden">
									<img
										src={chrome.runtime.getURL("logo.png")}
										alt="Memorall Logo"
										className="w-8 h-8 object-contain"
									/>
								</div>
								<h3 className="font-medium mb-2">{texts.recallKnowledge}</h3>
								<p className="text-muted-foreground text-xs leading-relaxed">
									{texts.recallDescription}
								</p>
							</div>
						) : (
							messages.map((message) => (
								<div key={message.id} className="space-y-3 overflow-x-hidden">
									<Message role={message.role}>
										<MessageContent role={message.role}>
											<EmbeddedMessageRenderer
												message={message}
												isLoading={message.isStreaming || false}
											/>
										</MessageContent>
									</Message>
									{/* Reasoning - only for AI messages */}
									{message.reasoning && message.role === "assistant" && (
										<div className="max-w-[100%]">
											<Reasoning
												isStreaming={message.isStreaming}
												defaultOpen={false}
											>
												<ReasoningTrigger />
												<ReasoningContent>{message.reasoning}</ReasoningContent>
											</Reasoning>
										</div>
									)}
									{/* Sources - only for AI messages */}
									{message.sources &&
										message.sources.length > 0 &&
										message.role === "assistant" && (
											<div className="max-w-[100%]">
												<Sources>
													<SourcesTrigger count={message.sources.length} />
													<SourcesContent>
														{message.sources.map((source, index) => (
															<Source
																key={index}
																href={source.url}
																title={source.title}
															/>
														))}
													</SourcesContent>
												</Sources>
											</div>
										)}
								</div>
							))
						)}
					</ConversationContent>
				</Conversation>

				{/* Show Context Button - visible when section is hidden */}
				{!showContextSection && (
					<div className="border-t px-4 py-2 flex-shrink-0">
						<button
							onClick={handleToggleContextSection}
							className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded transition-colors"
							onKeyDown={(e) => e.stopPropagation()}
							onKeyUp={(e) => e.stopPropagation()}
							onKeyPress={(e) => e.stopPropagation()}
						>
							<svg
								className="w-3.5 h-3.5"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M4 6h16M4 12h16M4 18h16"
								/>
							</svg>
							<span>{texts.context}</span>
						</button>
					</div>
				)}

				{/* Context Section with animation */}
				<div
					className="overflow-hidden transition-all duration-300 ease-in-out"
					style={{
						maxHeight: showContextSection ? "500px" : "0px",
						opacity: showContextSection ? 1 : 0,
					}}
				>
					<ShadcnEmbeddedContextSections
						pageUrl={pageUrl}
						pageTitle={pageTitle}
						contextOptions={contextOptions}
						setMessages={setMessages}
						selectedContexts={selectedContexts}
						setSelectedContexts={setSelectedContexts}
						showContextSection={showContextSection}
						onToggleContextSection={handleToggleContextSection}
						texts={contextSectionTexts}
					/>
				</div>

				{/* Input Area - using separate component */}
				<EmbeddedChatInput
					inputValue={inputValue}
					setInputValue={setInputValue}
					onSubmit={handleSubmit}
					isTyping={isTyping}
					modelAvailable={modelAvailable}
					chatMode={chatMode}
					setChatMode={setChatMode}
					selectedTopic={selectedTopic}
					setSelectedTopic={setSelectedTopic}
					topics={topics}
					topicsLoading={topicsLoading}
					hasTopics={hasTopics}
					messages={messages}
					onDeleteChat={handleDeleteChat}
					onStop={handleStop}
					language={language}
				/>

				{/* Confirmation Modal */}
				{showConfirmClose && (
					<div
						className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 animate-in fade-in duration-200"
						onClick={handleCancelClose}
					>
						<div
							className="bg-background border rounded-lg shadow-xl p-6 max-w-sm mx-4 animate-in zoom-in-95 duration-200"
							onClick={(e) => e.stopPropagation()}
							onKeyDown={(e) => {
								e.stopPropagation();
								if (e.key === "Escape") {
									handleCancelClose();
								}
							}}
							onKeyUp={(e) => e.stopPropagation()}
							onKeyPress={(e) => e.stopPropagation()}
						>
							<div className="space-y-4">
								<div className="space-y-2">
									<h3 className="text-lg font-semibold text-foreground">
										{texts.closeChat}
									</h3>
									<p className="text-sm text-muted-foreground">
										{texts.closeConfirmation}
									</p>
								</div>
								<div className="flex gap-3 justify-end">
									<button
										onClick={handleCancelClose}
										className="px-4 py-2 text-sm font-medium rounded-md border border-border bg-background hover:bg-accent text-foreground transition-colors"
										onKeyDown={(e) => e.stopPropagation()}
										onKeyUp={(e) => e.stopPropagation()}
										onKeyPress={(e) => e.stopPropagation()}
									>
										{texts.cancel}
									</button>
									<button
										onClick={handleConfirmedClose}
										className="px-4 py-2 text-sm font-medium rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
										onKeyDown={(e) => e.stopPropagation()}
										onKeyUp={(e) => e.stopPropagation()}
										onKeyPress={(e) => e.stopPropagation()}
									>
										{texts.closeAnyway}
									</button>
								</div>
							</div>
						</div>
					</div>
				)}
			</div>
		</div>
	);
};

// Function to create and mount the shadcn-style chat modal with Shadow DOM isolation
export async function createShadcnEmbeddedChatModal(
	props: ChatModalProps,
): Promise<() => void> {
	// Load language once at creation time
	const language = await loadLanguageFromStorage();
	// Create container element
	const container = document.createElement("div");
	container.id = "memorall-embedded-chat-modal";

	// Create Shadow DOM for complete CSS isolation
	const shadowRoot = container.attachShadow({ mode: "closed" });

	// Create the actual content container inside shadow DOM
	const shadowContainer = document.createElement("div");
	shadowContainer.className = "memorall-chat-container";

	// Inject Tailwind CSS only within the Shadow DOM
	const tailwindStyle = document.createElement("link");
	tailwindStyle.rel = "stylesheet";
	tailwindStyle.href = chrome.runtime.getURL("action/default_popup.css");

	// Add CSS custom properties for proper theming within Shadow DOM
	const customPropsStyle = document.createElement("style");
	customPropsStyle.textContent = customStyles;

	// Add styles to shadow DOM in correct order
	shadowRoot.appendChild(customPropsStyle);
	shadowRoot.appendChild(tailwindStyle);
	shadowRoot.appendChild(shadowContainer);

	// Create root and render inside shadow DOM
	const root = createRoot(shadowContainer);

	const cleanupModal = () => {
		root.unmount();
		container.remove();
	};

	const modalProps = {
		...props,
		language,
		onClose: () => {
			props.onClose();
			cleanupModal();
		},
	};

	root.render(<ShadcnEmbeddedChat {...modalProps} />);

	// Append to body
	document.body.appendChild(container);

	// Return cleanup function
	return cleanupModal;
}

export default ShadcnEmbeddedChat;
