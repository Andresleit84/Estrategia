-- Migration 045: Consultant Portfolio — cross-org metrics function

CREATE OR REPLACE FUNCTION fn_portfolio_metrics(p_user_id UUID)
RETURNS TABLE (
  org_id                    UUID,
  org_name                  TEXT,
  org_plan                  TEXT,
  org_mode                  TEXT,
  active_cycle_id           UUID,
  active_cycle_name         TEXT,
  active_cycle_days_remaining INTEGER,
  objectives_count          BIGINT,
  krs_count                 BIGINT,
  avg_progress              NUMERIC(5,2),
  at_risk_count             INTEGER,
  last_checkin_at           TIMESTAMPTZ,
  last_checkin_days_ago     INTEGER,
  completion_pct            NUMERIC(5,2),
  user_role                 TEXT
) LANGUAGE sql STABLE AS $$
  SELECT
    o.id                                              AS org_id,
    o.name                                            AS org_name,
    o.plan                                            AS org_plan,
    o.mode                                            AS org_mode,
    c.id                                              AS active_cycle_id,
    c.name                                            AS active_cycle_name,
    CASE
      WHEN c.end_date IS NULL THEN NULL
      ELSE GREATEST(0, (c.end_date::date - CURRENT_DATE))
    END                                               AS active_cycle_days_remaining,
    COUNT(DISTINCT ob.id)                             AS objectives_count,
    COUNT(DISTINCT kr.id)                             AS krs_count,
    COALESCE(
      ROUND(AVG(kr.progress)::NUMERIC, 2),
      0
    )                                                 AS avg_progress,
    COUNT(DISTINCT kr.id) FILTER (
      WHERE kr.confidence < 0.4
    )::INTEGER                                        AS at_risk_count,
    MAX(ci.checked_at)                                AS last_checkin_at,
    CASE
      WHEN MAX(ci.checked_at) IS NULL THEN NULL
      ELSE EXTRACT(DAY FROM NOW() - MAX(ci.checked_at))::INTEGER
    END                                               AS last_checkin_days_ago,
    CASE
      WHEN COUNT(DISTINCT ob.id) = 0 THEN 0
      ELSE ROUND(
        (COUNT(DISTINCT ob.id) FILTER (WHERE ob.status = 'COMPLETED') * 100.0
         / NULLIF(COUNT(DISTINCT ob.id), 0))::NUMERIC,
        2
      )
    END                                               AS completion_pct,
    u.role                                            AS user_role
  FROM users u
  JOIN organizations o ON o.id = u.organization_id
    AND o.deleted_at IS NULL
  LEFT JOIN LATERAL (
    SELECT id, name, end_date
    FROM cycles
    WHERE organization_id = o.id AND status = 'ACTIVE'
    ORDER BY end_date ASC NULLS LAST
    LIMIT 1
  ) c ON TRUE
  LEFT JOIN objectives ob ON ob.organization_id = o.id
    AND ob.deleted_at IS NULL
    AND (c.id IS NULL OR ob.cycle_id = c.id)
  LEFT JOIN key_results kr ON kr.objective_id = ob.id
    AND kr.deleted_at IS NULL
  LEFT JOIN check_ins ci ON ci.kr_id = kr.id
  WHERE u.email = (
    SELECT email FROM users WHERE id = p_user_id AND deleted_at IS NULL LIMIT 1
  )
    AND u.deleted_at IS NULL
    AND u.is_active = TRUE
  GROUP BY o.id, o.name, o.plan, o.mode, c.id, c.name, c.end_date, u.role
  ORDER BY o.name;
$$;

GRANT EXECUTE ON FUNCTION fn_portfolio_metrics(UUID) TO okr_user;

CREATE INDEX IF NOT EXISTS idx_users_email_org ON users(email, organization_id) WHERE deleted_at IS NULL;
