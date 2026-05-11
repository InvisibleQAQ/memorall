import { useState, useEffect } from "react";
import { chatService } from "@/main/modules/chat/services/chat-service";
import type { ChatMessage } from "@/types/openai";
import { useChatStore } from "@/main/stores/chat";
import { useAgentConfigStore } from "@/main/stores/agent-config";
import type {
	ChatStatus,
	ComplexContent,
	AttachedDocumentRef,
} from "@/types/chat";
import { logError, logInfo } from "@/utils/logger";
import { serviceManager } from "@/services";
import { backgroundJob } from "@/services/background-jobs/background-job";
import type { Message } from "@/services/database";
import { buildSendMessages } from "@/main/modules/chat/utils/build-send-messages";
import {
	trimToContextBudget,
	CONTEXT_BUDGET_RATIO,
} from "@/main/modules/chat/utils/context-manager";
import { estimatePromptTokens } from "@/services/llm/utils/token-usage";
import { documentFileSystemService } from "@/services/filesystem/document-filesystem";
import { createJobErrorMetadata } from "@/services/background-jobs/handlers/error-metadata";
import {
	extractDocumentText,
	formatDocumentBlock,
} from "@/main/modules/chat/utils/extract-document-text";
import type { ChatCompletionMessageToolCall } from "@/types/openai";

export interface InProgressMessage {
	id: string;
	content: string;
	complexContent: ComplexContent | null;
	actions: Array<{
		id: string;
		name: string;
		description: string;
		metadata: Record<string, unknown>;
	}>;
	executeState?: {
		node: string;
		metadata?: Record<string, unknown>;
	};
}

const cloneActions = (
	actions: InProgressMessage["actions"],
): InProgressMessage["actions"] =>
	actions.map((action) => ({
		...action,
		metadata: { ...action.metadata },
	}));

const cloneToolCalls = (
	toolCalls: ChatCompletionMessageToolCall[] | undefined,
): ChatCompletionMessageToolCall[] | undefined =>
	toolCalls?.map((toolCall) => ({
		...toolCall,
		function: { ...toolCall.function },
	}));

const cloneComplexContent = (
	complexContent: ComplexContent | null | undefined,
): ComplexContent | null =>
	complexContent
		? complexContent.map((part) => ({
				...part,
				...("metadata" in part && part.metadata
					? { metadata: { ...part.metadata } }
					: {}),
			}))
		: null;

