-- Migration 047: Consejo Package
-- Función fn_consejo_package(p_cycle_id UUID, p_org_id UUID)
-- Retorna JSONB con toda la estructura del paquete para el Consejo de Administración

CREATE OR REPLACE FUNCTION fn_consejo_package(p_cycle_id UUID, p_org_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_cycle         RECORD;
  v_exec_summary  JSONB;
  v_strategic     JSONB;
  v_area          JSONB;
  v_risks         JSONB;
  v_initiatives   JSONB;
  v_governance    JSONB;
  v_total_days    INTEGER;
  v_days_elapsed  INTEGER;
BEGIN
  -- Validate cycle belongs to org
  SELECT c.name, c.type, c.start_date, c.end_date, c.status
  INTO v_cycle
  FROM cycles c
  WHERE c.id = p_cycle_id AND c.organization_id = p_org_id;

  IF NOT FOUND THEN
    RETURN '{}'::JSONB;
  END IF;

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
  WHERE o.cycle_id = p_cycle_id
    AND o.organization_id = p_org_id
    AND o.deleted_at IS NULL;

  -- Strategic Objectives (COMPANY level only)
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
    )
    ORDER BY o.code NULLS LAST
  ), '[]'::JSONB)
  INTO v_strategic
  FROM objectives o
  LEFT JOIN users u ON u.id = o.owner_id
  WHERE o.cycle_id = p_cycle_id
    AND o.organization_id = p_org_id
    AND o.level = 'COMPANY'
    AND o.deleted_at IS NULL;

  -- Area Objectives grouped by area
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'area_name',   grp.area_name,
      'objectives',  grp.objectives
    )
    ORDER BY grp.area_name
  ), '[]'::JSONB)
  INTO v_area
  FROM (
    SELECT
      COALESCE(a.name, 'Sin área') AS area_name,
      jsonb_agg(
        jsonb_build_object(
          'id',       o.id,
          'code',     o.code,
          'title',    o.title,
          'progress', ROUND(fn_calculate_objective_progress(o.id)::NUMERIC, 1),
          'status',   o.status
        )
        ORDER BY o.code NULLS LAST
      ) AS objectives
    FROM objectives o
    LEFT JOIN teams t ON t.id = o.team_id
    LEFT JOIN areas a ON a.id = t.area_id
    WHERE o.cycle_id = p_cycle_id
      AND o.organization_id = p_org_id
      AND o.level = 'AREA'
      AND o.deleted_at IS NULL
    GROUP BY COALESCE(a.name, 'Sin área')
  ) grp;

  -- Top Risks: AT_RISK KRs, prioritizing strategic impact
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'kr_code',           kr.code,
      'kr_title',          kr.title,
      'objective_title',   o.title,
      'objective_level',   o.level,
      'progress',          ROUND(
        CASE
          WHEN kr.target_value = kr.start_value THEN 0
          ELSE ((kr.current_value - kr.start_value) / NULLIF(kr.target_value - kr.start_value, 0)) * 100
        END::NUMERIC, 1),
      'confidence',        ROUND(kr.confidence::NUMERIC * 100, 1),
      'owner_name',        u.name,
      'days_since_checkin', COALESCE(
        EXTRACT(DAY FROM NOW() - (
          SELECT MAX(ci.checked_at) FROM check_ins ci WHERE ci.kr_id = kr.id
        ))::INTEGER, -1)
    )
    ORDER BY (o.level = 'COMPANY') DESC, kr.confidence ASC
  ), '[]'::JSONB)
  INTO v_risks
  FROM key_results kr
  JOIN objectives o ON o.id = kr.objective_id
  LEFT JOIN users u ON u.id = kr.owner_id
  WHERE o.cycle_id = p_cycle_id
    AND o.organization_id = p_org_id
    AND kr.status = 'AT_RISK'
    AND o.deleted_at IS NULL
    AND kr.deleted_at IS NULL
  LIMIT 10;

  -- Initiatives Summary
  SELECT jsonb_build_object(
    'total',    COUNT(*),
    'on_track', COUNT(*) FILTER (WHERE i.status = 'ON_TRACK'),
    'at_risk',  COUNT(*) FILTER (WHERE i.status = 'AT_RISK'),
    'overdue',  COUNT(*) FILTER (WHERE i.status = 'OVERDUE' OR (i.due_date < CURRENT_DATE AND i.status NOT IN ('COMPLETED', 'CANCELLED')))
  )
  INTO v_initiatives
  FROM initiatives i
  WHERE i.cycle_id = p_cycle_id
    AND i.organization_id = p_org_id
    AND i.deleted_at IS NULL;

  -- Governance Commitments (upcoming from governance_activities if table exists)
  BEGIN
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'event_type', ga.event_type,
        'title',      ga.title,
        'due_date',   ga.due_date,
        'status',     ga.status
      )
      ORDER BY ga.due_date NULLS LAST
    ), '[]'::JSONB)
    INTO v_governance
    FROM governance_activities ga
    WHERE ga.organization_id = p_org_id
      AND ga.status IN ('UPCOMING', 'IN_PROGRESS')
      AND (ga.due_date >= CURRENT_DATE OR ga.scheduled_date >= CURRENT_DATE)
    LIMIT 8;
  EXCEPTION WHEN undefined_table THEN
    v_governance := '[]'::JSONB;
  END;

  RETURN jsonb_build_object(
    'cycle', jsonb_build_object(
      'name',           v_cycle.name,
      'type',           v_cycle.type,
      'start_date',     v_cycle.start_date,
      'end_date',       v_cycle.end_date,
      'days_elapsed',   v_days_elapsed,
      'days_remaining', GREATEST(v_total_days - v_days_elapsed, 0),
      'status',         v_cycle.status
    ),
    'executive_summary',      v_exec_summary,
    'strategic_objectives',   v_strategic,
    'area_objectives',        v_area,
    'top_risks',              COALESCE(v_risks, '[]'::JSONB),
    'initiatives_summary',    COALESCE(v_initiatives, jsonb_build_object('total',0,'on_track',0,'at_risk',0,'overdue',0)),
    'governance_commitments', COALESCE(v_governance, '[]'::JSONB)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION fn_consejo_package(UUID, UUID) TO okr_user;
