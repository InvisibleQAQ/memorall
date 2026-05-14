import { create } from "zustand";
import { asc, desc, eq } from "drizzle-orm";
import {
	type Message,
	type Conversation,
	type NewConversation,
} from "@/services/database/types";
import { serviceManager } from "@/services";
import { logError } from "@/utils/logger";
import { sanitizeForJson } from "@/utils/sanitize-json";
import { v4 } from "@/utils/uuid";
import type { ChatMode } from "@/main/modules/chat/services/chat-service";

export interface ChatMessageGroup {
	id: string;
	previousSeparator: Message | null;
	separator: Message | null;
	messages: Message[];
	isLatest: boolean;
	isLoaded: boolean;
	isLoading: boolean;
}

interface ChatStore {
	// State
	messages: Message[];
	messageGroups: ChatMessageGroup[];
	conversations: Conversation[];
	currentConversation: Conversation | null;
	isLoading: boolean;
	chatMode: ChatMode;
	selectedTopic: string;
	selectedAgentFlowId: string | null;

	// Actions
	addMessage: (message: Partial<Message>) => Promise<Message>;
	updateMessage: (id: string, message: Partial<Message>) => void;
	persistMessageContent: (id: string, content: string) => Promise<void>;
	finalizeMessage: (id: string, message: Partial<Message>) => Promise<void>;
	loadConversation: (id: string) => Promise<void>;
	loadConversations: () => Promise<void>;
	loadMessageGroup: (groupId: string) => Promise<void>;
	createNewConversation: (title?: string) => Promise<Conversation>;
	ensureMainConversation: () => Promise<Conversation>;
	deleteConversation: (id: string) => Promise<void>;
	clearMessages: () => void;
	deleteMessages: () => void;
	setLoading: (loading: boolean) => void;
	setChatMode: (mode: ChatMode) => void;
	setSelectedTopic: (topicId: string) => void;
	setSelectedAgentFlowId: (flowId: string | null) => void;

	// Database sync
	syncWithDB: () => Promise<void>;
}

const buildLatestGroupId = (previousSeparator: Message | null) =>
	`group:latest:${previousSeparator?.id ?? "root"}`;

const buildCompletedGroupId = (separator: Message) => `group:${separator.id}`;

const createLatestGroup = (
	previousSeparator: Message | null,
	messages: Message[] = [],
): ChatMessageGroup => ({
	id: buildLatestGroupId(previousSeparator),
	previousSeparator,
	separator: null,
	messages,
	isLatest: true,
	isLoaded: true,
	isLoading: false,
});

const createGroupsFromOrderedMessages = (
	orderedMessages: Message[],
): ChatMessageGroup[] => {
	const groups: ChatMessageGroup[] = [];
	let previousSeparator: Message | null = null;
	let currentMessages: Message[] = [];

	for (const message of orderedMessages) {
		if (message.type === "separator") {
			groups.push({
				id: buildCompletedGroupId(message),
				previousSeparator,
				separator: message,
				messages: currentMessages,
				isLatest: false,
				isLoaded: true,
				isLoading: false,
			});
			previousSeparator = message;
			currentMessages = [];
			continue;
		}

		currentMessages.push(message);
	}

	groups.push(createLatestGroup(previousSeparator, currentMessages));
	return groups;
};

const getLatestGroup = (
	groups: ChatMessageGroup[],
): ChatMessageGroup | undefined => groups.find((group) => group.isLatest);

const replaceGroup = (
	groups: ChatMessageGroup[],
	groupId: string,
	updater: (group: ChatMessageGroup) => ChatMessageGroup,
) => groups.map((group) => (group.id === groupId ? updater(group) : group));

const replaceMessageInGroups = (
	groups: ChatMessageGroup[],
	messageId: string,
	message: Partial<Message>,
) =>
	groups.map((group) => ({
		...group,
		messages: group.messages.map((current) =>
			current.id === messageId ? { ...current, ...message } : current,
		),
	}));

