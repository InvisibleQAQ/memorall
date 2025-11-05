import type { PGlite } from "@electric-sql/pglite";
import { toFullTableSQL } from "../utils/schema-to-sql";
import { activitySessions, activities } from "../entities";

export const up = async (pg: PGlite) => {
	const activitySessionsTable = toFullTableSQL(activitySessions);
	const activitiesTable = toFullTableSQL(activities);

	const sql = `
    -- Create activity_sessions table
    ${activitySessionsTable.table}
    ${activitySessionsTable.indexes.join("\n")}

    -- Create activities table
    ${activitiesTable.table}
    ${activitiesTable.indexes.join("\n")}

    -- Create indexes for better query performance
    CREATE INDEX IF NOT EXISTS idx_activities_session_id ON activities(session_id);
    CREATE INDEX IF NOT EXISTS idx_activities_type ON activities(type);
    CREATE INDEX IF NOT EXISTS idx_activities_timestamp ON activities(timestamp);
    CREATE INDEX IF NOT EXISTS idx_activity_sessions_status ON activity_sessions(status);
    CREATE INDEX IF NOT EXISTS idx_activity_sessions_start_time ON activity_sessions(start_time);
  `;

	await pg.exec(sql);
};

export const down = async (pg: PGlite) => {
	await pg.exec(`
    DROP TABLE IF EXISTS activities CASCADE;
    DROP TABLE IF NOT EXISTS activity_sessions CASCADE;
  `);
};