export const useChat = (model: string) => {
	const [inputValue, setInputValue] = useState("");
	const [status, setStatus] = useState<ChatStatus>("ready");
	const [abortController, setAbortController] =
		useState<AbortController | null>(null);
	const [inProgressMessage, setInProgressMessage] =
		useState<InProgressMessage | null>(null);

	// State selectors - only re-render when specific value changes
	const messages = useChatStore((state) => state.messages);
	const messageGroups = useChatStore((state) => state.messageGroups);
	const isLoading = useChatStore((state) => state.isLoading);
	const selectedTopic = useChatStore((state) => state.selectedTopic);
	const selectedAgentFlowId = useChatStore(
		(state) => state.selectedAgentFlowId,
	);
	const availableAgents = useAgentConfigStore((state) => state.availableAgents);
	const agentFlowName = availableAgents.find(
		(a) => a.id === selectedAgentFlowId,
	)?.name;

	// Action selectors - stable references, won't cause re-renders
	const setSelectedTopic = useChatStore((state) => state.setSelectedTopic);
	const setSelectedAgentFlowId = useChatStore(
		(state) => state.setSelectedAgentFlowId,
	);
	const addMessage = useChatStore((state) => state.addMessage);
	const finalizeMessage = useChatStore((state) => state.finalizeMessage);
	const setLoading = useChatStore((state) => state.setLoading);
	const ensureMainConversation = useChatStore(
		(state) => state.ensureMainConversation,
	);
	const loadMessageGroup = useChatStore((state) => state.loadMessageGroup);
	const deleteMessages = useChatStore((state) => state.deleteMessages);

	const isCustomMode =
		selectedAgentFlowId !== null && selectedAgentFlowId !== "chat";

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

	// Sync selectedTopic with last message's topic only if no topic has been selected yet
	useEffect(() => {
		if (!isCustomMode) return;
		if (selectedTopic !== "default") return;

		// Find the last user or assistant message (skip separators)
		const lastMessage = messages
			.filter((msg) => msg.type !== "separator")
			.findLast((msg) => msg.role === "user" || msg.role === "assistant");

		if (lastMessage?.topicId) {
			setSelectedTopic(lastMessage.topicId);
		}
	}, [messages, isCustomMode]);

	// Stop current chat request
	const handleStop = () => {
		if (abortController) {
			abortController.abort();
			setAbortController(null);
			setLoading(false);
			setStatus("ready");
		}
	};

	// Insert a separator message and reset sandbox container state
	const insertSeparator = async () => {
		if (isLoading) return;

		try {
			await addMessage({
				role: "system",
				content: "---",
				type: "separator",
				createdAt: new Date(),
			});

			// Reset sandbox container runtime in offscreen so the new conversation segment starts clean
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
			logError("Failed to insert separator:", error);
		}
	};

	const handleSubmit = async (
		e: React.FormEvent,
		attachedImages: File[] = [],
		attachedDocumentRefs: AttachedDocumentRef[] = [],
		contextPrefix?: string,
	) => {
		e.preventDefault();
		if (!inputValue.trim() || isLoading || !model) return;

		const rawInput = inputValue.trim();
		const userMessageContent = contextPrefix
			? `${contextPrefix}\n\n---\n\n${rawInput}`
			: rawInput;
		setInputValue("");
		setStatus("submitted");
		setLoading(true);

		// Create abort controller for this request
		const controller = new AbortController();
		setAbortController(controller);

		let assistantMessage: Message | null = null;
		let currentContent = "";
		let currentComplexContent: ComplexContent | null = null;
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
			// Separate document refs by kind
			const imageRefs = attachedDocumentRefs.filter(
				(r) => r.docType === "image",
			);
			const docRefs = attachedDocumentRefs.filter((r) => r.docType !== "image");

			// Extract text from non-image document refs and prepend as formatted blocks
			let effectiveMessageContent = userMessageContent;
			if (docRefs.length > 0) {
				const blocks = await Promise.all(
					docRefs.map(async (ref) => {
						try {
							const bytes = await documentFileSystemService.getFileContent(
								ref.path,
							);
							const text = await extractDocumentText(ref.docType, bytes);
							return text ? formatDocumentBlock(ref.path, text) : null;
						} catch {
							return null;
						}
					}),
				);
				const validBlocks = blocks.filter(Boolean).join("\n");
				if (validBlocks) {
					effectiveMessageContent = validBlocks + "\n" + userMessageContent;
				}
			}

			// Upload new images and merge with image document refs to build complexContent
			let complexContent: ComplexContent | undefined;
			const imageParts: Array<{
				type: "image";
				path: string;
				mimeType: string;
			}> = [];

			if (attachedImages.length > 0) {
				const uploaded = await Promise.all(
					attachedImages.map(async (file) => {
						const path = await documentFileSystemService.uploadChatImage(file);
						return { type: "image" as const, path, mimeType: file.type };
					}),
				);
				imageParts.push(...uploaded);
			}

			if (imageRefs.length > 0) {
				imageParts.push(
					...imageRefs.map((ref) => ({
						type: "image" as const,
						path: ref.path,
						mimeType: ref.mimeType,
					})),
				);
			}

			const hasExpandedDocumentContent =
				effectiveMessageContent !== userMessageContent;

			if (imageParts.length > 0 || hasExpandedDocumentContent) {
				complexContent = [
					{ type: "text" as const, text: effectiveMessageContent },
					...imageParts,
				];
			}

			// Add user message to store and database
			const userMessage = await addMessage({
				role: "user",
				content: userMessageContent,
				complexContent: complexContent ?? null,
				metadata:
					docRefs.length > 0
						? {
								attachedDocuments: docRefs,
							}
						: undefined,
				// Include topicId when in custom mode with a selected topic
				topicId:
					isCustomMode &&
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

			// Build messages for the API, prefixing assistant messages with their stored actions
			// buildSendMessages is async because it resolves image paths to base64 data URIs
			let sendMessages: ChatMessage[] =
				await buildSendMessages(relevantMessages);

			// Trim input to CONTEXT_BUDGET_RATIO of the context window,
			// leaving headroom for the model's response.
			const maxModelTokens =
				await serviceManager.llmService.getMaxModelTokens(model);
			const tokenBudget = Math.floor(maxModelTokens * CONTEXT_BUDGET_RATIO);
			if (estimatePromptTokens(sendMessages) > tokenBudget) {
				sendMessages = trimToContextBudget(sendMessages, tokenBudget);
			}

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
				complexContent: null,
				actions: [],
			});

			// Execute chat via chat service
			const result = await chatService.chatStream(
				{
					messages: sendMessages,
					model: model,
					mode: isCustomMode ? "custom" : "normal",
					topicId:
						isCustomMode && selectedTopic && selectedTopic !== "__all__"
							? selectedTopic
							: undefined,
					agentFlowId: selectedAgentFlowId ?? undefined,
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
					onContentParts: (parts) => {
						currentComplexContent = cloneComplexContent(parts);
						setInProgressMessage((prev) =>
							prev
								? {
										...prev,
										complexContent: currentComplexContent,
									}
								: null,
						);
					},
					onAction: (actions) => {
						// Only update in-progress message, not the store
						setInProgressMessage((prev) =>
							prev ? { ...prev, actions: cloneActions(actions) } : null,
						);
					},
					onExecuteStart: (event) => {
						setInProgressMessage((prev) =>
							prev ? { ...prev, executeState: event } : null,
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

			// Use actual token count from API if available, otherwise estimate (~4 chars per token)
			const totalTokens =
				result.usage?.total_tokens ?? Math.round(result.content.length / 4);
			const outputTokens =
				result.usage?.completion_tokens ??
				Math.round(result.content.length / 4);
			const tokensPerSecond =
				timeToAnswer > 0 ? outputTokens / timeToAnswer : 0;

			// Handle completion or failure after stream finishes
			if (result.failed) {
				const errorMessage =
					result.errorMetadata?.message || result.error || "Chat failed";
				const errorContent =
					result.content ||
					"Sorry, I encountered an error processing your message.";
				await finalizeMessage(assistantMessage.id, {
					content: errorContent,
					complexContent: cloneComplexContent(result.contentParts),
					metadata: {
						actions: result.actions,
						tool_calls: cloneToolCalls(result.toolCalls),
						error: result.errorMetadata ?? {
							message: errorMessage,
							rawMessage: result.error || errorMessage,
						},
						model: model,
						provider: provider,
						timeToAnswer: timeToAnswer,
						tokensPerSecond: tokensPerSecond,
						estimatedTokens: totalTokens,
						...(agentFlowName && { agentFlowName }),
					},
				});
				setInProgressMessage(null);
				setStatus("error");
				return;
			} else {
				// Success - update in-progress message with final content before saving
				// This ensures smooth transition from streaming to final
				setInProgressMessage((prev) =>
					prev
						? {
								...prev,
								content: result.content,
								complexContent: cloneComplexContent(result.contentParts),
								actions: cloneActions(result.actions),
							}
						: null,
				);

				// Small delay to let React render the updated content
				await new Promise((resolve) => setTimeout(resolve, 150));

				// Finalize with final content and actions
				await finalizeMessage(assistantMessage.id, {
					content: result.content,
					complexContent: cloneComplexContent(result.contentParts),
					metadata: {
						actions: result.actions,
						tool_calls: cloneToolCalls(result.toolCalls),
						model: model,
						provider: provider,
						timeToAnswer: timeToAnswer,
						tokensPerSecond: tokensPerSecond,
						estimatedTokens: totalTokens,
						...(agentFlowName && { agentFlowName }),
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
							complexContent: cloneComplexContent(currentComplexContent),
							metadata: {
								actions: inProgressMessage?.actions || [],
								...(agentFlowName && { agentFlowName }),
							},
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
			const errorMetadata = createJobErrorMetadata(error);

			// Update error message if assistant message exists, otherwise create new one
			if (assistantMessage) {
				const errorContent =
					"Sorry, I encountered an error processing your message.";
				await finalizeMessage(assistantMessage.id, {
					content: currentContent || errorContent,
					complexContent: cloneComplexContent(currentComplexContent),
					metadata: {
						error: errorMetadata,
						model,
						provider,
						...(agentFlowName && { agentFlowName }),
					},
				});
			} else {
				await addMessage({
					role: "assistant",
					content: "Sorry, I encountered an error processing your message.",
					metadata: {
						error: errorMetadata,
						model,
						provider,
						...(agentFlowName && { agentFlowName }),
					},
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
		chatMode: isCustomMode ? "custom" : "normal",
		setChatMode: () => undefined,
		selectedTopic,
		setSelectedTopic,
		selectedAgentFlowId,
		setSelectedAgentFlowId,
		messages,
		messageGroups,
		isLoading,
		abortController,
		inProgressMessage,
		handleSubmit,
		handleStop,
		insertSeparator,
		loadMessageGroup,
		deleteMessages,
	} as const;
};
