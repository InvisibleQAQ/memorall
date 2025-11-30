import type { PGlite } from "@electric-sql/pglite";

/**
 * Migration 004: Add display_meta column to activities table
 * Adds user-friendly metadata for rich activity rendering
 */
export const up = async (pg: PGlite) => {
	const sql = `
    -- Add display_meta column to activities table
    ALTER TABLE activities
    ADD COLUMN IF NOT EXISTS display_meta JSONB;

    -- Add index for faster queries on display_meta
    CREATE INDEX IF NOT EXISTS idx_activities_display_meta ON activities USING gin(display_meta);
  `;

	await pg.exec(sql);
};

export const down = async (pg: PGlite) => {
	await pg.exec(`
    -- Remove display_meta column
    ALTER TABLE activities DROP COLUMN IF EXISTS display_meta;
  `);
};
