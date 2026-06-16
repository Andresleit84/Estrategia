-- ================================================================
-- Migration 065: fn_personal_briefing + personal_briefing notif
-- Single source of truth for per-user pre-meeting briefing data
-- ================================================================

-- ── 1. fn_personal_briefing ──────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_personal_briefing(p_org_id UUID, p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_cycle_id       UUID;
  v_user_name      TEXT;
  v_user_email     TEXT;
  v_at_risk_krs    JSONB;
  v_agreements     JSONB;
  v_sprint_items   JSONB;
  v_my_objectives  JSONB;
BEGIN
  -- User info
  SELECT name, email
    INTO v_user_name, v_user_email
    FROM users
   WHERE id = p_user_id
     AND organization_id = p_org_id
     AND deleted_at IS NULL;

  IF v_user_name IS NULL THEN RETURN NULL; END IF;

  -- Active cycle for this org
  SELECT id INTO v_cycle_id
    FROM cycles
   WHERE organization_id = p_org_id
     AND status = 'ACTIVE'
   ORDER BY start_date DESC
   LIMIT 1;

  -- At-risk KRs owned by this user
  SELECT jsonb_agg(
    jsonb_build_object(
      'kr_title',           r.kr_title,
      'objective_title',    r.objective_title,
      'confidence',         r.confidence,
      'progress',           ROUND(r.progress::numeric),
      'days_since_checkin', r.days_since_checkin,
      'status',             r.status
    ) ORDER BY r.confidence ASC, r.days_since_checkin DESC
  )
  INTO v_at_risk_krs
  FROM v_at_risk_krs r
  WHERE r.organization_id = p_org_id
    AND r.owner_id         = p_user_id
    AND (v_cycle_id IS NULL OR r.cycle_id = v_cycle_id);

  -- Agreements: overdue OR due within 7 days, owned by user
  SELECT jsonb_agg(
    jsonb_build_object(
      'title',         a.title,
      'code',          a.code,
      'due_date',      a.due_date,
      'is_overdue',    a.is_overdue,
      'days_remaining', CASE
                          WHEN a.due_date IS NULL THEN NULL
                          ELSE (a.due_date::date - CURRENT_DATE)::int
                        END,
      'priority',      a.priority
    ) ORDER BY
      CASE WHEN a.is_overdue THEN 0 ELSE 1 END,
      a.due_date ASC NULLS LAST
  )
  INTO v_agreements
  FROM v_agreements a
  WHERE a.organization_id = p_org_id
    AND a.owner_id         = p_user_id
    AND a.status NOT IN ('FULFILLED', 'CANCELLED')
    AND (
      a.is_overdue = TRUE
      OR (a.due_date IS NOT NULL AND a.due_date::date <= CURRENT_DATE + 7)
    );

  -- Active backlog items assigned to user in current cycle
  SELECT jsonb_agg(
    jsonb_build_object(
      'title',        bi.title,
      'type',         bi.type,
      'status',       bi.status,
      'priority',     bi.priority,
      'story_points', bi.story_points
    ) ORDER BY
      CASE bi.priority WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END,
      CASE bi.status   WHEN 'IN_PROGRESS' THEN 1 ELSE 2 END
  )
  INTO v_sprint_items
  FROM (
    SELECT bi.*
      FROM backlog_items bi
     WHERE bi.organization_id = p_org_id
       AND bi.assignee_id     = p_user_id
       AND bi.status IN ('OPEN', 'IN_PROGRESS')
       AND (v_cycle_id IS NULL OR bi.cycle_id = v_cycle_id)
     LIMIT 5
  ) bi;

  -- My active objectives in current cycle
  SELECT jsonb_agg(
    jsonb_build_object(
      'title',    o.title,
      'level',    o.level,
      'progress', ROUND(fn_calculate_objective_progress(o.id)::numeric)
    ) ORDER BY
      CASE o.level WHEN 'COMPANY' THEN 1 WHEN 'AREA' THEN 2 WHEN 'TEAM' THEN 3 ELSE 4 END,
      o.title
  )
  INTO v_my_objectives
  FROM objectives o
  WHERE o.organization_id = p_org_id
    AND o.owner_id         = p_user_id
    AND o.deleted_at       IS NULL
    AND (v_cycle_id IS NULL OR o.cycle_id = v_cycle_id)
    AND o.status NOT IN ('COMPLETED', 'CANCELLED');

  RETURN jsonb_build_object(
    'user_name',          v_user_name,
    'user_email',         v_user_email,
    'cycle_id',           v_cycle_id,
    'at_risk_krs',        COALESCE(v_at_risk_krs, '[]'::jsonb),
    'at_risk_count',      jsonb_array_length(COALESCE(v_at_risk_krs, '[]'::jsonb)),
    'agreements_due',     COALESCE(v_agreements, '[]'::jsonb),
    'agreements_count',   jsonb_array_length(COALESCE(v_agreements, '[]'::jsonb)),
    'sprint_items',       COALESCE(v_sprint_items, '[]'::jsonb),
    'sprint_items_count', jsonb_array_length(COALESCE(v_sprint_items, '[]'::jsonb)),
    'my_objectives',      COALESCE(v_my_objectives, '[]'::jsonb),
    'objectives_count',   jsonb_array_length(COALESCE(v_my_objectives, '[]'::jsonb))
  );
END;
$$;

-- ── 2. Add personal_briefing to notification config ──────────────
UPDATE organizations
   SET parameters = jsonb_set(
         parameters,
         '{notifications,personal_briefing}',
         '{"enabled":true,"channels":["email"],"hour":7,"frequency":"weekly","day_of_week":1}'::jsonb,
         true
       )
 WHERE deleted_at IS NULL
   AND (parameters -> 'notifications') IS NOT NULL;

-- ── 3. Add notif_sent_personal_briefing tracking ─────────────────
-- (persisted in parameters JSONB by updateSentAt — no schema change needed)
