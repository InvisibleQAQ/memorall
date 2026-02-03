import {
	pgTable,
	uuid,
	text,
	jsonb,
	timestamp,
	index,
} from "drizzle-orm/pg-core";
import { defaultNowToTrigger } from "../utils/default-now-to-trigger";
import { flows } from "./flows";

const tableName = "flow_services";

export const flowServices = pgTable(
	tableName,
	{
		id: uuid("id").primaryKey().defaultRandom(),
		name: text("name").notNull(),
		type: text("type").notNull(),
		serviceKey: text("service_key").notNull(),
		flowId: uuid("flow_id")
			.notNull()
			.references(() => flows.id, { onDelete: "cascade" }),
		metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => [
		index("flow_services_name_idx").on(table.name),
		index("flow_services_type_idx").on(table.type),
		index("flow_states_flow_id_idx").on(table.flowId),
		index("flow_services_service_key_idx").on(table.serviceKey),
	],
);

export type FlowService = typeof flowServices.$inferSelect;
export type NewFlowService = typeof flowServices.$inferInsert;

export const flowServicesTriggers = [defaultNowToTrigger(tableName)];
