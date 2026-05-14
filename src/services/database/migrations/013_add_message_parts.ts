import type { PGlite } from "@electric-sql/pglite";

export const up = async (pg: PGlite) => {
	await pg.exec(`
		ALTER TABLE messages
		ADD COLUMN IF NOT EXISTS parts JSONB;
	`);
};

export const down = async (pg: PGlite) => {
	await pg.exec(`
		ALTER TABLE messages
		DROP COLUMN IF EXISTS parts;
	`);
};
