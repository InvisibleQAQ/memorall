import type { PGlite } from "@electric-sql/pglite";

export const up = async (pg: PGlite) => {
	await pg.exec(`
		ALTER TABLE topics
			ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES flows(id) ON DELETE SET NULL;

		CREATE INDEX IF NOT EXISTS topics_agent_id_idx ON topics (agent_id);
	`);
};

export const down = async (pg: PGlite) => {
	await pg.exec(`
		DROP INDEX IF EXISTS topics_agent_id_idx;
		ALTER TABLE topics DROP COLUMN IF EXISTS agent_id;
	`);
};
