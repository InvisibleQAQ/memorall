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
import { backgroundJob } from "@/services/background-jobs/background-job";
import { customStyles } from "./styles/customStyles";
import { EmbeddedMessageRenderer } from "./EmbeddedMessageRenderer";
import { Loader } from "./Icons";
import {
	ChatHeader,
	Conversation,
	ConversationContent,
	Message,
	MessageContent,
	PromptInput,
	PromptInputSubmit,
	PromptInputTextarea,
	PromptInputToolbar,
	PromptInputTools,
	Reasoning,
	ReasoningContent,
	ReasoningTrigger,
	Source,
	Sources,
	SourcesContent,
	SourcesTrigger,
} from "./MessageControl";
import { ShadcnEmbeddedContextSections } from "./ContextSections";

// Topic Selector Component
const TopicSelector: React.FC<{
	selectedTopic: string;
	onTopicChange: (topicId: string) => void;
	topics: Array<{ id: string; name: string }>;
	isLoading: boolean;
}> = ({ selectedTopic, onTopicChange, topics, isLoading }) => {
	if (isLoading) {
		return (
			<div className="flex items-center gap-2 text-xs text-muted-foreground">
				<Loader size={12} />
				<span>Loading topics...</span>
			</div>
		);
	}

	return (
		<select
			value={selectedTopic}
			onChange={(e) => onTopicChange(e.target.value)}
			className="text-xs p-1 rounded border bg-background text-foreground border-border min-w-24 flex-1"
			onKeyDown={(e) => e.stopPropagation()}
			onKeyUp={(e) => e.stopPropagation()}
			onKeyPress={(e) => e.stopPropagation()}
		>
			{topics.map((topic) => (
				<option key={topic.id} value={topic.id}>
					{topic.name}
				</option>
			))}
		</select>
	);
};

