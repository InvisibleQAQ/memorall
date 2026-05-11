import { and, asc, desc, eq, gt, ne } from "drizzle-orm";
import { serviceManager } from "@/services";
import { v4 } from "@/utils/uuid";
import { backgroundProcessFactory } from "./process-factory";
import type {
	BaseJob,
	ItemHandlerResult,
	ProcessDependencies,
	ProcessHandler,
} from "./types";
import type { Message, Conversation } from "@/services/database/types";

export const EMBEDDED_CHAT_HISTORY_JOB_NAME = "embedded-chat-history" as const;

type PersistableMessageRole = "user" | "assistant" | "system";

type StoredMessageInput = {
	id?: string;
	role: PersistableMessageRole;
	content: string;
	createdAt?: Date;
	topicId?: string | null;
	metadata?: Record<string, unknown> | null;
};

export type EmbeddedChatHistoryPayload =
	| { operation: "load" }
	| { operation: "add-message"; message: StoredMessageInput }
	| {
			operation: "finalize-message";
			id: string;
			message: Partial<StoredMessageInput>;
	  }
	| { operation: "insert-separator" };

export interface EmbeddedChatHistoryResult extends Record<string, unknown> {
	conversationId?: string;
	messages?: Message[];
	message?: Message;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null;

const sanitizeForJson = (value: unknown, seen = new WeakSet()): unknown => {
	if (value === undefined || value === null) return null;

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
		for (const [key, item] of Object.entries(
			value as Record<string, unknown>,
		)) {
			result[key] = sanitizeForJson(item, seen);
		}
		return result;
	}

	return null;
};

const ensureMainConversation = async (): Promise<Conversation> => {
	return serviceManager.databaseService.use(async ({ db, schema }) => {
		const existing = await db
			.select()
			.from(schema.conversations)
			.orderBy(desc(schema.conversations.createdAt))
			.limit(1);

		if (existing[0]) {
			return existing[0];
		}

		const [created] = await db
			.insert(schema.conversations)
			.values({
				title: "Main Chat",
				metadata: { createdAt: new Date().toISOString() },
			})
			.returning();

		return created;
	});
};

const loadLatestMessages = async (
	conversationId: string,
): Promise<Message[]> => {
	return serviceManager.databaseService.use(async ({ db, schema }) => {
		const separators = await db
			.select()
			.from(schema.messages)
			.where(
				and(
					eq(schema.messages.conversationId, conversationId),
					eq(schema.messages.type, "separator"),
				),
			)
			.orderBy(asc(schema.messages.createdAt));

		const latestSeparator = separators.at(-1);
		const conditions = [
			eq(schema.messages.conversationId, conversationId),
			ne(schema.messages.type, "separator"),
		];

		if (latestSeparator) {
			conditions.push(gt(schema.messages.createdAt, latestSeparator.createdAt));
		}

		return db
			.select()
			.from(schema.messages)
			.where(and(...conditions))
			.orderBy(asc(schema.messages.createdAt));
	});
};

const addMessage = async (
	conversationId: string,
	input: StoredMessageInput,
	type: string = "text",
): Promise<Message> => {
	const now = input.createdAt ?? new Date();
	const message = {
		id: input.id ?? v4(),
		conversationId,
		type,
		role: input.role,
		content: input.content,
		topicId: input.topicId ?? undefined,
		metadata: sanitizeForJson(input.metadata ?? {}) as Record<string, unknown>,
		createdAt: now,
		updatedAt: now,
	} as Message;

	await serviceManager.databaseService.use(({ db, schema }) =>
		db.insert(schema.messages).values(message).onConflictDoNothing(),
	);

	return message;
};

const finalizeMessage = async (
	id: string,
	input: Partial<StoredMessageInput>,
): Promise<Message | undefined> => {
	return serviceManager.databaseService.use(async ({ db, schema }) => {
		const [existing] = await db
			.select()
			.from(schema.messages)
			.where(eq(schema.messages.id, id))
			.limit(1);

		if (!existing) {
			return undefined;
		}

		const updated = {
			...existing,
			content: input.content ?? existing.content,
			role: input.role ?? existing.role,
			topicId: input.topicId ?? existing.topicId,
			metadata: sanitizeForJson({
				...(isObject(existing.metadata) ? existing.metadata : {}),
				...(input.metadata ?? {}),
			}) as Record<string, unknown>,
			updatedAt: new Date(),
		} as Message;

		await db
			.update(schema.messages)
			.set(updated)
			.where(eq(schema.messages.id, id));

		return updated;
	});
};

class EmbeddedChatHistoryHandler implements ProcessHandler<BaseJob> {
	async process(
		_jobId: string,
		job: BaseJob,
		_dependencies: ProcessDependencies,
	): Promise<ItemHandlerResult> {
		const payload = job.payload as EmbeddedChatHistoryPayload;
		const conversation = await ensureMainConversation();

		switch (payload.operation) {
			case "load":
				return {
					conversationId: conversation.id,
					messages: await loadLatestMessages(conversation.id),
				} satisfies EmbeddedChatHistoryResult;

			case "add-message":
				return {
					conversationId: conversation.id,
					message: await addMessage(conversation.id, payload.message),
				} satisfies EmbeddedChatHistoryResult;

			case "finalize-message":
				return {
					conversationId: conversation.id,
					message: await finalizeMessage(payload.id, payload.message),
				} satisfies EmbeddedChatHistoryResult;

			case "insert-separator":
				await addMessage(
					conversation.id,
					{
						role: "system",
						content: "---",
						createdAt: new Date(),
						metadata: { source: "embedded-chat" },
					},
					"separator",
				);
				return {
					conversationId: conversation.id,
					messages: [],
				} satisfies EmbeddedChatHistoryResult;

			default:
				throw new Error("Unsupported embedded chat history operation");
		}
	}
}

backgroundProcessFactory.register({
	instance: new EmbeddedChatHistoryHandler(),
	jobs: [EMBEDDED_CHAT_HISTORY_JOB_NAME],
});

declare global {
	interface JobTypeRegistry {
		[EMBEDDED_CHAT_HISTORY_JOB_NAME]: EmbeddedChatHistoryPayload;
	}

	interface JobResultRegistry {
		[EMBEDDED_CHAT_HISTORY_JOB_NAME]: EmbeddedChatHistoryResult;
	}
}
