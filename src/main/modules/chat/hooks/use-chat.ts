import { useState, useEffect } from "react";
import { chatService } from "@/main/modules/chat/services/chat-service";
import type { ChatMode } from "@/main/modules/chat/services/chat-service";
import type { ChatMessage } from "@/types/openai";
import { useChatStore } from "@/main/stores/chat";
import type { ChatStatus } from "ai";
import { logError, logInfo } from "@/utils/logger";
import { serviceManager } from "@/services";

export interface InProgressMessage {
	id: string;
	content: string;
	actions: Array<{
		id: string;
		name: string;
		description: string;
		metadata: Record<string, unknown>;
	}>;
}

export const useChat = (model: string) => {
	const [inputValue, setInputValue] = useState("");
	const [status, setStatus] = useState<ChatStatus>("ready");
	const [abortController, setAbortController] =
		useState<AbortController | null>(null);
	const [inProgressMessage, setInProgressMessage] =
		useState<InProgressMessage | null>(null);

	// State selectors - only re-render when specific value changes
	const messages = useChatStore((state) => state.messages);
	const isLoading = useChatStore((state) => state.isLoading);
	const chatMode = useChatStore((state) => state.chatMode);
	const selectedTopic = useChatStore((state) => state.selectedTopic);

	// Action selectors - stable references, won't cause re-renders
	const setChatMode = useChatStore((state) => state.setChatMode);
	const setSelectedTopic = useChatStore((state) => state.setSelectedTopic);
	const addMessage = useChatStore((state) => state.addMessage);
	const finalizeMessage = useChatStore((state) => state.finalizeMessage);
	const setLoading = useChatStore((state) => state.setLoading);
	const ensureMainConversation = useChatStore((state) => state.ensureMainConversation);
	const deleteMessages = useChatStore((state) => state.deleteMessages);

	// Initialize conversation
	useEffect(() => {
		const initializeConversation = async () => {
			if (model) {
				try {
					await ensureMainConversation();
				} catch (error) {
					logError("Failed to initialize main conversation:", error);
				}
			}
		};

		initializeConversation();
	}, [model, ensureMainConversation]);

	// Sync selectedTopic with last message's topic
	useEffect(() => {
		if (chatMode !== "knowledge") return;

		// Find the last user or assistant message (skip separators)
		const lastMessage = messages
			.filter((msg) => msg.type !== "separator")
			.findLast((msg) => msg.role === "user" || msg.role === "assistant");

		if (lastMessage?.topicId) {
			// If last message has a topicId, use it
			setSelectedTopic(lastMessage.topicId);
		} else if (messages.length > 0 && !lastMessage?.topicId) {
			// If there are messages but no topicId, use default
			setSelectedTopic("default");
		}
		// If no messages, keep current selection (default)
	}, [messages, chatMode]);

	// Stop current chat request
	const handleStop = () => {
		if (abortController) {
			abortController.abort();
			setAbortController(null);
			setLoading(false);
			setStatus("ready");
		}
	};

	// Insert a separator message
	const insertSeparator = async () => {
		if (isLoading) return;

		try {
			await addMessage({
				role: "system",
				content: "---",
				type: "separator",
				createdAt: new Date(),
			});
		} catch (error) {
			logError("Failed to insert separator:", error);
		}
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!inputValue.trim() || isLoading || !model) return;

		const userMessageContent = inputValue.trim();
		setInputValue("");
		setStatus("submitted");
		setLoading(true);

		// Create abort controller for this request
		const controller = new AbortController();
		setAbortController(controller);

		let assistantMessage: any = null;
		let currentContent = "";
		const startTime = Date.now();
		let provider = "unknown";

		// Get current model provider
		try {
			const currentModel = await serviceManager.llmService.getCurrentModel();
			if (currentModel?.provider) {
				provider = currentModel.provider;
			}
		} catch (error) {
			logError("Failed to get current model provider:", error);
		}

		try {
			// Add user message to store and database
			const userMessage = await addMessage({
				role: "user",
				content: userMessageContent,
				// Include topicId when in knowledge mode with a selected topic
				topicId:
					chatMode === "knowledge" &&
					selectedTopic &&
					selectedTopic !== "default" &&
					selectedTopic !== "__all__"
						? selectedTopic
						: undefined,
			});

			setStatus("streaming");

			// Find the latest separator index to only send messages after it
			const allMessages = [...messages, userMessage];
			const latestSeparatorIndex = allMessages.findLastIndex(
				(msg) => msg.type === "separator",
			);

			// Get messages after the latest separator (or all messages if no separator exists)
			const relevantMessages =
				latestSeparatorIndex >= 0
					? allMessages.slice(latestSeparatorIndex + 1)
					: allMessages;

			// Filter out separator messages and map to the required format
			// Note: Store messages are only user/assistant/system, not tool messages
			const sendMessages: ChatMessage[] = relevantMessages
				.filter((msg) => msg.type !== "separator")
				.map((msg) => {
					const role = msg.role as "system" | "user" | "assistant";
					if (role === "system") {
						return { role, content: msg.content };
					} else if (role === "user") {
						return { role, content: msg.content };
					}
					return { role: "assistant" as const, content: msg.content };
				});

			// Create assistant message placeholder
			assistantMessage = await addMessage({
				role: "assistant",
				content: "",
				// Use the same topicId as the user message for consistency
				topicId: userMessage.topicId,
			});

			// Set in-progress message for real-time updates
			setInProgressMessage({
				id: assistantMessage.id,
				content: "",
				actions: [],
			});

			// Execute chat via chat service
			const result = await chatService.chatStream(
				{
					messages: sendMessages,
					model: model,
					mode: chatMode,
					topicId:
						selectedTopic && selectedTopic !== "__all__"
							? selectedTopic
							: undefined,
					streamConfig: {
						minWordsToStream: 5,
						streamToolCallsImmediately: true,
					},
				},
				{
					onContent: (content) => {
						currentContent = content;
						// Only update in-progress message, not the store
						setInProgressMessage((prev) =>
							prev ? { ...prev, content } : null,
						);
					},
					onAction: (actions) => {
						// Only update in-progress message, not the store
						setInProgressMessage((prev) =>
							prev ? { ...prev, actions } : null,
						);
					},
					onError: (error) => {
						logError("Chat streaming error:", error);
					},
				},
				controller.signal,
			);

			// Calculate timing and performance metrics
			const endTime = Date.now();
			const timeToAnswer = (endTime - startTime) / 1000; // in seconds

			// Estimate tokens (rough estimate: ~4 characters per token)
			const estimatedTokens = Math.round(result.content.length / 4);
			const tokensPerSecond =
				timeToAnswer > 0 ? estimatedTokens / timeToAnswer : 0;

			// Handle completion or failure after stream finishes
			if (result.failed) {
				// Keep streamed content and append error message
				const errorContent = `${result.content}\n\n---\n\n❌ **Error:** ${result.error}`;
				await finalizeMessage(assistantMessage.id, {
					content: errorContent,
					metadata: {
						actions: result.actions,
						model: model,
						provider: provider,
						timeToAnswer: timeToAnswer,
						tokensPerSecond: tokensPerSecond,
						estimatedTokens: estimatedTokens,
					},
				});
				throw new Error(result.error || "Chat failed");
			} else {
				// Success - update in-progress message with final content before saving
				// This ensures smooth transition from streaming to final
				setInProgressMessage((prev) =>
					prev
						? { ...prev, content: result.content, actions: result.actions }
						: null,
				);

				// Small delay to let React render the updated content
				await new Promise((resolve) => setTimeout(resolve, 150));

				// Finalize with final content and actions
				await finalizeMessage(assistantMessage.id, {
					content: result.content,
					metadata: {
						actions: result.actions,
						model: model,
						provider: provider,
						timeToAnswer: timeToAnswer,
						tokensPerSecond: tokensPerSecond,
						estimatedTokens: estimatedTokens,
					},
				});
			}

			// Clear in-progress message
			setInProgressMessage(null);
			setStatus("ready");
		} catch (error) {
			// Check if error is due to user aborting the request
			if (error instanceof Error && error.message === "Operation aborted") {
				logInfo("Chat request was stopped by user");
				setStatus("ready");

				// Save any partial content that was streamed before abort
				if (assistantMessage && currentContent) {
					try {
						await finalizeMessage(assistantMessage.id, {
							content: currentContent,
							metadata: { actions: inProgressMessage?.actions || [] },
						});
						logInfo("Saved partial content from stopped generation");
					} catch (saveError) {
						logError("Failed to save partial content:", saveError);
					}
				}

				// Clear in-progress message
				setInProgressMessage(null);
				return; // Don't show error message for user-initiated stops
			}

			logError("Chat error:", error);

			// Update error message if assistant message exists, otherwise create new one
			if (assistantMessage) {
				const errorContent =
					"Sorry, I encountered an error processing your message.";
				await finalizeMessage(assistantMessage.id, { content: errorContent });
			} else {
				await addMessage({
					role: "assistant",
					content: "Sorry, I encountered an error processing your message.",
				});
			}

			// Clear in-progress message
			setInProgressMessage(null);
			setStatus("error");
		} finally {
			setLoading(false);
			setAbortController(null);
		}
	};

	return {
		inputValue,
		setInputValue,
		status,
		chatMode,
		setChatMode,
		selectedTopic,
		setSelectedTopic,
		messages,
		isLoading,
		abortController,
		inProgressMessage,
		handleSubmit,
		handleStop,
		insertSeparator,
		deleteMessages,
	};
};
