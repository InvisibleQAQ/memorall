import { text, timestamp, uuid, pgTable } from "drizzle-orm/pg-core";
import { topic } from "./topics";

const tableName = "topic_files";
export const topicFiles = pgTable(tableName, {
	id: uuid("uuid").primaryKey().defaultRandom(),
	topicId: uuid("topic_id")
		.references(() => topic.id, { onDelete: "cascade" })
		.notNull(),
	filePath: text("file_path").notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type TopicFile = typeof topicFiles.$inferSelect;
export type NewTopicFile = typeof topicFiles.$inferInsert;
