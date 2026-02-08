import type { PGlite } from "@electric-sql/pglite";
import { toFullTableSQL } from "../utils/schema-to-sql";
import { flowConfigs, flowConfigsTriggers } from "../entities/flow-configs";

export const up = async (pg: PGlite) => {
	// 1. Add predefined_flow column to flows table
	await pg.exec(`
		ALTER TABLE flows ADD COLUMN IF NOT EXISTS predefined_flow TEXT;
		CREATE INDEX IF NOT EXISTS flows_predefined_flow_idx ON flows (predefined_flow);
	`);

	// 2. Create flow_configs table
	const flowConfigsTable = toFullTableSQL(flowConfigs);
	await pg.exec(`
		${flowConfigsTable.table}
		${flowConfigsTable.indexes.join("\n")}
	`);

	// 3. Create triggers for flow_configs timestamps
	for (const trigger of flowConfigsTriggers) {
		await pg.exec(trigger);
	}
};

export const down = async (pg: PGlite) => {
	await pg.exec(`
		DROP TABLE IF EXISTS flow_configs CASCADE;
		ALTER TABLE flows DROP COLUMN IF EXISTS predefined_flow;
		DROP INDEX IF EXISTS flows_predefined_flow_idx;
	`);
};
