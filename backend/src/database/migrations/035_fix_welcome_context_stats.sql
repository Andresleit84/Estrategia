-- ── Migración 035: fn_welcome_context — corrige org_stats y añade avg_progress ─
-- Problema: org_stats filtraba por status='ON_TRACK'/'AT_RISK' pero los objetivos
-- tienen status='ACTIVE'/'COMPLETED'/'CANCELLED'.
-- También se añade avg_progress al ciclo activo para que el anillo sea coherente.

CREATE OR REPLACE FUNCTION fn_welcome_context(
  p_org_id   UUID,
  p_user_id  UUID,
  p_cycle_id UUID DEFAULT NULL
)
RETURNS JSON LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_result   JSON;
  v_cycle_id UUID;
BEGIN
  -- Resolver ciclo efectivo
  IF p_cycle_id IS NOT NULL THEN
    v_cycle_id := p_cycle_id;
  ELSE
    SELECT c.id INTO v_cycle_id
    FROM cycles c
    WHERE c.organization_id = p_org_id
      AND c.status = 'ACTIVE'
      AND c.deleted_at IS NULL
    ORDER BY
      CASE c.type WHEN 'QUARTERLY' THEN 1 WHEN 'ANNUAL' THEN 2 ELSE 3 END
    LIMIT 1;
  END IF;

  SELECT json_build_object(

    -- Datos del usuario
    'user', (
      SELECT json_build_object('id', u.id, 'name', u.name, 'role', u.role)
      FROM users u WHERE u.id = p_user_id
    ),

    -- Ciclo seleccionado (incluye avg_progress real de KRs)
    'active_cycle', (
      SELECT json_build_object(
        'id',             c.id,
        'name',           c.name,
        'type',           c.type,
        'status',         c.status,
        'start_date',     c.start_date,
        'end_date',       c.end_date,
        'days_remaining', GREATEST(0, (c.end_date - CURRENT_DATE)),
        'days_elapsed',   GREATEST(0, (CURRENT_DATE - c.start_date)),
        'total_days',     (c.end_date - c.start_date),
        'cycle_pct',      ROUND(
          100.0 * GREATEST(0, (CURRENT_DATE - c.start_date)::NUMERIC)
          / NULLIF((c.end_date - c.start_date)::NUMERIC, 0)
        ),
        'avg_progress', (
          SELECT COALESCE(ROUND(AVG(kr.progress)::NUMERIC, 0), 0)
          FROM key_results kr
          JOIN objectives o ON kr.objective_id = o.id
          WHERE o.organization_id = p_org_id
            AND o.cycle_id = v_cycle_id
            AND kr.deleted_at IS NULL
            AND o.deleted_at IS NULL
            AND kr.status NOT IN ('CANCELLED')
        )
      )
      FROM cycles c
      WHERE c.id = v_cycle_id AND c.deleted_at IS NULL
    ),

    -- Mis OKRs en el ciclo seleccionado
    'my_objectives', (
      SELECT COALESCE(json_agg(json_build_object(
        'id',       o.id,
        'code',     o.code,
        'title',    o.title,
        'status',   o.status,
        'level',    o.level,
        'kr_count', (SELECT COUNT(*) FROM key_results kr WHERE kr.objective_id = o.id AND kr.deleted_at IS NULL)
      ) ORDER BY o.created_at), '[]'::JSON)
      FROM objectives o
      WHERE o.organization_id = p_org_id
        AND o.cycle_id = v_cycle_id
        AND o.owner_id = p_user_id
        AND o.deleted_at IS NULL
        AND o.status NOT IN ('CANCELLED', 'COMPLETED')
    ),

    -- KRs pendientes de check-in (+7 días, en el ciclo seleccionado)
    'pending_checkins', (
      SELECT COALESCE(json_agg(json_build_object(
        'kr_id',           kr.id,
        'kr_code',         kr.code,
        'kr_title',        kr.title,
        'obj_code',        o.code,
        'objective_title', o.title,
        'days_since',      COALESCE(EXTRACT(DAY FROM (NOW() - kr.last_checkin_at))::INT, 999),
        'last_checkin_at', kr.last_checkin_at,
        'confidence',      kr.confidence,
        'progress',        kr.progress
      ) ORDER BY kr.last_checkin_at ASC NULLS FIRST), '[]'::JSON)
      FROM key_results kr
      JOIN objectives o ON kr.objective_id = o.id
      WHERE o.organization_id = p_org_id
        AND o.cycle_id = v_cycle_id
        AND kr.owner_id = p_user_id
        AND kr.deleted_at IS NULL
        AND o.deleted_at IS NULL
        AND kr.status NOT IN ('CANCELLED', 'COMPLETED')
        AND (kr.last_checkin_at IS NULL OR kr.last_checkin_at < NOW() - INTERVAL '7 days')
      LIMIT 5
    ),

    -- KRs en riesgo en el ciclo seleccionado
    'at_risk_krs', (
      SELECT COALESCE(json_agg(json_build_object(
        'kr_id',           kr.id,
        'kr_code',         kr.code,
        'kr_title',        kr.title,
        'obj_code',        o.code,
        'objective_title', o.title,
        'confidence',      kr.confidence,
        'progress',        kr.progress,
        'level',           o.level
      ) ORDER BY kr.confidence ASC), '[]'::JSON)
      FROM key_results kr
      JOIN objectives o ON kr.objective_id = o.id
      WHERE o.organization_id = p_org_id
        AND o.cycle_id = v_cycle_id
        AND kr.deleted_at IS NULL
        AND o.deleted_at IS NULL
        AND kr.confidence < 0.4
        AND kr.status NOT IN ('CANCELLED', 'COMPLETED')
      LIMIT 4
    ),

    -- Próximos eventos de gobernanza (no depende del ciclo)
    'upcoming_governance', (
      SELECT COALESCE(json_agg(json_build_object(
        'event_type',     g.event_type,
        'title',          g.title,
        'responsible',    g.responsible,
        'deliverable',    g.deliverable,
        'scheduled_date', g.scheduled_date,
        'due_date',       g.due_date,
        'status',         g.status
      )), '[]'::JSON)
      FROM fn_governance_calendar(p_org_id, 'ANNUAL') g
      WHERE g.status IN ('UPCOMING', 'IN_PROGRESS', 'OVERDUE')
        AND g.scheduled_date <= CURRENT_DATE + INTERVAL '14 days'
        AND g.scheduled_date >= CURRENT_DATE - INTERVAL '7 days'
      LIMIT 4
    ),

    -- Estadísticas del ciclo seleccionado (corregido: usa status reales)
    'org_stats', (
      SELECT json_build_object(
        'total_objectives', COUNT(*) FILTER (WHERE o.status NOT IN ('CANCELLED')),
        -- En ruta: ACTIVE sin KRs en riesgo
        'on_track', (
          SELECT COUNT(DISTINCT o2.id)
          FROM objectives o2
          WHERE o2.organization_id = p_org_id
            AND o2.cycle_id = v_cycle_id
            AND o2.status = 'ACTIVE'
            AND o2.deleted_at IS NULL
            AND NOT EXISTS (
              SELECT 1 FROM key_results kr3
              WHERE kr3.objective_id = o2.id
                AND kr3.deleted_at IS NULL
                AND kr3.confidence < 0.4
                AND kr3.status NOT IN ('CANCELLED', 'COMPLETED')
            )
        ),
        -- En riesgo: ACTIVE con al menos un KR con confidence < 0.4
        'at_risk', (
          SELECT COUNT(DISTINCT o2.id)
          FROM objectives o2
          JOIN key_results kr3 ON kr3.objective_id = o2.id
          WHERE o2.organization_id = p_org_id
            AND o2.cycle_id = v_cycle_id
            AND o2.status = 'ACTIVE'
            AND o2.deleted_at IS NULL
            AND kr3.deleted_at IS NULL
            AND kr3.confidence < 0.4
            AND kr3.status NOT IN ('CANCELLED', 'COMPLETED')
        ),
        'completed', COUNT(*) FILTER (WHERE o.status = 'COMPLETED'),
        'at_risk_krs', (
          SELECT COUNT(*)
          FROM key_results kr2
          JOIN objectives o2 ON kr2.objective_id = o2.id
          WHERE o2.organization_id = p_org_id
            AND o2.cycle_id = v_cycle_id
            AND kr2.deleted_at IS NULL AND o2.deleted_at IS NULL
            AND kr2.confidence < 0.4
            AND kr2.status NOT IN ('CANCELLED', 'COMPLETED')
        )
      )
      FROM objectives o
      WHERE o.organization_id = p_org_id
        AND o.cycle_id = v_cycle_id
        AND o.deleted_at IS NULL
    )

  ) INTO v_result;

  RETURN v_result;
END;
$$;
