import type { PGlite } from "@electric-sql/pglite";

export const up = async (pg: PGlite) => {
	await pg.exec(`
		CREATE INDEX IF NOT EXISTS messages_conversation_created_idx
			ON messages (conversation_id, created_at);

		CREATE INDEX IF NOT EXISTS messages_conversation_type_created_idx
			ON messages (conversation_id, type, created_at);
	`);
};

export const down = async (pg: PGlite) => {
	await pg.exec(`
		DROP INDEX IF EXISTS messages_conversation_created_idx;
		DROP INDEX IF EXISTS messages_conversation_type_created_idx;
	`);
};
