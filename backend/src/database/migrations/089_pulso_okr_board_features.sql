-- Migration 089: Pulso OKR — KRs Críticos, No Negociables, Decisiones del Consejo

-- ── 1. is_critical en key_results ──────────────────────────────────────────────

ALTER TABLE key_results
  ADD COLUMN IF NOT EXISTS is_critical BOOLEAN NOT NULL DEFAULT FALSE;

-- ── 2. board_guardrails — No Negociables del Consejo ──────────────────────────

CREATE TABLE IF NOT EXISTS board_guardrails (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  category            VARCHAR(80) NOT NULL,
  title               TEXT        NOT NULL,
  risk_description    TEXT,
  kri_description     TEXT,
  threshold           TEXT,
  escalation_trigger  TEXT,
  owner               TEXT,
  status              VARCHAR(10) NOT NULL DEFAULT 'VERDE'
                        CHECK (status IN ('VERDE','AMBER','ROJO')),
  trend               VARCHAR(10) NOT NULL DEFAULT 'STABLE'
                        CHECK (trend IN ('UP','STABLE','DOWN')),
  sort_order          INTEGER     NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_board_guardrails_org ON board_guardrails(organization_id);

-- ── 3. board_decisions — Decisiones solicitadas al Consejo ────────────────────

CREATE TABLE IF NOT EXISTS board_decisions (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  cycle_id          UUID        REFERENCES cycles(id) ON DELETE SET NULL,
  title             TEXT        NOT NULL,
  context           TEXT,
  options_json      JSONB       NOT NULL DEFAULT '[]',
  recommendation    TEXT,
  status            VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                      CHECK (status IN ('PENDING','DECIDED','DEFERRED','CLOSED')),
  owner             TEXT,
  decided_at        TIMESTAMPTZ,
  decision_note     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_board_decisions_org_cycle ON board_decisions(organization_id, cycle_id);

-- ── 4. Stored procedures para guardrails ──────────────────────────────────────

CREATE OR REPLACE PROCEDURE sp_upsert_board_guardrail(
  p_org_id             UUID,
  p_id                 UUID,   -- NULL → INSERT
  p_category           TEXT,
  p_title              TEXT,
  p_risk_description   TEXT,
  p_kri_description    TEXT,
  p_threshold          TEXT,
  p_escalation_trigger TEXT,
  p_owner              TEXT,
  p_status             TEXT,
  p_trend              TEXT,
  p_sort_order         INTEGER,
  INOUT p_out_id       UUID
)
LANGUAGE plpgsql AS $$
BEGIN
  IF p_id IS NULL THEN
    INSERT INTO board_guardrails(
      organization_id, category, title, risk_description, kri_description,
      threshold, escalation_trigger, owner, status, trend, sort_order
    ) VALUES (
      p_org_id, p_category, p_title, p_risk_description, p_kri_description,
      p_threshold, p_escalation_trigger, p_owner,
      COALESCE(p_status,'VERDE'), COALESCE(p_trend,'STABLE'), COALESCE(p_sort_order,0)
    ) RETURNING id INTO p_out_id;
  ELSE
    UPDATE board_guardrails SET
      category           = COALESCE(p_category,           category),
      title              = COALESCE(p_title,              title),
      risk_description   = p_risk_description,
      kri_description    = p_kri_description,
      threshold          = p_threshold,
      escalation_trigger = p_escalation_trigger,
      owner              = p_owner,
      status             = COALESCE(p_status,             status),
      trend              = COALESCE(p_trend,              trend),
      sort_order         = COALESCE(p_sort_order,         sort_order),
      updated_at         = NOW()
    WHERE id = p_id AND organization_id = p_org_id;
    p_out_id := p_id;
  END IF;
END;
$$;

CREATE OR REPLACE PROCEDURE sp_delete_board_guardrail(
  p_org_id UUID,
  p_id     UUID
)
LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM board_guardrails WHERE id = p_id AND organization_id = p_org_id;
END;
$$;

-- ── 5. Stored procedures para board_decisions ─────────────────────────────────

CREATE OR REPLACE PROCEDURE sp_upsert_board_decision(
  p_org_id         UUID,
  p_id             UUID,   -- NULL → INSERT
  p_cycle_id       UUID,
  p_title          TEXT,
  p_context        TEXT,
  p_options_json   JSONB,
  p_recommendation TEXT,
  p_status         TEXT,
  p_owner          TEXT,
  p_decision_note  TEXT,
  INOUT p_out_id   UUID
)
LANGUAGE plpgsql AS $$
BEGIN
  IF p_id IS NULL THEN
    INSERT INTO board_decisions(
      organization_id, cycle_id, title, context, options_json,
      recommendation, status, owner
    ) VALUES (
      p_org_id, p_cycle_id, p_title, p_context,
      COALESCE(p_options_json,'[]'::JSONB),
      p_recommendation, COALESCE(p_status,'PENDING'), p_owner
    ) RETURNING id INTO p_out_id;
  ELSE
    UPDATE board_decisions SET
      cycle_id       = COALESCE(p_cycle_id,       cycle_id),
      title          = COALESCE(p_title,           title),
      context        = p_context,
      options_json   = COALESCE(p_options_json,    options_json),
      recommendation = p_recommendation,
      status         = COALESCE(p_status,          status),
      owner          = p_owner,
      decision_note  = p_decision_note,
      decided_at     = CASE WHEN p_status IN ('DECIDED','CLOSED') AND decided_at IS NULL THEN NOW() ELSE decided_at END,
      updated_at     = NOW()
    WHERE id = p_id AND organization_id = p_org_id;
    p_out_id := p_id;
  END IF;
END;
$$;

CREATE OR REPLACE PROCEDURE sp_delete_board_decision(
  p_org_id UUID,
  p_id     UUID
)
LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM board_decisions WHERE id = p_id AND organization_id = p_org_id;
END;
$$;

-- ── 6. SP para marcar/desmarcar KR como crítico ───────────────────────────────

CREATE OR REPLACE PROCEDURE sp_set_kr_critical(
  p_org_id     UUID,
  p_kr_id      UUID,
  p_is_critical BOOLEAN
)
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE key_results kr
  SET is_critical = p_is_critical, updated_at = NOW()
  FROM objectives o
  WHERE kr.id = p_kr_id
    AND kr.objective_id = o.id
    AND o.organization_id = p_org_id
    AND kr.deleted_at IS NULL;
END;
$$;

-- ── 7. Actualizar fn_consejo_package con las nuevas secciones ─────────────────

CREATE OR REPLACE FUNCTION fn_consejo_package(p_cycle_id UUID, p_org_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_cycle           RECORD;
  v_exec_summary    JSONB;
  v_strategic       JSONB;
  v_area            JSONB;
  v_risks           JSONB;
  v_initiatives     JSONB;
  v_governance      JSONB;
  v_critical_krs    JSONB;
  v_guardrails      JSONB;
  v_decisions       JSONB;
  v_total_days      INTEGER;
  v_days_elapsed    INTEGER;
BEGIN
  SELECT c.name, c.type, c.start_date, c.end_date, c.status
  INTO v_cycle
  FROM cycles c
  WHERE c.id = p_cycle_id AND c.organization_id = p_org_id;

  IF NOT FOUND THEN RETURN '{}'::JSONB; END IF;

  v_total_days   := (v_cycle.end_date - v_cycle.start_date);
  v_days_elapsed := LEAST(GREATEST((CURRENT_DATE - v_cycle.start_date), 0), v_total_days);

  -- Executive Summary
  SELECT jsonb_build_object(
    'total_objectives',  COUNT(*),
    'on_track',          COUNT(*) FILTER (WHERE o.status = 'ON_TRACK'),
    'at_risk',           COUNT(*) FILTER (WHERE o.status = 'AT_RISK'),
    'behind',            COUNT(*) FILTER (WHERE o.status = 'BEHIND'),
    'completed',         COUNT(*) FILTER (WHERE o.status = 'COMPLETED'),
    'overall_progress',  ROUND(AVG(fn_calculate_objective_progress(o.id))::NUMERIC, 1),
    'confidence_avg',    ROUND(
      (SELECT AVG(kr.confidence) FROM key_results kr
       JOIN objectives obj ON obj.id = kr.objective_id
       WHERE obj.cycle_id = p_cycle_id AND obj.organization_id = p_org_id
         AND obj.deleted_at IS NULL AND kr.deleted_at IS NULL)::NUMERIC * 100, 1)
  )
  INTO v_exec_summary
  FROM objectives o
  WHERE o.cycle_id = p_cycle_id AND o.organization_id = p_org_id AND o.deleted_at IS NULL;

  -- Strategic Objectives (COMPANY level)
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id',          o.id,
      'code',        o.code,
      'title',       o.title,
      'progress',    ROUND(fn_calculate_objective_progress(o.id)::NUMERIC, 1),
      'status',      o.status,
      'owner_name',  u.name,
      'kr_count',    (SELECT COUNT(*) FROM key_results kr WHERE kr.objective_id = o.id AND kr.deleted_at IS NULL),
      'kr_on_track', (SELECT COUNT(*) FROM key_results kr WHERE kr.objective_id = o.id AND kr.deleted_at IS NULL AND kr.status = 'ON_TRACK')
    ) ORDER BY o.code NULLS LAST
  ), '[]'::JSONB)
  INTO v_strategic
  FROM objectives o
  LEFT JOIN users u ON u.id = o.owner_id
  WHERE o.cycle_id = p_cycle_id AND o.organization_id = p_org_id
    AND o.level = 'COMPANY' AND o.deleted_at IS NULL;

  -- Area Objectives grouped by area
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object('area_name', grp.area_name, 'objectives', grp.objectives)
    ORDER BY grp.area_name
  ), '[]'::JSONB)
  INTO v_area
  FROM (
    SELECT
      COALESCE(a.name, 'Sin área') AS area_name,
      jsonb_agg(jsonb_build_object(
        'id',       o.id, 'code', o.code, 'title', o.title,
        'progress', ROUND(fn_calculate_objective_progress(o.id)::NUMERIC, 1),
        'status',   o.status
      ) ORDER BY o.code NULLS LAST) AS objectives
    FROM objectives o
    LEFT JOIN teams t ON t.id = o.team_id
    LEFT JOIN areas a ON a.id = t.area_id
    WHERE o.cycle_id = p_cycle_id AND o.organization_id = p_org_id
      AND o.level = 'AREA' AND o.deleted_at IS NULL
    GROUP BY COALESCE(a.name, 'Sin área')
  ) grp;

  -- Top Risks
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'kr_code',            kr.code,
      'kr_title',           kr.title,
      'objective_title',    o.title,
      'objective_level',    o.level,
      'progress',           ROUND(CASE
        WHEN kr.target_value = kr.start_value THEN 0
        ELSE ((kr.current_value - kr.start_value) / NULLIF(kr.target_value - kr.start_value, 0)) * 100
      END::NUMERIC, 1),
      'confidence',         ROUND(kr.confidence::NUMERIC * 100, 1),
      'owner_name',         u.name,
      'days_since_checkin', COALESCE(
        EXTRACT(DAY FROM NOW() - (SELECT MAX(ci.checked_at) FROM check_ins ci WHERE ci.kr_id = kr.id))::INTEGER, -1)
    )
    ORDER BY (o.level = 'COMPANY') DESC, kr.confidence ASC
  ), '[]'::JSONB)
  INTO v_risks
  FROM key_results kr
  JOIN objectives o ON o.id = kr.objective_id
  LEFT JOIN users u ON u.id = kr.owner_id
  WHERE o.cycle_id = p_cycle_id AND o.organization_id = p_org_id
    AND kr.status = 'AT_RISK' AND o.deleted_at IS NULL AND kr.deleted_at IS NULL
  LIMIT 10;

  -- Initiatives Summary
  SELECT jsonb_build_object(
    'total',    COUNT(*),
    'on_track', COUNT(*) FILTER (WHERE i.status = 'ON_TRACK'),
    'at_risk',  COUNT(*) FILTER (WHERE i.status = 'AT_RISK'),
    'overdue',  COUNT(*) FILTER (WHERE i.status = 'OVERDUE'
                               OR (i.due_date < CURRENT_DATE AND i.status NOT IN ('COMPLETED','CANCELLED')))
  )
  INTO v_initiatives
  FROM initiatives i
  WHERE i.cycle_id = p_cycle_id AND i.organization_id = p_org_id AND i.deleted_at IS NULL;

  -- Governance Commitments
  BEGIN
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'event_type', ga.event_type, 'title', ga.title,
        'due_date',   ga.due_date,   'status', ga.status
      ) ORDER BY ga.due_date NULLS LAST
    ), '[]'::JSONB)
    INTO v_governance
    FROM governance_activities ga
    WHERE ga.organization_id = p_org_id
      AND ga.status IN ('UPCOMING','IN_PROGRESS')
      AND (ga.due_date >= CURRENT_DATE OR ga.scheduled_date >= CURRENT_DATE)
    LIMIT 8;
  EXCEPTION WHEN undefined_table THEN
    v_governance := '[]'::JSONB;
  END;

  -- KRs Críticos (Gates del OKR)
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id',              kr.id,
      'code',            kr.code,
      'title',           kr.title,
      'objective_id',    o.id,
      'objective_code',  o.code,
      'objective_title', o.title,
      'progress',        ROUND(CASE
        WHEN kr.target_value = kr.start_value THEN 0
        ELSE ((kr.current_value - kr.start_value) / NULLIF(kr.target_value - kr.start_value, 0)) * 100
      END::NUMERIC, 1),
      'confidence',      ROUND(kr.confidence::NUMERIC * 100, 1),
      'status',          kr.status,
      'owner_name',      u.name,
      'days_since_checkin', COALESCE(
        EXTRACT(DAY FROM NOW() - (SELECT MAX(ci.checked_at) FROM check_ins ci WHERE ci.kr_id = kr.id))::INTEGER, -1)
    )
    ORDER BY (kr.status = 'AT_RISK') DESC, (kr.status = 'BEHIND') DESC, kr.confidence ASC
  ), '[]'::JSONB)
  INTO v_critical_krs
  FROM key_results kr
  JOIN objectives o ON o.id = kr.objective_id
  LEFT JOIN users u ON u.id = kr.owner_id
  WHERE o.cycle_id = p_cycle_id AND o.organization_id = p_org_id
    AND kr.is_critical = TRUE AND o.deleted_at IS NULL AND kr.deleted_at IS NULL;

  -- Board Guardrails (No Negociables)
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id',                  g.id,
      'category',            g.category,
      'title',               g.title,
      'risk_description',    g.risk_description,
      'kri_description',     g.kri_description,
      'threshold',           g.threshold,
      'escalation_trigger',  g.escalation_trigger,
      'owner',               g.owner,
      'status',              g.status,
      'trend',               g.trend
    )
    ORDER BY g.sort_order, g.category, g.created_at
  ), '[]'::JSONB)
  INTO v_guardrails
  FROM board_guardrails g
  WHERE g.organization_id = p_org_id;

  -- Board Decisions (Decisiones Solicitadas)
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id',             d.id,
      'title',          d.title,
      'context',        d.context,
      'options',        d.options_json,
      'recommendation', d.recommendation,
      'status',         d.status,
      'owner',          d.owner,
      'decided_at',     d.decided_at,
      'decision_note',  d.decision_note
    )
    ORDER BY d.created_at DESC
  ), '[]'::JSONB)
  INTO v_decisions
  FROM board_decisions d
  WHERE d.organization_id = p_org_id
    AND d.cycle_id = p_cycle_id
    AND d.status IN ('PENDING','DECIDED','DEFERRED');

  RETURN jsonb_build_object(
    'cycle',                   jsonb_build_object(
      'name',           v_cycle.name,
      'type',           v_cycle.type,
      'start_date',     v_cycle.start_date,
      'end_date',       v_cycle.end_date,
      'days_elapsed',   v_days_elapsed,
      'days_remaining', GREATEST(v_total_days - v_days_elapsed, 0),
      'status',         v_cycle.status
    ),
    'executive_summary',       v_exec_summary,
    'strategic_objectives',    v_strategic,
    'area_objectives',         v_area,
    'top_risks',               COALESCE(v_risks,      '[]'::JSONB),
    'initiatives_summary',     COALESCE(v_initiatives, jsonb_build_object('total',0,'on_track',0,'at_risk',0,'overdue',0)),
    'governance_commitments',  COALESCE(v_governance,  '[]'::JSONB),
    'critical_krs',            COALESCE(v_critical_krs,'[]'::JSONB),
    'guardrails',              COALESCE(v_guardrails,  '[]'::JSONB),
    'requested_decisions',     COALESCE(v_decisions,   '[]'::JSONB)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION fn_consejo_package(UUID, UUID) TO okr_user;
GRANT ALL ON board_guardrails TO okr_user;
GRANT ALL ON board_decisions TO okr_user;
