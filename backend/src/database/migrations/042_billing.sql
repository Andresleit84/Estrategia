-- Migration 042 — Billing infrastructure
-- Adds Stripe/MercadoPago IDs to organizations + billing events log

BEGIN;

INSERT INTO _sql_migrations (filename) VALUES ('042_billing.sql')
  ON CONFLICT DO NOTHING;

-- ── Organizations billing columns ─────────────────────────────────────────────

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS stripe_customer_id      text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id  text,
  ADD COLUMN IF NOT EXISTS mp_subscription_id      text,
  ADD COLUMN IF NOT EXISTS billing_interval        text NOT NULL DEFAULT 'monthly'
    CHECK (billing_interval IN ('monthly', 'annual')),
  ADD COLUMN IF NOT EXISTS plan_current_period_end timestamp with time zone;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orgs_stripe_customer
  ON organizations (stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

-- ── Billing events log ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS billing_events (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  provider       text NOT NULL CHECK (provider IN ('stripe', 'mercadopago', 'manual')),
  event_type     text NOT NULL,
  event_id       text,          -- provider event ID (idempotency)
  payload        jsonb,
  processed_at   timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_events_idempotency
  ON billing_events (provider, event_id) WHERE event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_billing_events_org
  ON billing_events (organization_id);

-- ── Plan limits view ──────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW v_plan_limits AS
SELECT
  p.plan,
  p.max_members,
  p.max_cycles,
  p.max_objectives,
  p.ai_enabled,
  p.reports_enabled,
  p.price_monthly_usd,
  p.price_monthly_ars
FROM (VALUES
  ('FREE'::text,       5,    1,  10,  false, false,  0,       0),
  ('PRO'::text,        50,   -1, -1,  true,  true,   49,  49000),
  ('ENTERPRISE'::text, -1,   -1, -1,  true,  true,   0,       0)
) AS p(plan, max_members, max_cycles, max_objectives, ai_enabled, reports_enabled, price_monthly_usd, price_monthly_ars);

-- ── fn_check_plan_limit ───────────────────────────────────────────────────────
-- Returns error message if org exceeded limit for resource, NULL if ok

CREATE OR REPLACE FUNCTION fn_check_plan_limit(
  p_org_id  uuid,
  p_resource text   -- 'members' | 'cycles' | 'objectives'
) RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_plan        text;
  v_limit       int;
  v_current     int;
BEGIN
  SELECT plan INTO v_plan FROM organizations WHERE id = p_org_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RETURN 'Organización no encontrada'; END IF;

  IF p_resource = 'members' THEN
    SELECT max_members INTO v_limit FROM v_plan_limits WHERE plan = v_plan;
    SELECT COUNT(*) INTO v_current FROM users WHERE organization_id = p_org_id AND deleted_at IS NULL AND is_active = true;
    IF v_limit > 0 AND v_current >= v_limit THEN
      RETURN 'PLAN_LIMIT_EXCEEDED:members:' || v_current || ':' || v_limit;
    END IF;

  ELSIF p_resource = 'cycles' THEN
    SELECT max_cycles INTO v_limit FROM v_plan_limits WHERE plan = v_plan;
    SELECT COUNT(*) INTO v_current FROM cycles WHERE organization_id = p_org_id AND status = 'ACTIVE';
    IF v_limit > 0 AND v_current >= v_limit THEN
      RETURN 'PLAN_LIMIT_EXCEEDED:cycles:' || v_current || ':' || v_limit;
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

-- ── sp_apply_billing_upgrade ──────────────────────────────────────────────────

CREATE OR REPLACE PROCEDURE sp_apply_billing_upgrade(
  p_org_id              uuid,
  p_plan                text,
  p_provider            text,
  p_stripe_customer_id  text  DEFAULT NULL,
  p_stripe_sub_id       text  DEFAULT NULL,
  p_mp_sub_id           text  DEFAULT NULL,
  p_period_end          timestamp with time zone DEFAULT NULL,
  p_billing_interval    text  DEFAULT 'monthly'
)
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE organizations SET
    plan                    = p_plan,
    trial_expires_at        = NULL,  -- clear trial when paid
    stripe_customer_id      = COALESCE(p_stripe_customer_id, stripe_customer_id),
    stripe_subscription_id  = COALESCE(p_stripe_sub_id, stripe_subscription_id),
    mp_subscription_id      = COALESCE(p_mp_sub_id, mp_subscription_id),
    plan_current_period_end = COALESCE(p_period_end, plan_current_period_end),
    billing_interval        = p_billing_interval,
    updated_at              = now()
  WHERE id = p_org_id;
END;
$$;

-- ── sp_downgrade_to_free ──────────────────────────────────────────────────────

CREATE OR REPLACE PROCEDURE sp_downgrade_to_free(
  p_org_id uuid
)
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE organizations SET
    plan                    = 'FREE',
    stripe_subscription_id  = NULL,
    mp_subscription_id      = NULL,
    plan_current_period_end = NULL,
    updated_at              = now()
  WHERE id = p_org_id;
END;
$$;

COMMIT;
