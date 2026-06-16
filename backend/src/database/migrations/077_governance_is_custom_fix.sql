DROP FUNCTION IF EXISTS fn_governance_calendar(uuid, text);

CREATE FUNCTION public.fn_governance_calendar(p_org_id uuid, p_horizon text DEFAULT 'ANNUAL')
RETURNS TABLE(
  event_id text, event_type text, title text, description text,
  responsible text, deliverable text, frequency text,
  scheduled_date date, due_date date, cycle_id uuid,
  cycle_name text, cycle_type text, status text,
  completion_pct integer, is_overdue boolean, is_custom boolean
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
  RETURN QUERY
  WITH cycle_data AS (
    SELECT
      c.id, c.name, c.type, c.status, c.start_date, c.end_date,
      (c.start_date + (c.end_date - c.start_date) / 2)::DATE AS midpoint,
      (SELECT COUNT(*) FROM objectives o WHERE o.cycle_id = c.id AND o.deleted_at IS NULL)::INTEGER AS obj_count,
      COALESCE((
        SELECT CAST(100.0 * COUNT(*) FILTER (
          WHERE kr.last_checkin_at IS NOT NULL AND kr.last_checkin_at > NOW() - INTERVAL '14 days'
        ) / NULLIF(COUNT(*), 0) AS INTEGER)
        FROM key_results kr JOIN objectives o ON kr.objective_id = o.id
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
  all_events(ev_id, ev_type, ev_title, ev_description, ev_responsible, ev_deliverable,
             ev_frequency, ev_scheduled, ev_due, ev_cycle_id, ev_cycle_name, ev_cycle_type,
             ev_status, ev_completion_pct, ev_is_custom) AS (

    -- 1. KICKOFF
    SELECT
      'KICKOFF_' || cd.id::TEXT,
      'KICKOFF',
      'Arranque: ' || cd.name,
      'Publicar y comunicar los OKRs del ciclo a todos los equipos.',
      'Lider OKR / Direccion',
      'OKRs publicados, comunicados y con responsables asignados',
      CASE cd.type WHEN 'QUARTERLY' THEN 'Trimestral' WHEN 'ANNUAL' THEN 'Anual' ELSE 'Por ciclo' END,
      cd.start_date,
      (cd.start_date + INTERVAL '7 days')::DATE,
      cd.id, cd.name, cd.type,
      CASE
        WHEN cd.obj_count > 0                                          THEN 'COMPLETED'
        WHEN cd.start_date > CURRENT_DATE + INTERVAL '7 days'         THEN 'UPCOMING'
        WHEN (cd.start_date + INTERVAL '7 days')::DATE < CURRENT_DATE  THEN 'OVERDUE'
        ELSE 'IN_PROGRESS'
      END,
      LEAST(100, cd.obj_count * 20),
      FALSE
    FROM cycle_data cd

    UNION ALL

    -- 2. CHECK-IN HEALTH
    SELECT
      'CHECKIN_' || cd.id::TEXT,
      'CHECK_IN_HEALTH',
      'Cadencia de check-ins: ' || cd.name,
      'Actualizar semanalmente el valor actual y nivel de confianza de cada KR.',
      'Responsables de KR',
      'Todos los KRs activos con check-in en los ultimos 7 dias',
      'Semanal',
      cd.start_date, cd.end_date,
      cd.id, cd.name, cd.type,
      CASE
        WHEN cd.obj_count = 0                                      THEN 'UPCOMING'
        WHEN cd.status = 'CLOSED' AND cd.checkin_health_pct >= 60  THEN 'COMPLETED'
        WHEN cd.checkin_health_pct >= 70                           THEN 'COMPLETED'
        WHEN cd.checkin_health_pct >= 35                           THEN 'IN_PROGRESS'
        WHEN cd.end_date < CURRENT_DATE                            THEN 'OVERDUE'
        ELSE 'IN_PROGRESS'
      END,
      cd.checkin_health_pct,
      FALSE
    FROM cycle_data cd WHERE cd.status IN ('ACTIVE', 'CLOSED')

    UNION ALL

    -- 3. MID REVIEW
    SELECT
      'MID_REVIEW_' || cd.id::TEXT,
      'MID_REVIEW',
      'Revision de medio ciclo: ' || cd.name,
      'Evaluar el progreso a la mitad del ciclo. Identificar KRs en riesgo.',
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

    -- 4. CYCLE REVIEW
    SELECT
      'CYCLE_REVIEW_' || cd.id::TEXT,
      'CYCLE_REVIEW',
      'Revision y cierre: ' || cd.name,
      'Evaluar el logro final de cada OKR, documentar el score del ciclo.',
      'Todo el equipo',
      'Ciclo cerrado, score calculado y resultados comunicados',
      CASE cd.type WHEN 'QUARTERLY' THEN 'Trimestral' WHEN 'ANNUAL' THEN 'Anual' ELSE 'Por ciclo' END,
      (cd.end_date - INTERVAL '7 days')::DATE,
      (cd.end_date + INTERVAL '7 days')::DATE,
      cd.id, cd.name, cd.type,
      CASE
        WHEN cd.status = 'CLOSED'                                     THEN 'COMPLETED'
        WHEN (cd.end_date - INTERVAL '7 days')::DATE > CURRENT_DATE   THEN 'UPCOMING'
        WHEN (cd.end_date + INTERVAL '7 days')::DATE < CURRENT_DATE
          AND cd.status != 'CLOSED'                                   THEN 'OVERDUE'
        ELSE 'IN_PROGRESS'
      END,
      CASE WHEN cd.status = 'CLOSED' THEN 100 ELSE 0 END,
      FALSE
    FROM cycle_data cd

    UNION ALL

    -- 5. RETROSPECTIVE
    SELECT
      'RETRO_' || cd.id::TEXT,
      'RETROSPECTIVE',
      'Retrospectiva: ' || cd.name,
      'Reflexionar sobre el proceso OKR: que funciono, que no, como mejorar.',
      'Lideres OKR + Equipos',
      'Lecciones aprendidas documentadas y plan de mejora',
      CASE cd.type WHEN 'QUARTERLY' THEN 'Trimestral' WHEN 'ANNUAL' THEN 'Anual' ELSE 'Por ciclo' END,
      (cd.end_date + INTERVAL '3 days')::DATE,
      (cd.end_date + INTERVAL '21 days')::DATE,
      cd.id, cd.name, cd.type,
      CASE
        WHEN (cd.end_date + INTERVAL '3 days')::DATE > CURRENT_DATE   THEN 'UPCOMING'
        WHEN (cd.end_date + INTERVAL '21 days')::DATE < CURRENT_DATE  THEN 'COMPLETED'
        ELSE 'IN_PROGRESS'
      END,
      CASE WHEN (cd.end_date + INTERVAL '21 days')::DATE < CURRENT_DATE THEN 100 ELSE 0 END,
      FALSE
    FROM cycle_data cd
    WHERE cd.status IN ('CLOSED', 'ACTIVE') OR (cd.end_date + INTERVAL '21 days')::DATE >= CURRENT_DATE

    UNION ALL

    -- 6. STRATEGIC REVIEW (annual/custom only)
    SELECT
      'STRATEGIC_' || cd.id::TEXT,
      'STRATEGIC_REVIEW',
      'Revision estrategica ' || EXTRACT(YEAR FROM cd.end_date)::TEXT,
      'Revisar las intenciones estrategicas de largo plazo.',
      'Alta direccion / Comite estrategico',
      'Intenciones estrategicas revisadas y aprobadas',
      'Anual',
      (cd.end_date - INTERVAL '45 days')::DATE,
      (cd.end_date - INTERVAL '7 days')::DATE,
      cd.id, cd.name, cd.type,
      CASE
        WHEN (cd.end_date - INTERVAL '45 days')::DATE > CURRENT_DATE  THEN 'UPCOMING'
        WHEN EXISTS (
          SELECT 1 FROM strategic_intents si
          WHERE si.organization_id = p_org_id AND si.deleted_at IS NULL
            AND si.updated_at > (cd.end_date - INTERVAL '90 days')::TIMESTAMPTZ
        )                                                              THEN 'COMPLETED'
        WHEN (cd.end_date - INTERVAL '7 days')::DATE < CURRENT_DATE   THEN 'OVERDUE'
        ELSE 'IN_PROGRESS'
      END,
      0,
      FALSE
    FROM cycle_data cd WHERE cd.type IN ('ANNUAL', 'CUSTOM')

    UNION ALL

    -- 7. ANNUAL PLANNING (annual/custom only)
    SELECT
      'ANNUAL_PLAN_' || cd.id::TEXT,
      'ANNUAL_PLANNING',
      'Planificacion anual ' || EXTRACT(YEAR FROM cd.start_date)::TEXT,
      'Definir las prioridades estrategicas del anio, disenar los OKRs.',
      'Direccion + Lideres de area',
      'Plan anual publicado con OKRs alineados',
      'Anual',
      (cd.start_date - INTERVAL '28 days')::DATE,
      (cd.start_date + INTERVAL '14 days')::DATE,
      cd.id, cd.name, cd.type,
      CASE
        WHEN (cd.start_date - INTERVAL '28 days')::DATE > CURRENT_DATE  THEN 'UPCOMING'
        WHEN cd.obj_count > 0                                            THEN 'COMPLETED'
        WHEN (cd.start_date + INTERVAL '14 days')::DATE < CURRENT_DATE  THEN 'OVERDUE'
        ELSE 'IN_PROGRESS'
      END,
      LEAST(100, cd.obj_count * 10),
      FALSE
    FROM cycle_data cd WHERE cd.type IN ('ANNUAL', 'CUSTOM')

    UNION ALL

    -- 8. CUSTOM ACTIVITIES from governance_activities table
    SELECT
      'CUSTOM_' || ga.id::TEXT,
      ga.event_type,
      ga.title,
      COALESCE(ga.description, ''),
      COALESCE(ga.responsible, ''),
      COALESCE(ga.deliverable, ''),
      COALESCE(ga.frequency, 'Unica vez'),
      ga.scheduled_date,
      COALESCE(ga.due_date, ga.scheduled_date),
      ga.cycle_id,
      COALESCE(c.name, ''),
      COALESCE(c.type, ''),
      ga.status::TEXT,
      0,
      TRUE
    FROM governance_activities ga
    LEFT JOIN cycles c ON c.id = ga.cycle_id AND c.deleted_at IS NULL
    WHERE ga.organization_id = p_org_id AND ga.deleted_at IS NULL

  )
  SELECT
    ae.ev_id,
    ae.ev_type,
    ae.ev_title,
    ae.ev_description,
    ae.ev_responsible,
    ae.ev_deliverable,
    ae.ev_frequency,
    ae.ev_scheduled,
    ae.ev_due,
    ae.ev_cycle_id,
    ae.ev_cycle_name,
    ae.ev_cycle_type,
    ae.ev_status,
    ae.ev_completion_pct,
    ae.ev_due < CURRENT_DATE AND ae.ev_status NOT IN ('COMPLETED') AS is_overdue,
    ae.ev_is_custom
  FROM all_events ae
  ORDER BY ae.ev_scheduled, ae.ev_type;
END;
$$;
