-- Migration 023: Create okr_user (non-superuser) for RLS enforcement
-- APPLIED 2026-04-28 against Estrategia_dev and Estrategia
-- .env and .env.dev updated to use okr_user

-- Create role (idempotent) — run as postgres superuser
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'okr_user') THEN
    CREATE ROLE okr_user WITH LOGIN PASSWORD 'SEE_ENV_FILE';
  ELSE
    ALTER ROLE okr_user WITH PASSWORD 'SEE_ENV_FILE';
  END IF;
END $$;

-- Run from postgres DB:
GRANT CONNECT ON DATABASE "Estrategia_dev" TO okr_user;
GRANT CONNECT ON DATABASE "Estrategia" TO okr_user;

-- Run from within each target DB:
GRANT USAGE ON SCHEMA public TO okr_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO okr_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO okr_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO okr_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO okr_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO okr_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO okr_user;
