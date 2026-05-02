import {
	boolean,
	index,
	jsonb,
	pgTable,
	text,
	timestamp,
	uuid,
	integer,
} from "drizzle-orm/pg-core";
import { defaultNowToTrigger } from "../utils/default-now-to-trigger";
import { flows } from "./flows";
import { conversation } from "./conversations";

const tableName = "cron_jobs";

export type CronJobStatus = "active" | "paused" | "draft";
export type CronJobLastStatus =
	| "idle"
	| "running"
	| "success"
	| "failed"
	| "skipped";
export type CronJobActionType = string;

export interface AgentChatCronPayload {
	prompt: string;
	agentFlowId: string;
	model?: string;
	topicId?: string;
	streamConfig?: {
		minWordsToStream?: number;
		streamToolCallsImmediately?: boolean;
	};
}

export type CronJobActionPayload = Record<string, unknown>;

export const cronJobs = pgTable(
	tableName,
	{
		id: uuid("id").primaryKey().defaultRandom(),
		name: text("name").notNull(),
		status: text("status").$type<CronJobStatus>().notNull().default("draft"),
		scheduleExpression: text("schedule_expression").notNull(),
		timezone: text("timezone").notNull(),
		actionType: text("action_type")
			.$type<CronJobActionType>()
			.notNull()
			.default("agent_chat"),
		actionPayload: jsonb("action_payload")
			.$type<CronJobActionPayload>()
			.notNull()
			.default({}),
		agentFlowId: uuid("agent_flow_id").references(() => flows.id, {
			onDelete: "cascade",
		}),
		conversationId: uuid("conversation_id").references(() => conversation.id, {
			onDelete: "set null",
		}),
		allowOverlap: boolean("allow_overlap").notNull().default(false),
		lastRunAt: timestamp("last_run_at"),
		nextRunAt: timestamp("next_run_at"),
		lastStatus: text("last_status")
			.$type<CronJobLastStatus>()
			.notNull()
			.default("idle"),
		lastError: text("last_error"),
		runCount: integer("run_count").notNull().default(0),
		metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => [
		index("cron_jobs_status_next_run_at_idx").on(table.status, table.nextRunAt),
		index("cron_jobs_agent_flow_id_idx").on(table.agentFlowId),
		index("cron_jobs_conversation_id_idx").on(table.conversationId),
	],
);

export type CronJob = typeof cronJobs.$inferSelect;
export type NewCronJob = typeof cronJobs.$inferInsert;

export const cronJobsTriggers = [defaultNowToTrigger(tableName)];
