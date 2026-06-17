-- Migration 023: Ensure okr_user permissions (idempotent)
-- okr_user is created during installation with the password from .env
-- This migration only ensures grants are in place.

-- Grant connect on production DB (idempotent)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_database WHERE datname = 'okr_db') THEN
    EXECUTE 'GRANT CONNECT ON DATABASE okr_db TO okr_user';
  END IF;
END $$;

-- Permissions on schema
GRANT USAGE ON SCHEMA public TO okr_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO okr_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO okr_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO okr_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO okr_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO okr_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO okr_user;
