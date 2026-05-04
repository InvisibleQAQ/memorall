import {
	useCallback,
	useEffect,
	useState,
	type Dispatch,
	type FormEventHandler,
	type SetStateAction,
} from "react";
import { nanoid } from "nanoid";
import { logError } from "@/utils/logger";
import { embeddedChatService } from "@/embedded/chat-service";
import { embeddedChatHistoryService } from "@/embedded/chat-history-service";
import { buildEmbeddedContextMessageContent } from "@/embedded/context-items";
import { createCoAgentEnabledFlowConfig } from "@/embedded/pages/CoAgent/co-agent-chat";
import { backgroundJob } from "@/services/background-jobs/background-job";
import type {
	ChatAction,
	ChatMessage,
	ChatModalProps,
	EmbeddedContextItem,
} from "@/embedded/types";
import type { EMBEDDED_TRANSLATIONS } from "@/embedded/language";
import type { Message } from "@/services/database/types";

interface UseEmbeddedChatSessionOptions {
	context?: string;
	mode: NonNullable<ChatModalProps["mode"]>;
	pageTitle: string;
	pageUrl: string;
	texts: typeof EMBEDDED_TRANSLATIONS.en.chat;
	inputValue: string;
	setInputValue: Dispatch<SetStateAction<string>>;
	attachedContexts: EmbeddedContextItem[];
	resetContexts: (showSection?: boolean) => void;
	modelAvailable: boolean;
	selectedModel: string;
	selectedAgentFlowId: string;
	coAgentEnabled: boolean;
	selectedTopic: string;
	scrollToBottom: (behavior?: ScrollBehavior) => void;
	setShouldAutoScroll: Dispatch<SetStateAction<boolean>>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null;

const mapStoredMessage = (message: Message): ChatMessage | null => {
	if (message.role !== "user" && message.role !== "assistant") {
		return null;
	}

	return {
		id: message.id,
		content: message.content,
		role: message.role,
		timestamp: new Date(message.createdAt),
		topicId: message.topicId,
		metadata: isRecord(message.metadata) ? message.metadata : undefined,
	};
};

const cloneActions = (actions: ChatAction[] | undefined): ChatAction[] =>
	(actions ?? []).map((action) => ({
		...action,
		metadata: { ...action.metadata },
	}));

const getContentText = (content: ChatMessage["content"]): string => {
	if (typeof content === "string") {
		return content;
	}

	return content
		.filter((part) => part.type === "text")
		.map((part) => part.text)
		.join("\n");
};

export const useEmbeddedChatSession = ({
	context,
	mode,
	pageTitle,
	pageUrl,
	texts,
	inputValue,
	setInputValue,
	attachedContexts,
	resetContexts,
	modelAvailable,
	selectedModel,
	selectedAgentFlowId,
	coAgentEnabled,
	selectedTopic,
	scrollToBottom,
	setShouldAutoScroll,
}: UseEmbeddedChatSessionOptions) => {
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [isTyping, setIsTyping] = useState(false);
	const [isLoadingHistory, setIsLoadingHistory] = useState(true);
	const [, setStreamingMessageId] = useState<string | null>(null);
	const [abortController, setAbortController] =
		useState<AbortController | null>(null);

	useEffect(() => {
		let cancelled = false;

		const loadStoredMessages = async () => {
			try {
				const storedMessages = await embeddedChatHistoryService.loadMessages();
				if (cancelled) {
					return;
				}
				setMessages(
					storedMessages
						.map(mapStoredMessage)
						.filter((message): message is ChatMessage => Boolean(message)),
				);
			} catch (error) {
				logError("Failed to load embedded chat history:", error);
			} finally {
				if (!cancelled) {
					setIsLoadingHistory(false);
				}
			}
		};

		void loadStoredMessages();

		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		if (!context) return;

		const autoQuery =
			mode === "topic"
				? `${texts.tellMeAboutTopics} ${context}`
				: `${texts.whatDoYouKnow} ${context}`;
		setInputValue(autoQuery);
	}, [context, mode, setInputValue, texts]);

	const stop = useCallback(() => {
		if (abortController) {
			abortController.abort();
			setAbortController(null);
			setIsTyping(false);
			setStreamingMessageId(null);
		}
	}, [abortController]);

	const newChat = useCallback(async () => {
		if (isTyping) return;

		setMessages([]);
		setInputValue("");
		resetContexts(false);
		try {
			await embeddedChatHistoryService.insertSeparator();
			backgroundJob
				.execute(
					"sandbox-operation",
					{ operation: "runtime.reset" as const, payload: undefined },
					{ stream: false },
				)
				.catch((error) => {
					logError("Failed to reset sandbox container:", error);
				});
		} catch (error) {
			logError("Failed to start a new embedded chat:", error);
		}
	}, [isTyping, resetContexts, setInputValue]);

	const deleteChat = useCallback(() => {
		void newChat();
	}, [newChat]);

	const submit: FormEventHandler<HTMLFormElement> = useCallback(
		async (event) => {
			event.preventDefault();

			if (!inputValue.trim() || isTyping || !modelAvailable) {
				return;
			}

			const userMessageContent = inputValue.trim();
			const composedUserContent = buildEmbeddedContextMessageContent({
				userMessage: userMessageContent,
				contexts: attachedContexts,
				pageTitle,
				pageUrl,
			});

			setInputValue("");
			resetContexts();
			setIsTyping(true);
			setShouldAutoScroll(true);

			const controller = new AbortController();
			setAbortController(controller);

			const userMessageId = nanoid();
			let assistantMessageId = nanoid();
			let currentContent = "";
			let latestActions: ChatAction[] = [];
			let latestToolCalls: unknown[] = [];
			const startTime = Date.now();

			try {
				const topicId =
					selectedTopic &&
					selectedTopic !== "default" &&
					selectedTopic !== "__all__"
						? selectedTopic
						: undefined;

				const userMessageForUI: ChatMessage = {
					id: userMessageId,
					content: composedUserContent,
					role: "user",
					timestamp: new Date(),
					topicId,
				};
				const assistantMessage: ChatMessage = {
					id: assistantMessageId,
					content: "",
					role: "assistant",
					timestamp: new Date(),
					topicId,
					isStreaming: true,
					metadata: {},
				};
				setMessages((prev) => [...prev, userMessageForUI, assistantMessage]);
				setStreamingMessageId(assistantMessageId);

				const storedUserMessage = await embeddedChatHistoryService.addMessage({
					id: userMessageId,
					content: getContentText(composedUserContent),
					role: "user",
					topicId,
				});
				const userMessage = mapStoredMessage(storedUserMessage);
				if (!userMessage) {
					throw new Error("Failed to persist embedded user message");
				}

				const storedAssistantMessage =
					await embeddedChatHistoryService.addMessage({
						id: assistantMessageId,
						content: "",
						role: "assistant",
						topicId,
					});
				assistantMessageId = storedAssistantMessage.id;

				const messagesForAPI = [
					...messages,
					{
						id: userMessage.id,
						content: userMessageForUI.content,
						role: userMessage.role,
						timestamp: userMessage.timestamp,
					},
				];
				const serviceMode = coAgentEnabled
					? "knowledge"
					: selectedAgentFlowId === "chat"
						? "normal"
						: "knowledge";

				const result = await embeddedChatService.chatStream({
					messages: messagesForAPI,
					model: selectedModel,
					mode: serviceMode,
					topicId,
					agentFlowId:
						coAgentEnabled || selectedAgentFlowId === "chat"
							? undefined
							: selectedAgentFlowId,
					flowConfig: coAgentEnabled
						? createCoAgentEnabledFlowConfig()
						: undefined,
					signal: controller.signal,
					onProgress: (content: string, isComplete: boolean) => {
						currentContent = content;
						setMessages((prev) =>
							prev.map((message) => {
								if (message.id === assistantMessageId) {
									return {
										...message,
										content,
										isStreaming: !isComplete,
									};
								}
								return message;
							}),
						);
					},
					onAction: (actions: ChatAction[]) => {
						latestActions = cloneActions(actions);
						setMessages((prev) =>
							prev.map((message) => {
								if (message.id === assistantMessageId) {
									return {
										...message,
										metadata: {
											...message.metadata,
											actions,
										},
									};
								}
								return message;
							}),
						);
					},
					onToolCalls: (toolCalls) => {
						latestToolCalls = toolCalls;
						setMessages((prev) =>
							prev.map((message) =>
								message.id === assistantMessageId
									? {
											...message,
											metadata: {
												...message.metadata,
												tool_calls: toolCalls,
											},
										}
									: message,
							),
						);
					},
					onExecuteStart: (executeState) => {
						setMessages((prev) =>
							prev.map((message) =>
								message.id === assistantMessageId
									? {
											...message,
											metadata: {
												...message.metadata,
												executeState,
											},
										}
									: message,
							),
						);
					},
					onError: (error: string) => {
						logError("Chat error:", error);
						setMessages((prev) =>
							prev.map((message) => {
								if (message.id === assistantMessageId) {
									return {
										...message,
										content: texts.errorMessage,
										isStreaming: false,
									};
								}
								return message;
							}),
						);

						setIsTyping(false);
						setStreamingMessageId(null);
						setAbortController(null);
					},
				});

				currentContent = result.content || currentContent;
				latestActions = cloneActions(result.actions || latestActions);
				latestToolCalls = result.toolCalls || latestToolCalls;
				const endTime = Date.now();
				const timeToAnswer = (endTime - startTime) / 1000;
				const totalTokens =
					result.usage?.total_tokens ?? Math.round(currentContent.length / 4);
				const outputTokens =
					result.usage?.completion_tokens ??
					Math.round(currentContent.length / 4);

				await embeddedChatHistoryService.finalizeMessage(assistantMessageId, {
					content: currentContent,
					metadata: {
						actions: latestActions,
						tool_calls: latestToolCalls,
						model: selectedModel,
						timeToAnswer,
						tokensPerSecond: timeToAnswer > 0 ? outputTokens / timeToAnswer : 0,
						estimatedTokens: totalTokens,
						usage: result.usage,
					},
				});
			} catch (error) {
				logError("Chat submission error:", error);
				const errorContent = currentContent || texts.errorMessage;
				try {
					await embeddedChatHistoryService.finalizeMessage(assistantMessageId, {
						content: errorContent,
						metadata: {
							actions: latestActions,
							tool_calls: latestToolCalls,
							model: selectedModel,
						},
					});
				} catch (saveError) {
					logError("Failed to persist embedded error message:", saveError);
				}
				setMessages((prev) =>
					prev.map((message) => {
						if (message.id === assistantMessageId) {
							return {
								...message,
								content: errorContent,
								isStreaming: false,
							};
						}
						return message;
					}),
				);
			} finally {
				setIsTyping(false);
				setStreamingMessageId(null);
				setAbortController(null);
				setTimeout(() => scrollToBottom(), 100);
			}
		},
		[
			inputValue,
			isTyping,
			modelAvailable,
			attachedContexts,
			pageTitle,
			pageUrl,
			setInputValue,
			resetContexts,
			setShouldAutoScroll,
			messages,
			selectedTopic,
			selectedAgentFlowId,
			coAgentEnabled,
			selectedModel,
			texts.whatDoYouKnow,
			texts.tellMeAboutTopics,
			texts.errorMessage,
			scrollToBottom,
		],
	);

	return {
		messages,
		isTyping: isTyping || isLoadingHistory,
		submit,
		stop,
		deleteChat,
		newChat,
	};
};
