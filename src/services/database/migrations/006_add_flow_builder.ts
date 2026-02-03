import type { PGlite } from "@electric-sql/pglite";
import { toFullTableSQL } from "../utils/schema-to-sql";
import {
	flows,
	flowStates,
	flowServices,
	flowSteps,
	flowConnections,
} from "../entities";

export const up = async (pg: PGlite) => {
	const flowsTable = toFullTableSQL(flows);
	const flowStatesTable = toFullTableSQL(flowStates);
	const flowServicesTable = toFullTableSQL(flowServices);
	const flowStepsTable = toFullTableSQL(flowSteps);
	const flowConnectionsTable = toFullTableSQL(flowConnections);

	const sql = `
    -- Create flows table
    ${flowsTable.table}
    ${flowsTable.indexes.join("\n")}

    -- Create flow_states table
    ${flowStatesTable.table}
    ${flowStatesTable.indexes.join("\n")}

    -- Create flow_services table (static catalog)
    ${flowServicesTable.table}
    ${flowServicesTable.indexes.join("\n")}

    -- Create flow_steps table (static catalog)
    ${flowStepsTable.table}
    ${flowStepsTable.indexes.join("\n")}

    -- Create flow_connections table
    ${flowConnectionsTable.table}
    ${flowConnectionsTable.indexes.join("\n")}
  `;

	await pg.exec(sql);
};

export const down = async (pg: PGlite) => {
	await pg.exec(`
    DROP TABLE IF EXISTS flow_connections CASCADE;
    DROP TABLE IF EXISTS flow_steps CASCADE;
    DROP TABLE IF EXISTS flow_services CASCADE;
    DROP TABLE IF EXISTS flow_states CASCADE;
    DROP TABLE IF EXISTS flows CASCADE;
  `);
};
