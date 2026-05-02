import {
	pgTable,
	text,
	timestamp,
	jsonb,
	uuid,
	index,
} from "drizzle-orm/pg-core";
import { defaultNowToTrigger } from "../utils/default-now-to-trigger";
import { flows } from "./flows";

const tableName = "conversations";
export const conversation = pgTable(
	tableName,
	{
		id: uuid("id").primaryKey().defaultRandom(),
		title: text("title"),
		name: text("name"),
		agentFlowId: uuid("agent_flow_id").references(() => flows.id, {
			onDelete: "set null",
		}),
		metadata: jsonb("metadata").default({}),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => [index("conversations_agent_flow_id_idx").on(table.agentFlowId)],
);

export type Conversation = typeof conversation.$inferSelect;
export type NewConversation = typeof conversation.$inferInsert;

// Database trigger commands to automatically set timestamps
export const conversationTriggers = [defaultNowToTrigger(tableName)];