const ShadcnEmbeddedChat: React.FC<ChatModalProps> = ({
	context,
	mode = "general",
	pageUrl,
	pageTitle,
	contextOptions,
	onClose,
}) => {
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [inputValue, setInputValue] = useState("");
	const [selectedModel, setSelectedModel] = useState<string>("");
	const [selectedProvider, setSelectedProvider] = useState<string>("");
	const [modelAvailable, setModelAvailable] = useState(false);
	const [topics, setTopics] = useState<Array<{ id: string; name: string }>>([]);
	const [selectedTopic, setSelectedTopic] = useState<string>("default");
	const [topicsLoading, setTopicsLoading] = useState(true);
	const [isTyping, setIsTyping] = useState(false);
	const [, setStreamingMessageId] = useState<string | null>(null);
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

	// Initialize model and check status
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
						// Add default option at the top
						const defaultTopic = {
							id: "default",
							name: "Default",
						};
						const topicsWithDefault = [defaultTopic, ...topicList];

						setTopics(
							topicsWithDefault.map((topic) => ({
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
				content: `Context from page: "${context}"`,
				role: "user",
				timestamp: new Date(),
			};
			setMessages((prev) => [...prev, contextMessage]);

			// Auto-populate input with query
			const autoQuery =
				mode === "topic"
					? `Tell me about topics related to: ${context}`
					: `What do you know about: ${context}`;
			setInputValue(autoQuery);
		}
	}, [context, mode]);

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

			// Build hidden context with page information - only visible viewport content
			const getPageContext = () => {
				try {
					const selection = window.getSelection()?.toString() || "";

					// Get only visible text in viewport
					const visibleText: string[] = [];
					const walker = document.createTreeWalker(
						document.body,
						NodeFilter.SHOW_TEXT,
						{
							acceptNode: (node) => {
								const parent = node.parentElement;
								if (!parent) return NodeFilter.FILTER_REJECT;

								// Skip script, style, noscript
								const tag = parent.tagName.toLowerCase();
								if (tag === "script" || tag === "style" || tag === "noscript") {
									return NodeFilter.FILTER_REJECT;
								}

								// Check if element is in viewport
								const rect = parent.getBoundingClientRect();
								const isInViewport =
									rect.top < window.innerHeight &&
									rect.bottom > 0 &&
									rect.left < window.innerWidth &&
									rect.right > 0;

								if (!isInViewport) return NodeFilter.FILTER_REJECT;

								// Check visibility
								const style = window.getComputedStyle(parent);
								const isVisible =
									style.display !== "none" &&
									style.visibility !== "hidden" &&
									style.opacity !== "0";

								return isVisible
									? NodeFilter.FILTER_ACCEPT
									: NodeFilter.FILTER_REJECT;
							},
						},
					);

					let node: Node | null;
					let totalLength = 0;
					const maxLength = 2000;

					while ((node = walker.nextNode()) && totalLength < maxLength) {
						const text = node.textContent?.trim() || "";
						if (text && text.length > 0) {
							visibleText.push(text);
							totalLength += text.length;
						}
					}

					const viewportContent = visibleText.join(" ").slice(0, maxLength);

					return {
						viewportContent,
						selection,
					};
				} catch (error) {
					console.error("Error getting page context:", error);
					const bodyText = document.body?.innerText?.slice(0, 2000) || "";
					return {
						viewportContent: bodyText,
						selection: window.getSelection()?.toString() || "",
					};
				}
			};

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

				await embeddedChatService.chatStream({
					messages: messagesForAPI,
					model: selectedModel,
					mode: "knowledge",
					topicId:
						hasTopics && selectedTopic && selectedTopic !== "default"
							? selectedTopic
							: undefined,
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
										content:
											"Sorry, I encountered an error while processing your request. Please try again.",
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
								content:
									"Sorry, I encountered an error while processing your request. Please try again.",
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
		[inputValue, isTyping, modelAvailable, messages, mode, scrollToBottom],
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
					modelAvailable={modelAvailable && !!selectedModel}
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
								<h3 className="font-medium mb-2">Recall Knowledge</h3>
								<p className="text-muted-foreground text-xs leading-relaxed">
									Ask me anything about your saved knowledge and I'll help you
									recall relevant information.
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
							<span>Context</span>
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
					/>
				</div>

				{/* Input Area - compact design for right panel */}
				<div className="border-t p-3 flex-shrink-0">
					<PromptInput onSubmit={handleSubmit}>
						<PromptInputTextarea
							value={inputValue}
							onChange={(e) => setInputValue(e.target.value)}
							placeholder={
								!modelAvailable
									? "No model available..."
									: "Type your message..."
							}
							disabled={isTyping || !modelAvailable}
						/>
						<PromptInputToolbar>
							<PromptInputTools>
								{messages.length > 0 && (
									<button
										onClick={handleDeleteChat}
										disabled={isTyping}
										className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:pointer-events-none transition-colors"
										title="Clear chat"
										onKeyDown={(e) => e.stopPropagation()}
										onKeyUp={(e) => e.stopPropagation()}
										onKeyPress={(e) => e.stopPropagation()}
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
								{hasTopics && (
									<TopicSelector
										selectedTopic={selectedTopic}
										onTopicChange={setSelectedTopic}
										topics={topics}
										isLoading={topicsLoading}
									/>
								)}
								{!hasTopics && (
									<span className="text-xs text-muted-foreground px-3 py-1.5">
										No topics
									</span>
								)}
							</PromptInputTools>
							<PromptInputSubmit
								disabled={!inputValue.trim() || isTyping || !modelAvailable}
								status={isTyping ? "streaming" : "ready"}
								onStop={handleStop}
							/>
						</PromptInputToolbar>
					</PromptInput>
				</div>

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
										Close chat?
									</h3>
									<p className="text-sm text-muted-foreground">
										You have unsaved messages or input. Are you sure you want to
										close?
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
										Cancel
									</button>
									<button
										onClick={handleConfirmedClose}
										className="px-4 py-2 text-sm font-medium rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
										onKeyDown={(e) => e.stopPropagation()}
										onKeyUp={(e) => e.stopPropagation()}
										onKeyPress={(e) => e.stopPropagation()}
									>
										Close anyway
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
export function createShadcnEmbeddedChatModal(
	props: ChatModalProps,
): () => void {
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
