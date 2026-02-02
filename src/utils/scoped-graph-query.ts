import { eq, or, sql } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

export const getScopedGraphWhere = (
	state: { graphId?: string },
	column: PgColumn,
) => {
	const graphId = state.graphId?.trim();

	if (graphId) {
		return eq(column, graphId);
	}

	return or(eq(column, ""), sql`${column} IS NULL`);
};
