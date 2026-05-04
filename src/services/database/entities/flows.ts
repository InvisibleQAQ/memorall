import {
	pgTable,
	uuid,
	text,
	jsonb,
	timestamp,
	index,
} from "drizzle-orm/pg-core";
import { defaultNowToTrigger } from "../utils/default-now-to-trigger";

const tableName = "flows";

export type PredefinedFlowKey = "foundation";
export type AgentIconScreenKind = "text" | "emoji";

export interface AgentIconScreenMetadata {
	kind: AgentIconScreenKind;
	value: string;
	color?: string;
}

export interface FlowMetadata {
	agentIconScreen?: AgentIconScreenMetadata;
	[key: string]: unknown;
}

export const flows = pgTable(
	tableName,
	{
		id: uuid("id").primaryKey().defaultRandom(),
		name: text("name").notNull(),
		description: text("description"),
		status: text("status").notNull().default("draft"),
		predefinedFlow: text("predefined_flow"),
		serviceKeys: jsonb("service_keys").$type<string[]>().notNull().default([]),
		metadata: jsonb("metadata").$type<FlowMetadata>().default({}),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => [
		index("flows_name_idx").on(table.name),
		index("flows_status_idx").on(table.status),
		index("flows_updated_at_idx").on(table.updatedAt),
		index("flows_predefined_flow_idx").on(table.predefinedFlow),
	],
);

export type Flow = typeof flows.$inferSelect;
export type NewFlow = typeof flows.$inferInsert;

export const flowsTriggers = [defaultNowToTrigger(tableName)];
