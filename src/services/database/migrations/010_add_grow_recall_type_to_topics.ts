import type { PGlite } from "@electric-sql/pglite";

export const up = async (pg: PGlite) => {
	await pg.exec(`
		ALTER TABLE topics
			ADD COLUMN IF NOT EXISTS grow_type  TEXT NOT NULL DEFAULT 'knowledge-graph',
			ADD COLUMN IF NOT EXISTS recall_type TEXT NOT NULL DEFAULT 'smart';
	`);
};

export const down = async (pg: PGlite) => {
	await pg.exec(`
		ALTER TABLE topics
			DROP COLUMN IF EXISTS grow_type,
			DROP COLUMN IF EXISTS recall_type;
	`);
};
