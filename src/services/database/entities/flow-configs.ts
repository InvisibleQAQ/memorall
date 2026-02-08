import {
	pgTable,
	uuid,
	text,
	jsonb,
	timestamp,
	index,
	uniqueIndex,
} from "drizzle-orm/pg-core";
import { defaultNowToTrigger } from "../utils/default-now-to-trigger";
import { flows } from "./flows";

const tableName = "flow_configs";

export const flowConfigs = pgTable(
	tableName,
	{
		id: uuid("id").primaryKey().defaultRandom(),
		flowId: uuid("flow_id")
			.notNull()
			.references(() => flows.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		type: text("type").notNull(),
		value: jsonb("value"),
		metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => [
		index("flow_configs_flow_id_idx").on(table.flowId),
		index("flow_configs_name_idx").on(table.name),
		index("flow_configs_type_idx").on(table.type),
		uniqueIndex("flow_configs_flow_id_name_idx").on(table.flowId, table.name),
	],
);

export type FlowConfig = typeof flowConfigs.$inferSelect;
export type NewFlowConfig = typeof flowConfigs.$inferInsert;

export const flowConfigsTriggers = [defaultNowToTrigger(tableName)];