export const useChatStore = create<ChatStore>((set, get) => {
	const queryConversationMessages = async (conversationId: string) =>
		serviceManager.databaseService.use(({ db, schema }) =>
			db
				.select()
				.from(schema.messages)
				.where(eq(schema.messages.conversationId, conversationId))
				.orderBy(asc(schema.messages.createdAt)),
		);

	const hydrateConversation = async (conversation: Conversation) => {
		const orderedMessages = await queryConversationMessages(conversation.id);
		const messageGroups = createGroupsFromOrderedMessages(orderedMessages);
		const latestGroup =
			getLatestGroup(messageGroups) ?? createLatestGroup(null);

		set({
			currentConversation: conversation,
			messageGroups,
			messages: latestGroup.messages,
		});

		return conversation;
	};

	return {
		messages: [],
		messageGroups: [createLatestGroup(null)],
		currentConversation: null,
		conversations: [],
		isLoading: false,
		chatMode: "custom",
		selectedTopic: "default",
		selectedAgentFlowId: null,

		addMessage: async (messageData) => {
			let conversationId = messageData.conversationId;
			if (!conversationId && !get().currentConversation) {
				const conversation = await get().createNewConversation();
				conversationId = conversation.id;
			} else if (get().currentConversation) {
				conversationId = get().currentConversation!.id;
			}

			const messageId = messageData.id || v4();
			const now = messageData.createdAt ?? new Date();

			const message = {
				...messageData,
				id: messageId,
				conversationId,
				type: messageData.type ?? "text",
				createdAt: now,
				updatedAt: messageData.updatedAt ?? now,
			} as Message;

			if (!message.role || !message.conversationId) {
				throw new Error("Message must have a role and conversationId");
			}

			set((state) => {
				const existingLatestGroup =
					getLatestGroup(state.messageGroups) ?? createLatestGroup(null);

				if (message.type === "separator") {
					const groupsWithoutLatest = state.messageGroups.filter(
						(group) => !group.isLatest,
					);
					const completedGroup: ChatMessageGroup = {
						...existingLatestGroup,
						id: buildCompletedGroupId(message),
						separator: message,
						isLatest: false,
					};
					const nextLatestGroup = createLatestGroup(message);

					return {
						messages: [],
						messageGroups: [
							...groupsWithoutLatest,
							completedGroup,
							nextLatestGroup,
						],
					};
				}

				const nextLatestGroup: ChatMessageGroup = {
					...existingLatestGroup,
					messages: [...existingLatestGroup.messages, message],
				};
				const nextGroups =
					state.messageGroups.length === 0
						? [nextLatestGroup]
						: replaceGroup(
								state.messageGroups,
								existingLatestGroup.id,
								() => nextLatestGroup,
							);

				return {
					messages: [...state.messages, message],
					messageGroups: nextGroups,
				};
			});

			try {
				await serviceManager.databaseService.use(({ db, schema }) =>
					db.insert(schema.messages).values(message).onConflictDoNothing(),
				);
			} catch (error) {
				logError("Failed to save message to database:", error);
			}

			return message;
		},

		updateMessage: (id, message) => {
			set((state) => ({
				messages: state.messages.map((msg) =>
					msg.id === id ? { ...msg, ...message } : msg,
				),
				messageGroups: replaceMessageInGroups(state.messageGroups, id, message),
			}));
		},

		persistMessageContent: async (id, content) => {
			const updatedAt = new Date();

			try {
				await serviceManager.databaseService.use(({ db, schema }) =>
					db
						.update(schema.messages)
						.set({ content, updatedAt })
						.where(eq(schema.messages.id, id)),
				);

				set((state) => ({
					messages: state.messages.map((msg) =>
						msg.id === id ? { ...msg, content, updatedAt } : msg,
					),
					messageGroups: replaceMessageInGroups(state.messageGroups, id, {
						content,
						updatedAt,
					}),
				}));
			} catch (error) {
				logError("Failed to persist message content:", error);
				throw error;
			}
		},

		finalizeMessage: async (id, inputMessage) => {
			const message = get().messages.find((msg) => msg.id === id);
			try {
				const cleanContent = (
					inputMessage.content ||
					message?.content ||
					""
				).replace(
					/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu,
					"",
				);

				const mergedMetadata = sanitizeForJson({
					...(message?.metadata || {}),
					...(inputMessage?.metadata || {}),
				}) as Record<string, unknown>;

				const updatedMessage = {
					...message,
					...inputMessage,
					role: inputMessage.role || message?.role || "user",
					content: cleanContent,
					metadata: mergedMetadata,
				};

				await serviceManager.databaseService.use(({ db, schema }) =>
					db
						.update(schema.messages)
						.set(updatedMessage)
						.where(eq(schema.messages.id, id)),
				);

				set((state) => ({
					messages: state.messages.map((msg) =>
						msg.id === id ? { ...msg, ...updatedMessage } : msg,
					),
					messageGroups: replaceMessageInGroups(
						state.messageGroups,
						id,
						updatedMessage,
					),
				}));
			} catch (error) {
				logError("Failed to finalize message in database:", error);
			}
		},

		createNewConversation: async (title?: string) => {
			try {
				const newConversation: NewConversation = {
					title: title || "Main Chat",
					metadata: {
						createdAt: new Date().toISOString(),
					},
				};

				const conversation = await serviceManager.databaseService.use(
					async ({ db, schema }) => {
						const [created] = await db
							.insert(schema.conversations)
							.values(newConversation)
							.returning();
						return created;
					},
				);

				set({
					currentConversation: conversation,
					conversations: [
						conversation,
						...get().conversations.filter(
							(item) => item.id !== conversation.id,
						),
					],
					messageGroups: [createLatestGroup(null)],
					messages: [],
				});
				return conversation;
			} catch (error) {
				logError("Failed to create conversation:", error);
				throw error;
			}
		},

		loadConversations: async () => {
			try {
				const conversations = await serviceManager.databaseService.use(
					({ db, schema }) =>
						db
							.select()
							.from(schema.conversations)
							.orderBy(
								desc(schema.conversations.updatedAt),
								desc(schema.conversations.createdAt),
							)
							.limit(50),
				);

				set({ conversations });
			} catch (error) {
				logError("Failed to load conversations:", error);
			}
		},

		ensureMainConversation: async () => {
			try {
				const existing = await serviceManager.databaseService.use(
					({ db, schema }) =>
						db
							.select()
							.from(schema.conversations)
							.orderBy(desc(schema.conversations.createdAt))
							.limit(1),
				);

				if (existing.length > 0) {
					return await hydrateConversation(existing[0]);
				}

				return await get().createNewConversation("Main Chat");
			} catch (error) {
				logError("Failed to ensure main conversation:", error);
				throw error;
			}
		},

		loadConversation: async (id: string) => {
			try {
				const conversation = await serviceManager.databaseService.use(
					async ({ db, schema }) => {
						const [conv] = await db
							.select()
							.from(schema.conversations)
							.where(eq(schema.conversations.id, id));
						return conv;
					},
				);

				if (!conversation) {
					throw new Error("Conversation not found");
				}

				await hydrateConversation(conversation);
			} catch (error) {
				logError("Failed to load conversation:", error);
				throw error;
			}
		},

		deleteConversation: async (id: string) => {
			try {
				let nextConversation: Conversation | undefined;

				await serviceManager.databaseService.use(async ({ db, schema }) => {
					await db
						.delete(schema.messages)
						.where(eq(schema.messages.conversationId, id));
					await db
						.delete(schema.conversations)
						.where(eq(schema.conversations.id, id));

					const [next] = await db
						.select()
						.from(schema.conversations)
						.orderBy(
							desc(schema.conversations.updatedAt),
							desc(schema.conversations.createdAt),
						)
						.limit(1);
					nextConversation = next;
				});

				set((state) => ({
					conversations: state.conversations.filter(
						(conversation) => conversation.id !== id,
					),
				}));

				if (get().currentConversation?.id === id) {
					if (nextConversation) {
						await hydrateConversation(nextConversation);
					} else {
						set({
							currentConversation: null,
							messages: [],
							messageGroups: [createLatestGroup(null)],
						});
					}
				}

				await get().loadConversations();
			} catch (error) {
				logError("Failed to delete conversation:", error);
				throw error;
			}
		},

		loadMessageGroup: async () => {},

		clearMessages: () => {
			set({
				messages: [],
				messageGroups: [createLatestGroup(null)],
				currentConversation: null,
			});
		},

		deleteMessages: async () => {
			await serviceManager.databaseService.use(({ db, schema }) =>
				db.delete(schema.messages),
			);
			set({
				messages: [],
				messageGroups: [createLatestGroup(null)],
				currentConversation: null,
			});
		},

		setLoading: (loading: boolean) => {
			set({ isLoading: loading });
		},

		setChatMode: (mode: ChatMode) => {
			set({ chatMode: mode });
		},

		setSelectedTopic: (topicId: string) => {
			set({ selectedTopic: topicId });
		},

		setSelectedAgentFlowId: (flowId: string | null) => {
			set({ selectedAgentFlowId: flowId });
		},

		syncWithDB: async () => {
			try {
				if (!get().currentConversation) return;
				await get().loadConversation(get().currentConversation!.id);
			} catch (error) {
				logError("Failed to sync with database:", error);
			}
		},
	};
});
