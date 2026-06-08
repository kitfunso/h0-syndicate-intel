-- ===========================================================================
-- Read-only role for the /api/ask query path. The LLM never writes SQL, but
-- defence in depth: even a compromised query runs as a SELECT-only principal
-- with a hard statement timeout. The owner role is used only by migrate + seed.
-- ===========================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_readonly') THEN
    -- Created NOLOGIN here; grant a password out-of-band (kept out of git):
    --   ALTER ROLE app_readonly WITH LOGIN PASSWORD '...';
    CREATE ROLE app_readonly NOLOGIN;
  END IF;
END
$$;

-- Hard cap on any statement this role runs (defence vs a pathological query).
ALTER ROLE app_readonly SET statement_timeout = '5000ms';

GRANT USAGE ON SCHEMA public TO app_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO app_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO app_readonly;

-- Explicitly NO insert/update/delete/truncate. (Default-deny; nothing granted above.)
