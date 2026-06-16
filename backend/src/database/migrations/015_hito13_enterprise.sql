-- ============================================================
-- Migration 015 — Hito 13: Enterprise completeness
-- Tablas: user_profiles, user_mfa_secrets, login_attempts
-- Procedimientos: sp_update_user_profile, sp_revoke_all_tokens,
--                 sp_export_user_data, sp_anonymize_user
-- Funciones: fn_check_login_attempts
-- Vista: v_security_audit
-- ============================================================

CREATE EXTENSION IF NOT EXISTS citext;

-- ── 1. user_profiles ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id       uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  timezone      varchar(64)  NOT NULL DEFAULT 'America/Bogota',
  locale        varchar(10)  NOT NULL DEFAULT 'es',
  notify_at_risk          boolean NOT NULL DEFAULT true,
  notify_checkin_reminder boolean NOT NULL DEFAULT true,
  notify_weekly_briefing  boolean NOT NULL DEFAULT true,
  updated_at    timestamptz  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_user ON user_profiles(user_id);

-- Auto-create profile when a user is created
CREATE OR REPLACE FUNCTION fn_create_user_profile()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO user_profiles(user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_user_profile ON users;
CREATE TRIGGER trg_create_user_profile
  AFTER INSERT ON users
  FOR EACH ROW EXECUTE FUNCTION fn_create_user_profile();

-- Backfill profiles for existing users
INSERT INTO user_profiles(user_id)
SELECT id FROM users WHERE deleted_at IS NULL
ON CONFLICT DO NOTHING;

-- ── 2. sp_update_user_profile ────────────────────────────────
CREATE OR REPLACE PROCEDURE sp_update_user_profile(
  p_user_id                  uuid,
  p_timezone                 varchar,
  p_locale                   varchar,
  p_notify_at_risk           boolean,
  p_notify_checkin_reminder  boolean,
  p_notify_weekly_briefing   boolean
)
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO user_profiles(
    user_id, timezone, locale,
    notify_at_risk, notify_checkin_reminder, notify_weekly_briefing,
    updated_at
  ) VALUES (
    p_user_id, p_timezone, p_locale,
    p_notify_at_risk, p_notify_checkin_reminder, p_notify_weekly_briefing,
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    timezone                 = EXCLUDED.timezone,
    locale                   = EXCLUDED.locale,
    notify_at_risk           = EXCLUDED.notify_at_risk,
    notify_checkin_reminder  = EXCLUDED.notify_checkin_reminder,
    notify_weekly_briefing   = EXCLUDED.notify_weekly_briefing,
    updated_at               = NOW();
END;
$$;

-- ── 3. user_mfa_secrets ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_mfa_secrets (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  secret_base32 text       NOT NULL,          -- TOTP secret (store encrypted at app level)
  is_active    boolean     NOT NULL DEFAULT false,
  verified_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_mfa_secrets_user ON user_mfa_secrets(user_id);

-- ── 4. login_attempts ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS login_attempts (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email        citext      NOT NULL,
  ip_address   inet,
  attempted_at timestamptz NOT NULL DEFAULT NOW(),
  success      boolean     NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_email_time
  ON login_attempts(email, attempted_at DESC);

-- fn_check_login_attempts: returns lockout info (5 failures in 15 min → 15 min lockout)
CREATE OR REPLACE FUNCTION fn_check_login_attempts(p_email citext)
RETURNS jsonb LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_failures    int;
  v_last_fail   timestamptz;
  v_locked_until timestamptz;
BEGIN
  SELECT COUNT(*), MAX(attempted_at)
    INTO v_failures, v_last_fail
    FROM login_attempts
   WHERE email = p_email
     AND success = false
     AND attempted_at > NOW() - INTERVAL '15 minutes';

  IF v_failures >= 5 THEN
    v_locked_until := v_last_fail + INTERVAL '15 minutes';
    IF v_locked_until > NOW() THEN
      RETURN jsonb_build_object(
        'is_locked',     true,
        'attempts',      v_failures,
        'locked_until',  v_locked_until
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'is_locked',    false,
    'attempts',     v_failures,
    'locked_until', null
  );
END;
$$;

-- ── 5. sp_revoke_all_tokens ──────────────────────────────────
CREATE OR REPLACE PROCEDURE sp_revoke_all_tokens(p_user_id uuid)
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE refresh_tokens
     SET revoked_at = NOW()
   WHERE user_id = p_user_id
     AND revoked_at IS NULL;
END;
$$;

-- ── 6. sp_export_user_data ───────────────────────────────────
CREATE OR REPLACE FUNCTION sp_export_user_data(p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'exported_at', NOW(),
    'user', (
      SELECT jsonb_build_object(
        'id', u.id, 'name', u.name, 'email', u.email,
        'role', u.role, 'created_at', u.created_at,
        'organization', o.name
      )
      FROM users u JOIN organizations o ON o.id = u.organization_id
      WHERE u.id = p_user_id
    ),
    'profile', (
      SELECT to_jsonb(up) FROM user_profiles up WHERE up.user_id = p_user_id
    ),
    'objectives', (
      SELECT jsonb_agg(jsonb_build_object(
        'id', o.id, 'title', o.title, 'level', o.level,
        'status', o.status, 'created_at', o.created_at
      ))
      FROM objectives o WHERE o.owner_id = p_user_id AND o.deleted_at IS NULL
    ),
    'key_results', (
      SELECT jsonb_agg(jsonb_build_object(
        'id', kr.id, 'title', kr.title, 'type', kr.type,
        'current_value', kr.current_value, 'target_value', kr.target_value,
        'created_at', kr.created_at
      ))
      FROM key_results kr WHERE kr.owner_id = p_user_id AND kr.deleted_at IS NULL
    ),
    'check_ins', (
      SELECT jsonb_agg(jsonb_build_object(
        'id', c.id, 'current_value', c.current_value, 'confidence', c.confidence,
        'notes', c.notes, 'mood', c.mood, 'checked_at', c.checked_at
      ))
      FROM check_ins c WHERE c.user_id = p_user_id AND c.deleted_at IS NULL
    ),
    'audit_log', (
      SELECT jsonb_agg(jsonb_build_object(
        'action', al.action, 'entity_type', al.entity_type,
        'created_at', al.created_at
      ))
      FROM audit_log al WHERE al.user_id = p_user_id
      ORDER BY al.created_at DESC
      LIMIT 200
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- ── 7. sp_anonymize_user ─────────────────────────────────────
CREATE OR REPLACE PROCEDURE sp_anonymize_user(p_user_id uuid)
LANGUAGE plpgsql AS $$
DECLARE
  v_anon_name  text := 'Usuario eliminado';
  v_anon_email text := 'deleted_' || encode(gen_random_bytes(8), 'hex') || '@deleted.invalid';
BEGIN
  -- Revoke all active sessions first
  CALL sp_revoke_all_tokens(p_user_id);

  -- Anonymize the user record
  UPDATE users SET
    name          = v_anon_name,
    email         = v_anon_email,
    password_hash = encode(gen_random_bytes(32), 'hex'),
    is_active     = false,
    deleted_at    = NOW()
  WHERE id = p_user_id;

  -- Anonymize check-in notes (keep values for analytics, remove personal notes)
  UPDATE check_ins SET notes = NULL, mood = NULL
  WHERE user_id = p_user_id;

  -- Remove MFA secret
  DELETE FROM user_mfa_secrets WHERE user_id = p_user_id;

  -- Remove profile
  DELETE FROM user_profiles WHERE user_id = p_user_id;

  -- Remove login attempts history
  DELETE FROM login_attempts WHERE email = (
    SELECT email FROM users WHERE id = p_user_id
  );
END;
$$;

-- ── 8. v_security_audit ──────────────────────────────────────
CREATE OR REPLACE VIEW v_security_audit AS
SELECT
  al.id,
  al.occurred_at                         AS created_at,
  al.operation                           AS action,
  al.table_name                          AS entity_type,
  al.record_id                           AS entity_id,
  al.actor_id                            AS user_id,
  u.name                                 AS user_name,
  u.email                                AS user_email,
  al.old_data                            AS old_values,
  al.new_data                            AS new_values
FROM audit_log al
LEFT JOIN users u ON u.id = al.actor_id
ORDER BY al.occurred_at DESC;

-- Index for v_security_audit queries
CREATE INDEX IF NOT EXISTS idx_audit_log_actor_occurred
  ON audit_log(actor_id, occurred_at DESC);

DO $$ BEGIN
  RAISE NOTICE 'Migration 015_hito13_enterprise applied.';
END; $$;
