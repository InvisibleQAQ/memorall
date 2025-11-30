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

/**
 * Metadata structure for activity sessions
 * User-friendly information for display
 */
export interface SessionMetadata {
	// User-friendly display
	title?: string; // Auto-generated title like "Morning browsing session"
	description?: string; // AI-generated summary of what user did
	primaryDomains?: string[]; // Main websites visited
	highlights?: string[]; // Key moments in the session

	// Context
	device?: string;
	browser?: string;

	// Legacy fields
	[key: string]: unknown;
}

export const activitySessions = pgTable(tableName, {
	id: text("id").primaryKey(),
	startTime: timestamp("start_time").notNull(),
	endTime: timestamp("end_time"),
	totalActivities: integer("total_activities").notNull().default(0),
	status: text("status").notNull(), // 'active' | 'stopped'
	metadata: jsonb("metadata")
		.$type<SessionMetadata>()
		.notNull()
		.default({}),
	createdAt: timestamp("created_at").notNull(),
	updatedAt: timestamp("updated_at").notNull(),
});

export type ActivitySession = typeof activitySessions.$inferSelect;
export type NewActivitySession = typeof activitySessions.$inferInsert;

// Database trigger commands to automatically set timestamps
export const activitySessionsTriggers = [defaultNowToTrigger(tableName)];
