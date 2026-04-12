import React, {
	useCallback,
	useEffect,
	useMemo,
	useState,
	type FormEventHandler,
} from "react";
import { nanoid } from "nanoid";
import { DEFAULT_LANGUAGE, type Language } from "@/constants/language";
import { logError, logInfo } from "@/utils/logger";

import { backgroundJob } from "@/services/background-jobs/background-job";
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
} from "@/embedded/components/MessageControl";
import type {
	ChatModalProps,
	ChatMessage,
	ChatAction,
	EmbeddedContextItem,
} from "@/embedded/types";
import { embeddedChatService } from "@/embedded/chat-service";
import { EmbeddedContextSections } from "@/embedded/components/ContextSections";
import { createSmartSelectOverlay } from "@/embedded/components/SmartSelectOverlay";
import {
	loadLanguageFromStorage,
	EMBEDDED_TRANSLATIONS,
} from "@/embedded/language";
import { EmbeddedMessageRenderer } from "@/embedded/components/EmbeddedMessageRenderer";
import { EmbeddedChatInput } from "@/embedded/components/EmbeddedChatInput";
import { buildEmbeddedContextMessageContent } from "@/embedded/context-items";
import { customStyles } from "@/embedded/styles/customStyles";
import { createShadowPage } from "@/embedded/utils/create-shadow-page";

interface EmbeddedChatProps extends ChatModalProps {
	language?: Language;
}

