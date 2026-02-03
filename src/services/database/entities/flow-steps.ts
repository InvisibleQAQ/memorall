import { pgTable, uuid, text, jsonb, timestamp, boolean, index } from "drizzle-orm/pg-core";
import { defaultNowToTrigger } from "../utils/default-now-to-trigger";
import { flows } from "./flows";

const tableName = "flow_steps";

export const flowSteps = pgTable(
	tableName,
	{
		id: uuid("id").primaryKey().defaultRandom(),
		name: text("name").notNull(),
		type: text("type").notNull(),
		isStart: boolean("is_start").notNull().default(false),
		isEnd: boolean("is_end").notNull().default(false),
		flowId: uuid("flow_id")
			.notNull()
			.references(() => flows.id, { onDelete: "cascade" }),
		metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => [
		index("flow_states_flow_id_idx").on(table.flowId),
		index("flow_steps_name_idx").on(table.name),
		index("flow_steps_type_idx").on(table.type),
		index("flow_steps_is_start_idx").on(table.isStart),
		index("flow_steps_is_end_idx").on(table.isEnd),
	],
);

export type FlowStep = typeof flowSteps.$inferSelect;
export type NewFlowStep = typeof flowSteps.$inferInsert;

export const flowStepsTriggers = [defaultNowToTrigger(tableName)];
