import type { PGlite } from "@electric-sql/pglite";

/**
 * Migration 005: Add multi-size embedding support
 * Adds small (384d) and large (1536d) embedding columns to nodes, edges, and messages
 * Keeps existing medium (768d) columns for backward compatibility
 */
export const up = async (pg: PGlite) => {
	const sql = `
    -- Add small and large embedding columns to nodes table
    ALTER TABLE nodes
    ADD COLUMN IF NOT EXISTS name_embedding_small vector(384),
    ADD COLUMN IF NOT EXISTS name_embedding_large vector(1536);

    -- Add small and large embedding columns to edges table
    ALTER TABLE edges
    ADD COLUMN IF NOT EXISTS fact_embedding_small vector(384),
    ADD COLUMN IF NOT EXISTS fact_embedding_large vector(1536),
    ADD COLUMN IF NOT EXISTS type_embedding_small vector(384),
    ADD COLUMN IF NOT EXISTS type_embedding_large vector(1536);

    -- Add small and large embedding columns to messages table
    ALTER TABLE messages
    ADD COLUMN IF NOT EXISTS embedding_small vector(384),
    ADD COLUMN IF NOT EXISTS embedding_large vector(1536);
  `;

	await pg.exec(sql);
};

export const down = async (pg: PGlite) => {
	await pg.exec(`
    -- Remove small and large embedding columns from nodes table
    ALTER TABLE nodes
    DROP COLUMN IF EXISTS name_embedding_small,
    DROP COLUMN IF EXISTS name_embedding_large;

    -- Remove small and large embedding columns from edges table
    ALTER TABLE edges
    DROP COLUMN IF EXISTS fact_embedding_small,
    DROP COLUMN IF EXISTS fact_embedding_large,
    DROP COLUMN IF EXISTS type_embedding_small,
    DROP COLUMN IF EXISTS type_embedding_large;

    -- Remove small and large embedding columns from messages table
    ALTER TABLE messages
    DROP COLUMN IF EXISTS embedding_small,
    DROP COLUMN IF EXISTS embedding_large;
  `);
};