const EmbeddedChat: React.FC<EmbeddedChatProps> = ({
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
	const [needsPasskey, setNeedsPasskey] = useState(false);
	const [noModelConfig, setNoModelConfig] = useState(false);
	const [encryptedProviders, setEncryptedProviders] = useState<string[]>([]);
	const [topics, setTopics] = useState<Array<{ id: string; name: string }>>([]);
	const [agentFlows, setAgentFlows] = useState<
		Array<{ id: string; name: string }>
	>([]);
	const [selectedTopic, setSelectedTopic] = useState<string>("");
	const [topicsLoading, setTopicsLoading] = useState(true);
	const [, setStreamingMessageId] = useState<string | null>(null);
	const [isTyping, setIsTyping] = useState(false);
	const [selectedAgentFlowId, setSelectedAgentFlowId] =
		useState<string>("chat");

	// Get translation texts based on current language
	const texts = EMBEDDED_TRANSLATIONS[language];

	const [abortController, setAbortController] =
		useState<AbortController | null>(null);
	const initialContextOptions = useMemo(
		() => contextOptions ?? [],
		[contextOptions],
	);
	const initialContextOptionMap = useMemo(
		() =>
			new Map(
				initialContextOptions.map((contextItem) => [
					contextItem.id,
					contextItem,
				]),
			),
		[initialContextOptions],
	);
	const initialContextOrder = useMemo(
		() =>
			new Map(
				initialContextOptions.map((contextItem, index) => [
					contextItem.id,
					index,
				]),
			),
		[initialContextOptions],
	);
	const [availableContexts, setAvailableContexts] = useState<
		EmbeddedContextItem[]
	>(initialContextOptions);
	const [attachedContexts, setAttachedContexts] = useState<
		EmbeddedContextItem[]
	>([]);
	const [isSmartSelectMode, setIsSmartSelectMode] = useState(false);
	const [showConfirmClose, setShowConfirmClose] = useState(false);
	const [showContextSection, setShowContextSection] = useState(true);

	// Check if there's unsaved content
	const hasUnsavedContent = useCallback(() => {
		return (
			messages.length > 0 ||
			inputValue.trim().length > 0 ||
			attachedContexts.length > 0
		);
	}, [attachedContexts.length, messages.length, inputValue]);

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
		setAttachedContexts([]);
		setAvailableContexts(initialContextOptions);
	}, [initialContextOptions]);

	// Handle toggle context section
	const handleToggleContextSection = useCallback(() => {
		setShowContextSection((prev) => !prev);
	}, []);

	const restoreAvailableContext = useCallback(
		(itemId: string, currentAvailable: EmbeddedContextItem[]) => {
			const originalItem = initialContextOptionMap.get(itemId);
			if (!originalItem) {
				return currentAvailable;
			}

			const nextAvailable = [...currentAvailable, originalItem];
			nextAvailable.sort((left, right) => {
				const leftIndex =
					initialContextOrder.get(left.id) ?? Number.MAX_SAFE_INTEGER;
				const rightIndex =
					initialContextOrder.get(right.id) ?? Number.MAX_SAFE_INTEGER;
				return leftIndex - rightIndex;
			});
			return nextAvailable;
		},
		[initialContextOptionMap, initialContextOrder],
	);

	const handleAttachContext = useCallback(
		(contextItem: EmbeddedContextItem) => {
			setAvailableContexts((prev) =>
				prev.filter((availableItem) => availableItem.id !== contextItem.id),
			);
			setAttachedContexts((prev) => [...prev, contextItem]);
		},
		[],
	);

	const handleAttachSmartContext = useCallback(
		(contextItem: EmbeddedContextItem) => {
			setAttachedContexts((prev) => [...prev, contextItem]);
		},
		[],
	);

	const handleRemoveAttachedContext = useCallback(
		(itemId: string) => {
			setAttachedContexts((prev) => {
				const nextAttached = prev.filter((contextItem) => {
					return contextItem.id !== itemId;
				});
				return nextAttached;
			});

			if (!initialContextOptionMap.has(itemId)) {
				return;
			}

			setAvailableContexts((prev) => restoreAvailableContext(itemId, prev));
		},
		[initialContextOptionMap, restoreAvailableContext],
	);

	const handleClearAttachedContexts = useCallback(() => {
		setAttachedContexts([]);
		setAvailableContexts(initialContextOptions);
	}, [initialContextOptions]);

	// Auto-scroll state
	const conversationRef = React.useRef<HTMLDivElement>(null);
	const smartSelectCleanupRef = React.useRef<(() => void) | null>(null);
	const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

	// Topic status
	const hasTopics = topics.length > 0;

	const checkProvidersNeedRestore = useCallback(async () => {
		const providers: Array<"openai" | "openrouter"> = ["openai", "openrouter"];
		const checks = await Promise.all(
			providers.map(async (provider) => {
				const checkResult = await backgroundJob.createJob(
					"check-provider-needs-restore",
					{ provider },
					{ stream: false },
				);

				if (!("promise" in checkResult)) {
					return { provider, needsRestore: false };
				}

				const checkJobResult = await checkResult.promise;
				return {
					provider,
					needsRestore:
						checkJobResult.status === "completed" &&
						!!checkJobResult.result?.needsRestore,
				};
			}),
		);

		const restoringProviders = checks
			.filter((check) => check.needsRestore)
			.map((check) => check.provider);

		return {
			needsRestore: restoringProviders.length > 0,
			providers: restoringProviders,
		};
	}, []);

	// Initialize model on mount
	useEffect(() => {
		const initializeModel = async () => {
			try {
				// Get current model from the service
				const result = await backgroundJob.createJob(
					"get-current-model",
					{},
					{ stream: false },
				);

				if (!("promise" in result)) {
					return;
				}
				const jobResult = await result.promise;

				logInfo("[EmbeddedChat] Initialize model", jobResult);

				if (jobResult.status === "completed" && jobResult.result) {
					const modelInfo = jobResult.result.modelInfo;
					if (
						modelInfo &&
						typeof modelInfo === "object" &&
						"modelId" in modelInfo &&
						"provider" in modelInfo
					) {
						const provider = `${modelInfo.provider}`;
						setSelectedModel(`${modelInfo.modelId}`);
						setSelectedProvider(provider);

						// Check if provider needs passkey restoration.
						if (provider === "openai" || provider === "openrouter") {
							const restoreState = await checkProvidersNeedRestore();
							if (restoreState.needsRestore) {
								logInfo(
									`[EmbeddedChat] Provider restore required: ${restoreState.providers.join(", ")}`,
								);
								setEncryptedProviders(restoreState.providers);
								setNeedsPasskey(true);
								setModelAvailable(false);
								return;
							}
						}

						setNoModelConfig(false);
						setModelAvailable(true);
					} else {
						const restoreState = await checkProvidersNeedRestore();
						if (restoreState.needsRestore) {
							logInfo(
								`[EmbeddedChat] No model loaded and encrypted providers need restore: ${restoreState.providers.join(", ")}`,
							);
							setEncryptedProviders(restoreState.providers);
							setNeedsPasskey(true);
							setModelAvailable(false);
							return;
						}

						setNeedsPasskey(false);
						setEncryptedProviders([]);
						setNoModelConfig(true);
						setModelAvailable(false);
					}
				}
			} catch (error) {
				logError("[EmbeddedChat] Initialize model failed", error);
				setModelAvailable(false);
			}
		};
		initializeModel();
	}, [checkProvidersNeedRestore]);

	// Load topics on mount
	useEffect(() => {
		const loadTopics = async () => {
			try {
				setTopicsLoading(true);
				const result = await backgroundJob.createJob(
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
				logError("Failed to load topics:", error);
			} finally {
				setTopicsLoading(false);
			}
		};
		loadTopics();
	}, []);

	// Load predefined agent flows and default to latest flow item (not chat)
	useEffect(() => {
		const loadPredefinedFlows = async () => {
			try {
				const result = await backgroundJob.createJob(
					"get-predefined-flows",
					{ flowKey: "knowledge-rag" },
					{ stream: false },
				);
				if (!("promise" in result)) {
					return;
				}

				const jobResult = await result.promise;
				if (
					jobResult.status === "completed" &&
					jobResult.result &&
					"flows" in jobResult.result
				) {
					const flowList = jobResult.result.flows;
					if (Array.isArray(flowList)) {
						const flows = flowList as Array<{ id: string; name: string }>;
						setAgentFlows(flows);
						if (flows.length > 0) {
							setSelectedAgentFlowId(flows[0].id);
						}
					}
				}
			} catch (error) {
				logError("Failed to load predefined flows:", error);
			}
		};
		loadPredefinedFlows();
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
		const originalBodyOverflow = document.body.style.overflow;
		const originalHtmlOverflow = document.documentElement.style.overflow;
		const originalBodyOverscroll = document.body.style.overscrollBehavior;
		const originalHtmlOverscroll =
			document.documentElement.style.overscrollBehavior;

		if (isSmartSelectMode) {
			document.body.style.overflow = originalBodyOverflow;
			document.documentElement.style.overflow = originalHtmlOverflow;
			document.body.style.overscrollBehavior = originalBodyOverscroll;
			document.documentElement.style.overscrollBehavior =
				originalHtmlOverscroll;
		} else {
			document.body.style.overflow = "hidden";
			document.documentElement.style.overflow = "hidden";
			document.body.style.overscrollBehavior = "contain";
			document.documentElement.style.overscrollBehavior = "contain";
		}

		// Restore on cleanup
		return () => {
			document.body.style.overflow = originalBodyOverflow;
			document.documentElement.style.overflow = originalHtmlOverflow;
			document.body.style.overscrollBehavior = originalBodyOverscroll;
			document.documentElement.style.overscrollBehavior =
				originalHtmlOverscroll;
		};
	}, [isSmartSelectMode]);

	useEffect(() => {
		return () => {
			smartSelectCleanupRef.current?.();
			smartSelectCleanupRef.current = null;
		};
	}, []);

	useEffect(() => {
		const preattachedContexts = initialContextOptions.filter(
			(contextItem) => contextItem.kind === "selected_image",
		);
		if (preattachedContexts.length > 0) {
			setAttachedContexts(preattachedContexts);
			setAvailableContexts(
				initialContextOptions.filter(
					(contextItem) => contextItem.kind !== "selected_image",
				),
			);
			return;
		}

		setAttachedContexts([]);
		setAvailableContexts(initialContextOptions);
	}, [initialContextOptions]);

	// Add initial context if provided
	useEffect(() => {
		if (context) {
			const contextMessage: ChatMessage = {
				id: nanoid(),
				content: `${texts.chat.contextFromPage} "${context}"`,
				role: "user",
				timestamp: new Date(),
			};
			setMessages((prev) => [...prev, contextMessage]);

			// Auto-populate input with query
			const autoQuery =
				mode === "topic"
					? `${texts.chat.tellMeAboutTopics} ${context}`
					: `${texts.chat.whatDoYouKnow} ${context}`;
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

	const handleStartSmartSelect = useCallback(() => {
		setIsSmartSelectMode(true);
		smartSelectCleanupRef.current?.();
		smartSelectCleanupRef.current = createSmartSelectOverlay(
			(contextItem) => {
				smartSelectCleanupRef.current = null;
				setIsSmartSelectMode(false);
				handleAttachSmartContext(contextItem);
				setShowContextSection(true);
			},
			() => {
				smartSelectCleanupRef.current = null;
				setIsSmartSelectMode(false);
			},
			{
				smartSelect: texts.contextSection.smartSelect,
				smartSelectInstruction: texts.contextSection.smartSelectInstruction,
				smartSelectCancel: texts.contextSection.smartSelectCancel,
				smartSelectChooseFormat: texts.contextSection.smartSelectChooseFormat,
				smartSelectText: texts.contextSection.smartSelectText,
				smartSelectCleanHtml: texts.contextSection.smartSelectCleanHtml,
				smartSelectHtml: texts.contextSection.smartSelectHtml,
			},
		);
	}, [handleAttachSmartContext, texts.contextSection]);

	const handleSubmit: FormEventHandler<HTMLFormElement> = useCallback(
		async (event) => {
			event.preventDefault();

			if (!inputValue.trim() || isTyping || !modelAvailable) return;

			const userMessageContent = inputValue.trim();
			const attachedContextsForMessage = attachedContexts;
			const composedUserContent = buildEmbeddedContextMessageContent({
				userMessage: userMessageContent,
				contexts: attachedContextsForMessage,
				pageTitle,
				pageUrl,
			});
			setInputValue("");
			setAttachedContexts([]);
			setAvailableContexts(initialContextOptions);
			setIsTyping(true);
			setShouldAutoScroll(true); // Enable auto-scroll when sending message

			// Create abort controller for this request
			const controller = new AbortController();
			setAbortController(controller);

			const userMessage: ChatMessage = {
				id: nanoid(),
				content: composedUserContent,
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
				const messagesForAPI = [
					...messages,
					{
						id: userMessage.id,
						content: composedUserContent,
						role: userMessage.role,
						timestamp: userMessage.timestamp,
					},
				];

				const topicId = selectedTopic === "" ? undefined : selectedTopic;
				const serviceMode =
					selectedAgentFlowId === "chat" ? "normal" : "knowledge";

				await embeddedChatService.chatStream({
					messages: messagesForAPI,
					model: selectedModel,
					mode: serviceMode,
					topicId,
					agentFlowId:
						selectedAgentFlowId === "chat" ? undefined : selectedAgentFlowId,
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
						logError("Chat error:", error);

						// Update message with error
						setMessages((prev) =>
							prev.map((msg) => {
								if (msg.id === assistantMessageId) {
									return {
										...msg,
										content: texts.chat.errorMessage,
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
				logError("Chat submission error:", error);

				// Update message with error
				setMessages((prev) =>
					prev.map((msg) => {
						if (msg.id === assistantMessageId) {
							return {
								...msg,
								content: texts.chat.errorMessage,
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
		[
			inputValue,
			isTyping,
			modelAvailable,
			messages,
			attachedContexts,
			initialContextOptions,
			pageTitle,
			pageUrl,
			selectedModel,
			selectedAgentFlowId,
			selectedTopic,
			scrollToBottom,
			texts.chat.errorMessage,
		],
	);

	return (
		<div
			className={`fixed inset-0 z-[999999] animate-in fade-in duration-200 ${
				isSmartSelectMode ? "bg-transparent" : "bg-black/30"
			}`}
			onClick={handleOverlayClick}
			onKeyDown={(e) => e.stopPropagation()}
			onKeyUp={(e) => e.stopPropagation()}
			onKeyPress={(e) => e.stopPropagation()}
		>
			<div
				className={`fixed flex flex-col overflow-hidden bg-background shadow-2xl animate-in slide-in-from-right duration-300 ${
					isSmartSelectMode
						? "right-3 top-3 h-auto w-[320px] max-w-[calc(100vw-1.5rem)] min-w-0 rounded-2xl border bg-background/95 backdrop-blur"
						: "right-0 top-0 h-full w-full max-w-[30%] min-w-[400px] border-l"
				}`}
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
					texts={texts.messageControl}
				/>

				{isSmartSelectMode ? (
					<div className="px-3 py-3">
						<div className="rounded-xl border bg-background/90 px-3 py-3 shadow-sm">
							<div className="text-base font-semibold text-foreground">
								{texts.contextSection.smartSelect}
							</div>
							<p className="mt-1 text-sm leading-relaxed text-muted-foreground">
								{texts.contextSection.smartSelectInstruction}
							</p>
						</div>
					</div>
				) : (
					<>
						{/* Conversation Area - exact same structure as your example */}
						<Conversation
							ref={conversationRef}
							className="flex-1 overflow-y-auto overscroll-contain"
							onScroll={handleScroll}
							onWheel={handleWheel}
						>
							<ConversationContent className="space-y-4">
								{/* Show passkey required banner */}
								{needsPasskey ? (
									<div className="flex flex-col items-center justify-center h-full text-center py-8 px-4">
										<div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-3">
											<svg
												className="w-6 h-6 text-amber-600 dark:text-amber-400"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
											>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth={2}
													d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
												/>
											</svg>
										</div>
										<h3 className="font-medium mb-2 text-foreground">
											{texts.chat.authRequired || "Authentication Required"}
										</h3>
										<p className="text-muted-foreground text-xs leading-relaxed mb-4">
											{texts.chat.authRequiredDescription ||
												`${
													encryptedProviders.length > 0
														? `Your ${encryptedProviders.join(", ")} provider`
														: `Your ${selectedProvider} model`
												} requires authentication. Please open the main app to enter your passkey.`}
										</p>
										<button
											onClick={() => {
												chrome.runtime.sendMessage({
													type: "OPEN_FULL_PAGE",
												});
												onClose();
											}}
											className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 transition-colors"
										>
											{texts.chat.openMainApp || "Open Main App"}
										</button>
									</div>
								) : noModelConfig ? (
									<div className="flex flex-col items-center justify-center h-full text-center py-8 px-4">
										<div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
											<svg
												className="w-6 h-6 text-muted-foreground"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
											>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth={2}
													d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
												/>
											</svg>
										</div>
										<h3 className="font-medium mb-2 text-foreground">
											{texts.chat.noModelConfig}
										</h3>
										<p className="text-muted-foreground text-xs leading-relaxed mb-4">
											{texts.chat.noModelConfigDescription}
										</p>
										<button
											onClick={() => {
												chrome.runtime.sendMessage({
													type: "OPEN_FULL_PAGE",
												});
												onClose();
											}}
											className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 transition-colors"
										>
											{texts.chat.configureModel}
										</button>
									</div>
								) : messages.length === 0 ? (
									<div className="flex flex-col items-center justify-center h-full text-center py-8 px-4">
										<div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3 overflow-hidden">
											<img
												src={chrome.runtime.getURL("logo.png")}
												alt="Memorall Logo"
												className="w-8 h-8 object-contain"
											/>
										</div>
										<h3 className="font-medium mb-2">
											{texts.chat.recallKnowledge}
										</h3>
										<p className="text-muted-foreground text-xs leading-relaxed">
											{texts.chat.recallDescription}
										</p>
									</div>
								) : (
									messages.map((message) => (
										<div
											key={message.id}
											className="space-y-3 overflow-x-hidden"
										>
											<Message role={message.role}>
												<MessageContent role={message.role}>
													<EmbeddedMessageRenderer
														message={message}
														isLoading={message.isStreaming || false}
														allMessages={messages}
														selectedTopic={selectedTopic}
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
														<ReasoningContent>
															{message.reasoning}
														</ReasoningContent>
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
					</>
				)}

				{/* Show Context Button - visible when section is hidden */}
				{!isSmartSelectMode &&
					!showContextSection &&
					attachedContexts.length === 0 && (
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
								<span>{texts.chat.context}</span>
							</button>
						</div>
					)}

				{/* Context Section with animation */}
				{!isSmartSelectMode && (
					<div
						className="overflow-hidden transition-all duration-300 ease-in-out"
						style={{
							maxHeight:
								showContextSection || attachedContexts.length > 0
									? "500px"
									: "0px",
							opacity:
								showContextSection || attachedContexts.length > 0 ? 1 : 0,
						}}
					>
						<EmbeddedContextSections
							availableContexts={availableContexts}
							attachedContexts={attachedContexts}
							onAttachContext={handleAttachContext}
							onRemoveAttachedContext={handleRemoveAttachedContext}
							onClearAttachedContexts={handleClearAttachedContexts}
							onStartSmartSelect={handleStartSmartSelect}
							showContextSection={showContextSection}
							onToggleContextSection={handleToggleContextSection}
							texts={texts.contextSection}
						/>
					</div>
				)}

				{/* Input Area - using separate component */}
				{!isSmartSelectMode && (
					<EmbeddedChatInput
						inputValue={inputValue}
						setInputValue={setInputValue}
						onSubmit={handleSubmit}
						isTyping={isTyping}
						modelAvailable={modelAvailable}
						selectedAgentFlowId={selectedAgentFlowId}
						setSelectedAgentFlowId={setSelectedAgentFlowId}
						agentFlows={agentFlows}
						selectedTopic={selectedTopic}
						setSelectedTopic={setSelectedTopic}
						topics={topics}
						topicsLoading={topicsLoading}
						hasTopics={hasTopics}
						messages={messages}
						onDeleteChat={handleDeleteChat}
						onStop={handleStop}
						onOpenSettings={() => {
							chrome.runtime.sendMessage({
								type: "OPEN_FULL_PAGE",
							});
							onClose();
						}}
						language={language}
					/>
				)}

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
										{texts.chat.closeChat}
									</h3>
									<p className="text-sm text-muted-foreground">
										{texts.chat.closeConfirmation}
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
										{texts.chat.cancel}
									</button>
									<button
										onClick={handleConfirmedClose}
										className="px-4 py-2 text-sm font-medium rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
										onKeyDown={(e) => e.stopPropagation()}
										onKeyUp={(e) => e.stopPropagation()}
										onKeyPress={(e) => e.stopPropagation()}
									>
										{texts.chat.closeAnyway}
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
export async function createEmbeddedChatModal(
	props: ChatModalProps,
): Promise<() => void> {
	// Load language once at creation time
	const language = await loadLanguageFromStorage();
	const { root, container } = createShadowPage({
		customStyles,
	});

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

	root.render(<EmbeddedChat {...modalProps} />);

	// Append to body
	document.body.appendChild(container);

	// Return cleanup function
	return cleanupModal;
}

export default EmbeddedChat;
