CREATE TABLE build_organizations (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  brand jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE build_people (
  id uuid PRIMARY KEY,
  email text NOT NULL UNIQUE,
  display_name text NOT NULL,
  auth_subject uuid UNIQUE
);
CREATE TABLE build_memberships (
  organization_id uuid NOT NULL REFERENCES build_organizations(id),
  user_id uuid NOT NULL REFERENCES build_people(id),
  role text NOT NULL CHECK (role IN ('owner','lead','crew')),
  active boolean NOT NULL DEFAULT true,
  PRIMARY KEY (organization_id,user_id)
);
CREATE TABLE build_projects (
  organization_id uuid NOT NULL REFERENCES build_organizations(id),
  id text NOT NULL,
  name text NOT NULL,
  client text NOT NULL,
  location text NOT NULL DEFAULT '',
  acres numeric NOT NULL DEFAULT 0 CHECK (acres >= 0),
  stage text NOT NULL DEFAULT 'Planning',
  template text NOT NULL DEFAULT 'landscape' CHECK (template IN ('landscape','general')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id,id)
);
CREATE TABLE build_project_members (
  organization_id uuid NOT NULL,
  project_id text NOT NULL,
  user_id uuid NOT NULL,
  PRIMARY KEY(organization_id,project_id,user_id),
  FOREIGN KEY(organization_id,project_id) REFERENCES build_projects(organization_id,id),
  FOREIGN KEY(organization_id,user_id) REFERENCES build_memberships(organization_id,user_id)
);
CREATE TABLE build_drafts (
  organization_id uuid NOT NULL,
  project_id text NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK(version > 0),
  content jsonb NOT NULL,
  updated_by uuid NOT NULL REFERENCES build_people(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(organization_id,project_id),
  FOREIGN KEY(organization_id,project_id) REFERENCES build_projects(organization_id,id)
);
CREATE TABLE build_revisions (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  project_id text NOT NULL,
  number integer NOT NULL CHECK(number > 0),
  draft_version integer NOT NULL,
  snapshot jsonb NOT NULL,
  snapshot_hash text NOT NULL,
  published_by uuid NOT NULL REFERENCES build_people(id),
  published_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id,project_id,number),
  UNIQUE(organization_id,project_id,id),
  FOREIGN KEY(organization_id,project_id) REFERENCES build_projects(organization_id,id)
);
CREATE TABLE build_client_access (
  organization_id uuid NOT NULL,
  project_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES build_people(id),
  active boolean NOT NULL DEFAULT true,
  PRIMARY KEY(organization_id,project_id,user_id),
  FOREIGN KEY(organization_id,project_id) REFERENCES build_projects(organization_id,id)
);
CREATE TABLE build_shares (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  project_id text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(organization_id,project_id) REFERENCES build_projects(organization_id,id)
);
CREATE TABLE build_updates (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  project_id text NOT NULL,
  author_id uuid NOT NULL REFERENCES build_people(id),
  body text NOT NULL,
  visibility text NOT NULL CHECK(visibility IN ('internal','client')),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(organization_id,project_id) REFERENCES build_projects(organization_id,id)
);
CREATE TABLE build_responses (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  project_id text NOT NULL,
  revision_id uuid NOT NULL,
  author_id uuid NOT NULL REFERENCES build_people(id),
  kind text NOT NULL CHECK(kind IN ('approved','changes_requested','comment')),
  body text NOT NULL DEFAULT '',
  snapshot_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(organization_id,project_id,revision_id) REFERENCES build_revisions(organization_id,project_id,id)
);
CREATE TABLE build_files (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  project_id text NOT NULL,
  owner_id uuid NOT NULL REFERENCES build_people(id),
  name text NOT NULL,
  mime text NOT NULL,
  size integer NOT NULL CHECK(size > 0 AND size <= 10485760),
  storage_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(organization_id,project_id) REFERENCES build_projects(organization_id,id)
);
CREATE TABLE build_receipts (
  organization_id uuid NOT NULL REFERENCES build_organizations(id),
  actor_id uuid NOT NULL REFERENCES build_people(id),
  action_key text NOT NULL,
  request_hash text NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(organization_id,actor_id,action_key)
);
CREATE TABLE build_sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES build_people(id),
  expires_at timestamptz NOT NULL
);
CREATE TABLE build_telegram_identities (
  bot_id text NOT NULL,
  sender_id text NOT NULL,
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  PRIMARY KEY(bot_id,sender_id),
  FOREIGN KEY(organization_id,user_id) REFERENCES build_memberships(organization_id,user_id)
);
CREATE TABLE build_telegram_routes (
  bot_id text NOT NULL,
  chat_id text NOT NULL,
  thread_id text NOT NULL DEFAULT '',
  organization_id uuid NOT NULL,
  project_id text NOT NULL,
  PRIMARY KEY(bot_id,chat_id,thread_id),
  FOREIGN KEY(organization_id,project_id) REFERENCES build_projects(organization_id,id)
);
CREATE TABLE build_inbox (
  id uuid PRIMARY KEY,
  bot_id text NOT NULL,
  update_id text NOT NULL,
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  project_id text,
  chat_id text NOT NULL,
  payload jsonb NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(bot_id,update_id),
  FOREIGN KEY(organization_id,user_id) REFERENCES build_memberships(organization_id,user_id),
  FOREIGN KEY(organization_id,project_id) REFERENCES build_projects(organization_id,id)
);
CREATE TABLE build_jobs (
  id uuid PRIMARY KEY REFERENCES build_inbox(id),
  status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','done','needs_input','failed')),
  lease_token text,
  lease_until timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  request jsonb,
  hermes_key text,
  run_id text,
  error text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE build_outbox (
  id uuid PRIMARY KEY,
  job_id uuid UNIQUE REFERENCES build_jobs(id),
  chat_id text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','sending','sent','uncertain','failed')),
  provider_message_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX build_updates_project ON build_updates(organization_id,project_id,created_at DESC);
CREATE INDEX build_jobs_pending ON build_jobs(status,lease_until);

-- Private API tables: no direct public/client access or service-key exposure.
-- Browser identity is verified by the API; every command also checks memberships.
DO $$ DECLARE t text; BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'build_%' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC',t);
    IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
      EXECUTE format('REVOKE ALL ON public.%I FROM anon',t);
    END IF;
    IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
      EXECUTE format('REVOKE ALL ON public.%I FROM authenticated',t);
    END IF;
  END LOOP;
END $$;

CREATE FUNCTION build_reject_revision_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Published revisions are immutable'; END $$;
CREATE TRIGGER build_immutable_revisions BEFORE UPDATE OR DELETE ON build_revisions
FOR EACH ROW EXECUTE FUNCTION build_reject_revision_change();
