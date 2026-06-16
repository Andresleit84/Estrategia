-- Fixup for migration 029: create missing fn_update_updated_at and replace fn_governance_calendar

CREATE OR REPLACE FUNCTION fn_update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_governance_activities_updated_at ON governance_activities;
CREATE TRIGGER trg_governance_activities_updated_at
  BEFORE UPDATE ON governance_activities
  FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

DROP FUNCTION IF EXISTS fn_governance_calendar(UUID, TEXT);

CREATE OR REPLACE FUNCTION fn_governance_calendar(
  p_org_id  UUID,
  p_horizon TEXT DEFAULT 'ANNUAL'
)
RETURNS TABLE (
  event_id       TEXT,
  event_type     TEXT,
  title          TEXT,
  description    TEXT,
  responsible    TEXT,
  deliverable    TEXT,
  frequency      TEXT,
  scheduled_date DATE,
  due_date       DATE,
  cycle_id       UUID,
  cycle_name     TEXT,
  cycle_type     TEXT,
  status         TEXT,
  completion_pct INTEGER,
  is_overdue     BOOLEAN,
  is_custom      BOOLEAN
) LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN QUERY
  WITH cycle_data AS (
    SELECT
      c.id,
      c.name,
      c.type,
      c.status,
      c.start_date,
      c.end_date,
      (c.start_date + (c.end_date - c.start_date) / 2)::DATE AS midpoint,
      (SELECT COUNT(*)
         FROM objectives o
        WHERE o.cycle_id = c.id AND o.deleted_at IS NULL
      )::INTEGER AS obj_count,
      COALESCE((
        SELECT CAST(
          100.0 *
          COUNT(*) FILTER (
            WHERE kr.last_checkin_at IS NOT NULL
              AND kr.last_checkin_at > NOW() - INTERVAL '14 days'
          ) / NULLIF(COUNT(*), 0)
        AS INTEGER)
        FROM key_results kr
        JOIN objectives o ON kr.objective_id = o.id
        WHERE o.cycle_id = c.id AND kr.deleted_at IS NULL
      ), 0) AS checkin_health_pct
    FROM cycles c
    WHERE c.organization_id = p_org_id
      AND c.deleted_at IS NULL
      AND c.start_date >= CASE p_horizon
            WHEN 'QUARTERLY' THEN CURRENT_DATE - INTERVAL '4 months'
            WHEN 'ANNUAL'    THEN CURRENT_DATE - INTERVAL '15 months'
            ELSE                  CURRENT_DATE - INTERVAL '4 years'
          END
      AND c.start_date <= CASE p_horizon
            WHEN 'QUARTERLY' THEN CURRENT_DATE + INTERVAL '4 months'
            WHEN 'ANNUAL'    THEN CURRENT_DATE + INTERVAL '15 months'
            ELSE                  CURRENT_DATE + INTERVAL '4 years'
          END
  ),
  all_events AS (
    -- KICKOFF — alias on first branch so UNION inherits column names
    SELECT
      ('KICKOFF_' || cd.id::TEXT)                                                                  AS event_id,
      'KICKOFF'::TEXT                                                                               AS event_type,
      ('Arranque: ' || cd.name)                                                                    AS title,
      'Publicar y comunicar los OKRs del ciclo a todos los equipos.'::TEXT                        AS description,
      'Lider OKR / Direccion'::TEXT                                                                AS responsible,
      'OKRs publicados, comunicados y con responsables asignados'::TEXT                            AS deliverable,
      (CASE cd.type WHEN 'QUARTERLY' THEN 'Trimestral' WHEN 'ANNUAL' THEN 'Anual' ELSE 'Por ciclo' END)::TEXT AS frequency,
      cd.start_date                                                                                AS scheduled_date,
      (cd.start_date + INTERVAL '7 days')::DATE                                                   AS due_date,
      cd.id                                                                                        AS cycle_id,
      cd.name                                                                                      AS cycle_name,
      cd.type                                                                                      AS cycle_type,
      (CASE
        WHEN cd.obj_count > 0                                         THEN 'COMPLETED'
        WHEN cd.start_date > CURRENT_DATE + INTERVAL '7 days'        THEN 'UPCOMING'
        WHEN (cd.start_date + INTERVAL '7 days')::DATE < CURRENT_DATE THEN 'OVERDUE'
        ELSE 'IN_PROGRESS'
      END)::TEXT                                                                                   AS status,
      LEAST(100, cd.obj_count * 20)                                                               AS completion_pct,
      FALSE                                                                                        AS is_custom
    FROM cycle_data cd

    UNION ALL

    SELECT
      'CHECKIN_' || cd.id::TEXT,
      'CHECK_IN_HEALTH',
      'Cadencia de check-ins: ' || cd.name,
      'Actualizar semanalmente el valor actual y nivel de confianza de cada KR.',
      'Responsables de KR',
      'Todos los KRs activos con check-in en los ultimos 7 dias',
      'Semanal',
      cd.start_date,
      cd.end_date,
      cd.id, cd.name, cd.type,
      CASE
        WHEN cd.obj_count = 0                                     THEN 'COMPLETED'
        WHEN cd.status = 'CLOSED' AND cd.checkin_health_pct >= 60 THEN 'COMPLETED'
        WHEN cd.checkin_health_pct >= 70                          THEN 'COMPLETED'
        WHEN cd.checkin_health_pct >= 35                          THEN 'IN_PROGRESS'
        WHEN cd.end_date < CURRENT_DATE                           THEN 'OVERDUE'
        ELSE 'IN_PROGRESS'
      END,
      cd.checkin_health_pct,
      FALSE
    FROM cycle_data cd WHERE cd.status IN ('ACTIVE', 'CLOSED')

    UNION ALL

    SELECT
      'MID_REVIEW_' || cd.id::TEXT,
      'MID_REVIEW',
      'Revision de medio ciclo: ' || cd.name,
      'Evaluar el progreso a la mitad del ciclo. Identificar KRs en riesgo, ajustar iniciativas e informar a stakeholders.',
      'Lideres de area / Equipo OKR',
      'Informe de avance, KRs ajustados y decisiones documentadas',
      CASE cd.type WHEN 'QUARTERLY' THEN 'Trimestral' WHEN 'ANNUAL' THEN 'Semestral' ELSE 'Por ciclo' END,
      (cd.midpoint - INTERVAL '3 days')::DATE,
      (cd.midpoint + INTERVAL '5 days')::DATE,
      cd.id, cd.name, cd.type,
      CASE
        WHEN (cd.midpoint - INTERVAL '3 days')::DATE > CURRENT_DATE              THEN 'UPCOMING'
        WHEN (cd.midpoint + INTERVAL '5 days')::DATE < CURRENT_DATE
          AND cd.checkin_health_pct > 0                                           THEN 'COMPLETED'
        WHEN (cd.midpoint + INTERVAL '5 days')::DATE < CURRENT_DATE              THEN 'OVERDUE'
        ELSE 'IN_PROGRESS'
      END,
      cd.checkin_health_pct,
      FALSE
    FROM cycle_data cd

    UNION ALL

    SELECT
      'CYCLE_REVIEW_' || cd.id::TEXT,
      'CYCLE_REVIEW',
      'Revision y cierre: ' || cd.name,
      'Evaluar el logro final de cada OKR, documentar el score del ciclo y comunicar resultados.',
      'Todo el equipo',
      'Ciclo cerrado, score calculado y resultados comunicados',
      CASE cd.type WHEN 'QUARTERLY' THEN 'Trimestral' WHEN 'ANNUAL' THEN 'Anual' ELSE 'Por ciclo' END,
      (cd.end_date - INTERVAL '7 days')::DATE,
      (cd.end_date + INTERVAL '7 days')::DATE,
      cd.id, cd.name, cd.type,
      CASE
        WHEN cd.status = 'CLOSED'                                                THEN 'COMPLETED'
        WHEN (cd.end_date - INTERVAL '7 days')::DATE > CURRENT_DATE             THEN 'UPCOMING'
        WHEN (cd.end_date + INTERVAL '7 days')::DATE < CURRENT_DATE
          AND cd.status != 'CLOSED'                                              THEN 'OVERDUE'
        ELSE 'IN_PROGRESS'
      END,
      CASE WHEN cd.status = 'CLOSED' THEN 100 ELSE 0 END,
      FALSE
    FROM cycle_data cd

    UNION ALL

    SELECT
      'RETRO_' || cd.id::TEXT,
      'RETROSPECTIVE',
      'Retrospectiva: ' || cd.name,
      'Reflexionar sobre el proceso OKR.',
      'Lideres OKR + Equipos',
      'Lecciones aprendidas documentadas y plan de mejora',
      CASE cd.type WHEN 'QUARTERLY' THEN 'Trimestral' WHEN 'ANNUAL' THEN 'Anual' ELSE 'Por ciclo' END,
      (cd.end_date + INTERVAL '3 days')::DATE,
      (cd.end_date + INTERVAL '21 days')::DATE,
      cd.id, cd.name, cd.type,
      CASE
        WHEN (cd.end_date + INTERVAL '3 days')::DATE > CURRENT_DATE  THEN 'UPCOMING'
        WHEN (cd.end_date + INTERVAL '21 days')::DATE < CURRENT_DATE THEN 'COMPLETED'
        ELSE 'IN_PROGRESS'
      END,
      CASE WHEN (cd.end_date + INTERVAL '21 days')::DATE < CURRENT_DATE THEN 100 ELSE 0 END,
      FALSE
    FROM cycle_data cd
    WHERE cd.status IN ('CLOSED', 'ACTIVE')
      OR (cd.end_date + INTERVAL '21 days')::DATE >= CURRENT_DATE

    UNION ALL

    SELECT
      'STRATEGIC_' || cd.id::TEXT,
      'STRATEGIC_REVIEW',
      'Revision estrategica ' || EXTRACT(YEAR FROM cd.end_date)::TEXT,
      'Revisar las intenciones estrategicas de largo plazo y actualizar la direccion organizacional.',
      'Alta direccion / Comite estrategico',
      'Intenciones estrategicas revisadas, actualizadas y aprobadas',
      'Anual',
      (cd.end_date - INTERVAL '45 days')::DATE,
      (cd.end_date - INTERVAL '7 days')::DATE,
      cd.id, cd.name, cd.type,
      CASE
        WHEN (cd.end_date - INTERVAL '45 days')::DATE > CURRENT_DATE THEN 'UPCOMING'
        WHEN EXISTS (
          SELECT 1 FROM strategic_intents si
          WHERE si.organization_id = p_org_id AND si.deleted_at IS NULL
            AND si.updated_at > (cd.end_date - INTERVAL '90 days')::TIMESTAMPTZ
        )                                                              THEN 'COMPLETED'
        WHEN (cd.end_date - INTERVAL '7 days')::DATE < CURRENT_DATE  THEN 'OVERDUE'
        ELSE 'IN_PROGRESS'
      END,
      0,
      FALSE
    FROM cycle_data cd WHERE cd.type IN ('ANNUAL', 'CUSTOM')

    UNION ALL

    SELECT
      'ANNUAL_PLAN_' || cd.id::TEXT,
      'ANNUAL_PLANNING',
      'Planificacion anual ' || EXTRACT(YEAR FROM cd.start_date)::TEXT,
      'Definir las prioridades estrategicas del anio, diseniar los OKRs de empresa y area.',
      'Direccion + Lideres de area',
      'Plan anual publicado con OKRs de empresa y area alineados',
      'Anual',
      (cd.start_date - INTERVAL '28 days')::DATE,
      (cd.start_date + INTERVAL '14 days')::DATE,
      cd.id, cd.name, cd.type,
      CASE
        WHEN (cd.start_date - INTERVAL '28 days')::DATE > CURRENT_DATE THEN 'UPCOMING'
        WHEN cd.obj_count > 0                                           THEN 'COMPLETED'
        WHEN (cd.start_date + INTERVAL '14 days')::DATE < CURRENT_DATE THEN 'OVERDUE'
        ELSE 'IN_PROGRESS'
      END,
      LEAST(100, cd.obj_count * 10),
      FALSE
    FROM cycle_data cd WHERE cd.type IN ('ANNUAL', 'CUSTOM')

    UNION ALL

    SELECT
      'CUSTOM_' || ga.id::TEXT,
      ga.event_type,
      ga.title,
      COALESCE(ga.description, ''),
      COALESCE(ga.responsible, 'Sin asignar'),
      COALESCE(ga.deliverable, 'Sin especificar'),
      COALESCE(ga.frequency, 'Unica vez'),
      ga.scheduled_date,
      COALESCE(ga.due_date, (ga.scheduled_date + INTERVAL '1 day')::DATE),
      ga.cycle_id,
      COALESCE(c.name, 'Sin ciclo'),
      COALESCE(c.type, 'CUSTOM'),
      ga.status,
      0,
      TRUE
    FROM governance_activities ga
    LEFT JOIN cycles c ON ga.cycle_id = c.id
    WHERE ga.organization_id = p_org_id
      AND ga.deleted_at IS NULL
      AND ga.scheduled_date >= CASE p_horizon
            WHEN 'QUARTERLY' THEN CURRENT_DATE - INTERVAL '4 months'
            WHEN 'ANNUAL'    THEN CURRENT_DATE - INTERVAL '15 months'
            ELSE                  CURRENT_DATE - INTERVAL '4 years'
          END
      AND ga.scheduled_date <= CASE p_horizon
            WHEN 'QUARTERLY' THEN CURRENT_DATE + INTERVAL '4 months'
            WHEN 'ANNUAL'    THEN CURRENT_DATE + INTERVAL '15 months'
            ELSE                  CURRENT_DATE + INTERVAL '4 years'
          END
  )
  SELECT
    ae.event_id,
    ae.event_type,
    ae.title,
    ae.description,
    ae.responsible,
    ae.deliverable,
    ae.frequency,
    ae.scheduled_date,
    ae.due_date,
    ae.cycle_id,
    ae.cycle_name,
    ae.cycle_type,
    ae.status,
    ae.completion_pct,
    ae.due_date < CURRENT_DATE AND ae.status NOT IN ('COMPLETED') AS is_overdue,
    ae.is_custom
  FROM all_events ae
  ORDER BY ae.scheduled_date, ae.event_type;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_update_updated_at() TO okr_user;
GRANT EXECUTE ON FUNCTION fn_governance_calendar(UUID, TEXT) TO okr_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON governance_activities TO okr_user;
