import { pgTable, uuid, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { defaultNowToTrigger } from "../utils/default-now-to-trigger";
import { flows } from "./flows";

const tableName = "flow_states";

export const flowStates = pgTable(
	tableName,
	{
		id: uuid("id").primaryKey().defaultRandom(),
		flowId: uuid("flow_id")
			.notNull()
			.references(() => flows.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		type: text("type").notNull(),
		metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => [
		index("flow_states_flow_id_idx").on(table.flowId),
		index("flow_states_name_idx").on(table.name),
	],
);

export type FlowState = typeof flowStates.$inferSelect;
export type NewFlowState = typeof flowStates.$inferInsert;

export const flowStatesTriggers = [defaultNowToTrigger(tableName)];
