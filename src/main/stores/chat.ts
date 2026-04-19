import { create } from "zustand";
import {
	and,
	asc,
	desc,
	eq,
	gt,
	lt,
	ne,
} from "drizzle-orm";
import {
	type Message,
	type Conversation,
	type NewConversation,
} from "@/services/database/types";
import { serviceManager } from "@/services";
import { logError } from "@/utils/logger";
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
	currentConversation: Conversation | null;
	isLoading: boolean;
	chatMode: ChatMode;
	selectedTopic: string;
	selectedAgentFlowId: string | null;

	// Actions
	addMessage: (message: Partial<Message>) => Promise<Message>;
	updateMessage: (id: string, message: Partial<Message>) => void;
	finalizeMessage: (id: string, message: Partial<Message>) => Promise<void>;
	loadConversation: (id: string) => Promise<void>;
	loadMessageGroup: (groupId: string) => Promise<void>;
	createNewConversation: (title?: string) => Promise<Conversation>;
	ensureMainConversation: () => Promise<Conversation>;
	clearMessages: () => void;
	deleteMessages: () => void;
	setLoading: (loading: boolean) => void;
	setChatMode: (mode: ChatMode) => void;
	setSelectedTopic: (topicId: string) => void;
	setSelectedAgentFlowId: (flowId: string | null) => void;

	// Database sync
	syncWithDB: () => Promise<void>;
}

/**
 * Sanitize a value so it is safe to store in a Postgres jsonb column.
 * - undefined -> null (undefined is not valid JSON)
 * - Date -> ISO string
 * - BigInt -> string
 * - functions / symbols -> null
 * - circular references are broken (replaced with null)
 */
function sanitizeForJson(value: unknown, seen = new WeakSet()): unknown {
	if (value === undefined) return null;
	if (value === null) return null;

	const type = typeof value;
	if (type === "string" || type === "number" || type === "boolean") {
		return value;
	}
	if (type === "bigint") return value.toString();
	if (type === "function" || type === "symbol") return null;

	if (value instanceof Date) return value.toISOString();

	if (Array.isArray(value)) {
		return value.map((item) => sanitizeForJson(item, seen));
	}

	if (type === "object") {
		if (seen.has(value as object)) return null;
		seen.add(value as object);
		const result: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
			result[k] = sanitizeForJson(v, seen);
		}
		return result;
	}

	return null;
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

const createGroupsFromSeparators = (
	separators: Message[],
): ChatMessageGroup[] => {
	const groups: ChatMessageGroup[] = [];
	let previousSeparator: Message | null = null;

	for (const separator of separators) {
		groups.push({
			id: buildCompletedGroupId(separator),
			previousSeparator,
			separator,
			messages: [],
			isLatest: false,
			isLoaded: false,
			isLoading: false,
		});
		previousSeparator = separator;
	}

	groups.push(createLatestGroup(previousSeparator));
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
	const querySeparators = async (conversationId: string) =>
		serviceManager.databaseService.use(({ db, schema }) =>
			db
				.select()
				.from(schema.messages)
				.where(
					and(
						eq(schema.messages.conversationId, conversationId),
						eq(schema.messages.type, "separator"),
					),
				)
				.orderBy(asc(schema.messages.createdAt)),
		);

	const queryGroupMessages = async (
		conversationId: string,
		group: Pick<ChatMessageGroup, "previousSeparator" | "separator">,
	) => {
		return serviceManager.databaseService.use(({ db, schema }) => {
			const conditions = [
				eq(schema.messages.conversationId, conversationId),
				ne(schema.messages.type, "separator"),
			];

			if (group.previousSeparator) {
				conditions.push(
					gt(schema.messages.createdAt, group.previousSeparator.createdAt),
				);
			}

			if (group.separator) {
				conditions.push(lt(schema.messages.createdAt, group.separator.createdAt));
			}

			return db
				.select()
				.from(schema.messages)
				.where(and(...conditions))
				.orderBy(asc(schema.messages.createdAt));
		});
	};

	const hydrateConversation = async (conversation: Conversation) => {
		const separators = await querySeparators(conversation.id);
		const initialGroups = createGroupsFromSeparators(separators);
		const latestGroup = getLatestGroup(initialGroups) ?? createLatestGroup(null);
		const latestMessages = await queryGroupMessages(conversation.id, latestGroup);
		const messageGroups = initialGroups.map((group) =>
			group.isLatest
				? {
						...group,
						messages: latestMessages,
						isLoaded: true,
					}
				: group,
		);

		set({
			currentConversation: conversation,
			messageGroups,
			messages: latestMessages,
		});

		return conversation;
	};

	return {
		messages: [],
		messageGroups: [createLatestGroup(null)],
		currentConversation: null,
		isLoading: false,
		chatMode: "knowledge",
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
						: replaceGroup(state.messageGroups, existingLatestGroup.id, () =>
								nextLatestGroup,
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
					messageGroups: [createLatestGroup(null)],
					messages: [],
				});
				return conversation;
			} catch (error) {
				logError("Failed to create conversation:", error);
				throw error;
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

		loadMessageGroup: async (groupId: string) => {
			const state = get();
			const conversationId = state.currentConversation?.id;
			const group = state.messageGroups.find((item) => item.id === groupId);

			if (
				!conversationId ||
				!group ||
				group.isLatest ||
				group.isLoaded ||
				group.isLoading
			) {
				return;
			}

			set((current) => ({
				messageGroups: replaceGroup(current.messageGroups, groupId, (currentGroup) =>
					currentGroup.isLoading
						? currentGroup
						: { ...currentGroup, isLoading: true },
				),
			}));

			try {
				const messages = await queryGroupMessages(conversationId, group);
				set((current) => ({
					messageGroups: replaceGroup(current.messageGroups, groupId, () => ({
						...group,
						messages,
						isLoaded: true,
						isLoading: false,
					})),
				}));
			} catch (error) {
				logError("Failed to load message group:", error);
				set((current) => ({
					messageGroups: replaceGroup(current.messageGroups, groupId, (item) => ({
						...item,
						isLoading: false,
					})),
				}));
			}
		},

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
