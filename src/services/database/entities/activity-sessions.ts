import {
	pgTable,
	uuid,
	text,
	timestamp,
	integer,
	jsonb,
} from "drizzle-orm/pg-core";
import { defaultNowToTrigger } from "../utils/default-now-to-trigger";

const tableName = "activity_sessions";

export const activitySessions = pgTable(tableName, {
	id: text("id").primaryKey(),
	startTime: timestamp("start_time").notNull(),
	endTime: timestamp("end_time"),
	totalActivities: integer("total_activities").notNull().default(0),
	status: text("status").notNull(), // 'active' | 'stopped'
	metadata: jsonb("metadata")
		.$type<Record<string, unknown>>()
		.notNull()
		.default({}),
	createdAt: timestamp("created_at").notNull(),
	updatedAt: timestamp("updated_at").notNull(),
});

export type ActivitySession = typeof activitySessions.$inferSelect;
export type NewActivitySession = typeof activitySessions.$inferInsert;

// Database trigger commands to automatically set timestamps
export const activitySessionsTriggers = [defaultNowToTrigger(tableName)];
