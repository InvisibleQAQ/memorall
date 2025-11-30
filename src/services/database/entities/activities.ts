import { pgTable, uuid, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { defaultNowToTrigger } from "../utils/default-now-to-trigger";
import { activitySessions } from "./activity-sessions";

const tableName = "activities";

/**
 * Display metadata for user-friendly rendering
 * Extracted from activity data for quick access
 */
export interface ActivityDisplayMeta {
	// Common display fields
	title?: string; // User-friendly title (e.g., "Read article: XYZ", "Watched video: ABC")
	icon?: string; // Emoji or icon identifier
	summary?: string; // One-line summary

	// Context for rich display
	pageTitle?: string;
	pageUrl?: string;
	domain?: string;

	// Content preview
	contentPreview?: string; // Excerpt of content (for reading events)
	thumbnailUrl?: string; // For videos/images

	// Metadata
	duration?: number; // For videos, calls, reading sessions
	wordCount?: number; // For reading events

	[key: string]: unknown;
}

export const activities = pgTable(tableName, {
	id: text("id").primaryKey(),
	sessionId: text("session_id")
		.notNull()
		.references(() => activitySessions.id, { onDelete: "cascade" }),
	type: text("type").notNull(), // 'page_visit' | 'network_request' | 'user_input' | 'click' | 'scroll' | 'navigation' | 'form_submit' | 'content_reading' | 'youtube_video' | 'video_watching' | 'video_call'
	timestamp: timestamp("timestamp").notNull(),
	data: jsonb("data").$type<Record<string, unknown>>().notNull(),
	displayMeta: jsonb("display_meta").$type<ActivityDisplayMeta>(), // User-friendly metadata for quick rendering
	createdAt: timestamp("created_at").notNull(),
	updatedAt: timestamp("updated_at").notNull(),
});

export type Activity = typeof activities.$inferSelect;
export type NewActivity = typeof activities.$inferInsert;

// Database trigger commands to automatically set timestamps
export const activitiesTriggers = [defaultNowToTrigger(tableName)];
