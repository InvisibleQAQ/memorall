import { eq, or, sql } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

export const getScopedGraphWhere = (
	state: { graphId?: string },
	column: PgColumn,
) => {
	if (state.graphId || !state.graphId?.trim()) {
		return eq(column, state.graphId);
	}

	return or(eq(column, ""), sql`${column} IS NULL`);
};
