import type { PGlite } from "@electric-sql/pglite";

export const up = async (pg: PGlite) => {
	await pg.exec(`
		ALTER TABLE conversations
			ADD COLUMN IF NOT EXISTS name TEXT,
			ADD COLUMN IF NOT EXISTS agent_flow_id UUID REFERENCES flows(id) ON DELETE SET NULL;

		UPDATE conversations
			SET name = COALESCE(name, title)
			WHERE name IS NULL;

		CREATE INDEX IF NOT EXISTS conversations_agent_flow_id_idx
			ON conversations (agent_flow_id);

		CREATE TABLE IF NOT EXISTS cron_jobs (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			name TEXT NOT NULL,
			status TEXT NOT NULL DEFAULT 'draft',
			schedule_expression TEXT NOT NULL,
			timezone TEXT NOT NULL,
			action_type TEXT NOT NULL DEFAULT 'agent_chat',
			action_payload JSONB NOT NULL DEFAULT '{}',
			agent_flow_id UUID REFERENCES flows(id) ON DELETE CASCADE,
			conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
			allow_overlap BOOLEAN NOT NULL DEFAULT false,
			last_run_at TIMESTAMP,
			next_run_at TIMESTAMP,
			last_status TEXT NOT NULL DEFAULT 'idle',
			last_error TEXT,
			run_count INTEGER NOT NULL DEFAULT 0,
			metadata JSONB DEFAULT '{}',
			created_at TIMESTAMP DEFAULT NOW() NOT NULL,
			updated_at TIMESTAMP DEFAULT NOW() NOT NULL
		);

		CREATE INDEX IF NOT EXISTS cron_jobs_status_next_run_at_idx
			ON cron_jobs (status, next_run_at);
		CREATE INDEX IF NOT EXISTS cron_jobs_agent_flow_id_idx
			ON cron_jobs (agent_flow_id);
		CREATE INDEX IF NOT EXISTS cron_jobs_conversation_id_idx
			ON cron_jobs (conversation_id);

		CREATE OR REPLACE FUNCTION update_cron_jobs_updated_at()
		RETURNS TRIGGER AS $$
		BEGIN
			NEW.updated_at = NOW();
			RETURN NEW;
		END;
		$$ LANGUAGE plpgsql;

		DROP TRIGGER IF EXISTS cron_jobs_updated_at_trigger ON cron_jobs;
		CREATE TRIGGER cron_jobs_updated_at_trigger
			BEFORE UPDATE ON cron_jobs
			FOR EACH ROW
			EXECUTE FUNCTION update_cron_jobs_updated_at();
	`);
};

export const down = async (pg: PGlite) => {
	await pg.exec(`
		DROP TRIGGER IF EXISTS cron_jobs_updated_at_trigger ON cron_jobs;
		DROP FUNCTION IF EXISTS update_cron_jobs_updated_at();
		DROP TABLE IF EXISTS cron_jobs CASCADE;
		DROP INDEX IF EXISTS conversations_agent_flow_id_idx;
		ALTER TABLE conversations
			DROP COLUMN IF EXISTS agent_flow_id,
			DROP COLUMN IF EXISTS name;
	`);
};
