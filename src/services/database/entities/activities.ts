import { pgTable, uuid, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { defaultNowToTrigger } from "../utils/default-now-to-trigger";
import { activitySessions } from "./activity-sessions";

const tableName = "activities";

export const activities = pgTable(tableName, {
	id: text("id").primaryKey(),
	sessionId: text("session_id")
		.notNull()
		.references(() => activitySessions.id, { onDelete: "cascade" }),
	type: text("type").notNull(), // 'page_visit' | 'network_request' | 'user_input' | 'click' | 'scroll' | 'navigation' | 'form_submit'
	timestamp: timestamp("timestamp").notNull(),
	data: jsonb("data").$type<Record<string, unknown>>().notNull(),
	createdAt: timestamp("created_at").notNull(),
	updatedAt: timestamp("updated_at").notNull(),
});

export type Activity = typeof activities.$inferSelect;
export type NewActivity = typeof activities.$inferInsert;

// Database trigger commands to automatically set timestamps
export const activitiesTriggers = [defaultNowToTrigger(tableName)];
