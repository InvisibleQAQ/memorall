import type { PGlite } from "@electric-sql/pglite";
import { toFullTableSQL } from "../utils/schema-to-sql";
import { topicFiles } from "../entities";

export const up = async (pg: PGlite) => {
	const topicFilesTable = toFullTableSQL(topicFiles);

	const sql = `
    -- Create topic_files table
    ${topicFilesTable.table}
    ${topicFilesTable.indexes.join("\n")}
  `;

	await pg.exec(sql);
};

export const down = async (pg: PGlite) => {
	await pg.exec(`
    DROP TABLE IF EXISTS topic_files CASCADE;
  `);
};
