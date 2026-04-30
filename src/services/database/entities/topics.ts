import { text, timestamp, uuid, pgTable, index } from "drizzle-orm/pg-core";
import { defaultNowToTrigger } from "../utils/default-now-to-trigger";
import { flows } from "./flows";
import {
	DEFAULT_GROW_TYPE,
	DEFAULT_RECALL_TYPE,
	type GrowType,
	type RecallType,
} from "./topic-types";

const tableName = "topics";
export const topic = pgTable(
	tableName,
	{
		id: uuid("uuid").primaryKey().defaultRandom(),
		name: text("name").notNull(),
		description: text("description").default(""),
		agentId: uuid("agent_id").references(() => flows.id, {
			onDelete: "set null",
		}),
		/**
		 * Immutable after creation. Determines which indexing pipeline writes
		 * to this memory zone (knowledge-graph nodes vs StructMem entries).
		 * Changing this after data has been written would break retrieval.
		 */
		growType: text("grow_type")
			.$type<GrowType>()
			.notNull()
			.default(DEFAULT_GROW_TYPE),
		/**
		 * Mutable. Determines the retrieval strategy at query time.
		 * Must be a valid recall type for the memory's growType.
		 */
		recallType: text("recall_type")
			.$type<RecallType>()
			.notNull()
			.default(DEFAULT_RECALL_TYPE),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => [index("topics_agent_id_idx").on(table.agentId)],
);

export type Topic = typeof topic.$inferSelect;
export type NewTopic = typeof topic.$inferInsert;

// Database trigger commands to automatically set timestamps
export const topicTriggers = [defaultNowToTrigger(tableName)];
