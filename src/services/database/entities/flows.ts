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

export const flows = pgTable(
	tableName,
	{
		id: uuid("id").primaryKey().defaultRandom(),
		name: text("name").notNull(),
		description: text("description"),
		status: text("status").notNull().default("draft"),
		serviceKeys: jsonb("service_keys").$type<string[]>().notNull().default([]),
		metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => [
		index("flows_name_idx").on(table.name),
		index("flows_status_idx").on(table.status),
		index("flows_updated_at_idx").on(table.updatedAt),
	],
);

export type Flow = typeof flows.$inferSelect;
export type NewFlow = typeof flows.$inferInsert;

export const flowsTriggers = [defaultNowToTrigger(tableName)];
