ALTER TABLE build_outbox ADD COLUMN thread_id text;
ALTER TABLE build_outbox ADD COLUMN claim_token text;
ALTER TABLE build_outbox ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE build_files ADD COLUMN source_key text;
CREATE UNIQUE INDEX build_file_source ON build_files(organization_id,source_key) WHERE source_key IS NOT NULL;
