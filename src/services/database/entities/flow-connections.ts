import { pgTable, uuid, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { defaultNowToTrigger } from "../utils/default-now-to-trigger";
import { flows } from "./flows";
import { flowSteps } from "./flow-steps";

const tableName = "flow_connections";

export const flowConnections = pgTable(
	tableName,
	{
		id: uuid("id").primaryKey().defaultRandom(),
		flowId: uuid("flow_id")
			.notNull()
			.references(() => flows.id, { onDelete: "cascade" }),
		sourceStepId: uuid("source_step_id")
			.notNull()
			.references(() => flowSteps.id, { onDelete: "restrict" }),
		targetStepId: uuid("target_step_id")
			.notNull()
			.references(() => flowSteps.id, { onDelete: "restrict" }),
		metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => [
		index("flow_connections_flow_id_idx").on(table.flowId),
		index("flow_connections_source_step_id_idx").on(table.sourceStepId),
		index("flow_connections_target_step_id_idx").on(table.targetStepId),
	],
);

export type FlowConnection = typeof flowConnections.$inferSelect;
export type NewFlowConnection = typeof flowConnections.$inferInsert;

export const flowConnectionsTriggers = [defaultNowToTrigger(tableName)];
