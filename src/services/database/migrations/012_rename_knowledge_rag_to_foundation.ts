import type { PGlite } from "@electric-sql/pglite";

export const up = async (pg: PGlite) => {
	await pg.exec(`
		UPDATE flows
		SET predefined_flow = 'foundation'
		WHERE predefined_flow = 'knowledge-rag';

		UPDATE flow_configs
		SET value = '"foundation"'::jsonb,
			updated_at = NOW()
		WHERE name = 'graphType'
			AND value = '"knowledge-rag"'::jsonb;

		UPDATE flow_configs
		SET value = jsonb_set(value, '{graphType}', '"foundation"'::jsonb, true),
			updated_at = NOW()
		WHERE name = 'unified_config'
			AND type = 'object'
			AND value->>'graphType' = 'knowledge-rag';

		UPDATE flow_configs
		SET value = jsonb_set(
				value,
				'{steps}',
				(
					SELECT jsonb_agg(
						CASE
							WHEN step->>'id' LIKE 'knowledge-rag__%'
								THEN jsonb_set(
									step,
									'{id}',
									to_jsonb(replace(step->>'id', 'knowledge-rag__', 'foundation__')),
									false
								)
							ELSE step
						END
						ORDER BY ordinality
					)
					FROM jsonb_array_elements(value->'steps') WITH ORDINALITY AS items(step, ordinality)
				),
				false
			),
			updated_at = NOW()
		WHERE name = 'unified_config'
			AND type = 'object'
			AND jsonb_typeof(value->'steps') = 'array'
			AND EXISTS (
				SELECT 1
				FROM jsonb_array_elements(value->'steps') AS items(step)
				WHERE step->>'id' LIKE 'knowledge-rag__%'
			);
	`);
};

export const down = async (pg: PGlite) => {
	await pg.exec(`
		UPDATE flows
		SET predefined_flow = 'knowledge-rag'
		WHERE predefined_flow = 'foundation';

		UPDATE flow_configs
		SET value = '"knowledge-rag"'::jsonb,
			updated_at = NOW()
		WHERE name = 'graphType'
			AND value = '"foundation"'::jsonb;

		UPDATE flow_configs
		SET value = jsonb_set(value, '{graphType}', '"knowledge-rag"'::jsonb, true),
			updated_at = NOW()
		WHERE name = 'unified_config'
			AND type = 'object'
			AND value->>'graphType' = 'foundation';

		UPDATE flow_configs
		SET value = jsonb_set(
				value,
				'{steps}',
				(
					SELECT jsonb_agg(
						CASE
							WHEN step->>'id' LIKE 'foundation__%'
								THEN jsonb_set(
									step,
									'{id}',
									to_jsonb(replace(step->>'id', 'foundation__', 'knowledge-rag__')),
									false
								)
							ELSE step
						END
						ORDER BY ordinality
					)
					FROM jsonb_array_elements(value->'steps') WITH ORDINALITY AS items(step, ordinality)
				),
				false
			),
			updated_at = NOW()
		WHERE name = 'unified_config'
			AND type = 'object'
			AND jsonb_typeof(value->'steps') = 'array'
			AND EXISTS (
				SELECT 1
				FROM jsonb_array_elements(value->'steps') AS items(step)
				WHERE step->>'id' LIKE 'foundation__%'
			);
	`);
};
