-- Migration 041: Password reset tokens for email-based password reset flow

-- ─── Table ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT        NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prt_token    ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_prt_user_id  ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_prt_expires  ON password_reset_tokens(expires_at) WHERE used_at IS NULL;

-- ─── sp_create_reset_token ────────────────────────────────────────────────────
-- Creates (or replaces) a password reset token for the given user.
-- Returns the plaintext token (caller must embed in email link).

CREATE OR REPLACE FUNCTION sp_create_reset_token(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_token TEXT;
BEGIN
  -- Revoke any previous unexpired tokens for this user
  UPDATE password_reset_tokens
     SET used_at = NOW()
   WHERE user_id   = p_user_id
     AND used_at   IS NULL
     AND expires_at > NOW();

  -- Generate a secure 64-hex token (32 random bytes)
  v_token := encode(gen_random_bytes(32), 'hex');

  INSERT INTO password_reset_tokens (user_id, token, expires_at)
  VALUES (p_user_id, v_token, NOW() + INTERVAL '2 hours');

  RETURN v_token;
END;
$$;

-- ─── fn_get_reset_token_info ──────────────────────────────────────────────────
-- Returns token metadata if valid (not used, not expired).

CREATE OR REPLACE FUNCTION fn_get_reset_token_info(p_token TEXT)
RETURNS TABLE (
  user_id    UUID,
  email      TEXT,
  name       TEXT,
  expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id          AS user_id,
    u.email::TEXT AS email,
    u.name        AS name,
    prt.expires_at
  FROM password_reset_tokens prt
  JOIN users u ON u.id = prt.user_id
  WHERE prt.token      = p_token
    AND prt.used_at    IS NULL
    AND prt.expires_at > NOW()
    AND u.deleted_at   IS NULL
    AND u.is_active    = true;
END;
$$;

-- ─── sp_consume_reset_token ───────────────────────────────────────────────────
-- Validates token, updates password, revokes all sessions, marks token used.
-- Raises exception if token is invalid/expired/used.

CREATE OR REPLACE FUNCTION sp_consume_reset_token(p_token TEXT, p_new_password TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id  UUID;
  v_token_id UUID;
BEGIN
  SELECT prt.id, prt.user_id
    INTO v_token_id, v_user_id
    FROM password_reset_tokens prt
    JOIN users u ON u.id = prt.user_id
   WHERE prt.token      = p_token
     AND prt.used_at    IS NULL
     AND prt.expires_at > NOW()
     AND u.deleted_at   IS NULL
     AND u.is_active    = true;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'RESET_TOKEN_INVALID_OR_EXPIRED';
  END IF;

  -- Hash and update password
  UPDATE users
     SET password_hash  = crypt(p_new_password, gen_salt('bf', 10)),
         failed_attempts = 0,
         locked_until   = NULL,
         updated_at     = NOW()
   WHERE id = v_user_id;

  -- Revoke all sessions (force re-login)
  UPDATE refresh_tokens
     SET revoked_at = NOW()
   WHERE user_id   = v_user_id
     AND revoked_at IS NULL;

  -- Mark token as used
  UPDATE password_reset_tokens
     SET used_at = NOW()
   WHERE id = v_token_id;

  RETURN v_user_id;
END;
$$;
