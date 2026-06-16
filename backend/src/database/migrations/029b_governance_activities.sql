-- ================================================================
-- Migración 029 — Actividades personalizadas de gobernanza
-- Permite crear actividades de gobierno ad-hoc además de las
-- generadas automáticamente por fn_governance_calendar.
-- ================================================================

CREATE TABLE IF NOT EXISTS governance_activities (
  id              UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title           TEXT         NOT NULL,
  description     TEXT,
  event_type      TEXT         NOT NULL DEFAULT 'CUSTOM',
  responsible     TEXT,
  deliverable     TEXT,
  frequency       TEXT         DEFAULT 'Única vez',
  scheduled_date  DATE         NOT NULL,
  due_date        DATE,
  status          TEXT         NOT NULL DEFAULT 'UPCOMING'
                  CHECK (status IN ('UPCOMING', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE')),
  cycle_id        UUID         REFERENCES cycles(id) ON DELETE SET NULL,
  created_by      UUID         REFERENCES users(id),
  created_at      TIMESTAMPTZ  DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_governance_activities_org
  ON governance_activities(organization_id, deleted_at);

CREATE INDEX IF NOT EXISTS idx_governance_activities_date
  ON governance_activities(organization_id, scheduled_date)
  WHERE deleted_at IS NULL;

-- ── Trigger updated_at ────────────────────────────────────────
CREATE TRIGGER trg_governance_activities_updated_at
  BEFORE UPDATE ON governance_activities
  FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

-- ── Procedimiento de creación ─────────────────────────────────
CREATE OR REPLACE PROCEDURE sp_create_governance_activity(
  p_org_id        UUID,
  p_user_id       UUID,
  p_title         TEXT,
  p_event_type    TEXT,
  p_responsible   TEXT,
  p_deliverable   TEXT,
  p_description   TEXT,
  p_frequency     TEXT,
  p_scheduled     DATE,
  p_due_date      DATE,
  p_status        TEXT,
  p_cycle_id      UUID,
  OUT p_id        UUID
) LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO governance_activities (
    organization_id, created_by, title, event_type, responsible,
    deliverable, description, frequency, scheduled_date, due_date,
    status, cycle_id
  )
  VALUES (
    p_org_id, p_user_id, p_title,
    COALESCE(p_event_type, 'CUSTOM'),
    p_responsible, p_deliverable, p_description,
    COALESCE(p_frequency, 'Única vez'),
    p_scheduled, p_due_date,
    COALESCE(p_status, 'UPCOMING'),
    p_cycle_id
  )
  RETURNING id INTO p_id;
END;
$$;

-- ── Procedimiento de actualización ────────────────────────────
CREATE OR REPLACE PROCEDURE sp_update_governance_activity(
  p_org_id     UUID,
  p_id         UUID,
  p_title      TEXT,
  p_event_type TEXT,
  p_responsible TEXT,
  p_deliverable TEXT,
  p_description TEXT,
  p_frequency  TEXT,
  p_scheduled  DATE,
  p_due_date   DATE,
  p_status     TEXT
) LANGUAGE plpgsql AS $$
BEGIN
  UPDATE governance_activities SET
    title          = COALESCE(p_title,        title),
    event_type     = COALESCE(p_event_type,   event_type),
    responsible    = COALESCE(p_responsible,  responsible),
    deliverable    = COALESCE(p_deliverable,  deliverable),
    description    = COALESCE(p_description,  description),
    frequency      = COALESCE(p_frequency,    frequency),
    scheduled_date = COALESCE(p_scheduled,    scheduled_date),
    due_date       = COALESCE(p_due_date,     due_date),
    status         = COALESCE(p_status,       status)
  WHERE id = p_id AND organization_id = p_org_id AND deleted_at IS NULL;
END;
$$;

-- ── Borrado lógico ────────────────────────────────────────────
CREATE OR REPLACE PROCEDURE sp_delete_governance_activity(
  p_org_id UUID,
  p_id     UUID
) LANGUAGE plpgsql AS $$
BEGIN
  UPDATE governance_activities
    SET deleted_at = NOW()
  WHERE id = p_id AND organization_id = p_org_id AND deleted_at IS NULL;
END;
$$;

-- ── Actualizar fn_governance_calendar para incluir personalizadas ──
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

    SELECT 'KICKOFF_' || cd.id::TEXT, 'KICKOFF',
      'Arranque: ' || cd.name,
      'Publicar y comunicar los OKRs del ciclo a todos los equipos. Confirmar alineación con intenciones estratégicas y asignar responsables.',
      'Líder OKR / Dirección', 'OKRs publicados, comunicados y con responsables asignados',
      CASE cd.type WHEN 'QUARTERLY' THEN 'Trimestral' WHEN 'ANNUAL' THEN 'Anual' ELSE 'Por ciclo' END,
      cd.start_date, (cd.start_date + INTERVAL '7 days')::DATE,
      cd.id, cd.name, cd.type,
      CASE
        WHEN cd.obj_count > 0                                         THEN 'COMPLETED'
        WHEN cd.start_date > CURRENT_DATE + INTERVAL '7 days'        THEN 'UPCOMING'
        WHEN (cd.start_date + INTERVAL '7 days')::DATE < CURRENT_DATE THEN 'OVERDUE'
        ELSE 'IN_PROGRESS'
      END,
      LEAST(100, cd.obj_count * 20), FALSE
    FROM cycle_data cd

    UNION ALL

    SELECT 'CHECKIN_' || cd.id::TEXT, 'CHECK_IN_HEALTH',
      'Cadencia de check-ins: ' || cd.name,
      'Actualizar semanalmente el valor actual y nivel de confianza de cada KR.',
      'Responsables de KR', 'Todos los KRs activos con check-in en los últimos 7 días',
      'Semanal', cd.start_date, cd.end_date, cd.id, cd.name, cd.type,
      CASE
        WHEN cd.obj_count = 0                                   THEN 'UPCOMING'
        WHEN cd.status = 'CLOSED' AND cd.checkin_health_pct >= 60 THEN 'COMPLETED'
        WHEN cd.checkin_health_pct >= 70                        THEN 'COMPLETED'
        WHEN cd.checkin_health_pct >= 35                        THEN 'IN_PROGRESS'
        WHEN cd.end_date < CURRENT_DATE                         THEN 'OVERDUE'
        ELSE 'IN_PROGRESS'
      END,
      cd.checkin_health_pct, FALSE
    FROM cycle_data cd WHERE cd.status IN ('ACTIVE', 'CLOSED')

    UNION ALL

    SELECT 'MID_REVIEW_' || cd.id::TEXT, 'MID_REVIEW',
      'Revisión de medio ciclo: ' || cd.name,
      'Evaluar el progreso a la mitad del ciclo. Identificar KRs en riesgo, ajustar iniciativas e informar a stakeholders.',
      'Líderes de área / Equipo OKR', 'Informe de avance, KRs ajustados y decisiones documentadas',
      CASE cd.type WHEN 'QUARTERLY' THEN 'Trimestral' WHEN 'ANNUAL' THEN 'Semestral' ELSE 'Por ciclo' END,
      (cd.midpoint - INTERVAL '3 days')::DATE, (cd.midpoint + INTERVAL '5 days')::DATE,
      cd.id, cd.name, cd.type,
      CASE
        WHEN (cd.midpoint - INTERVAL '3 days')::DATE > CURRENT_DATE             THEN 'UPCOMING'
        WHEN (cd.midpoint + INTERVAL '5 days')::DATE < CURRENT_DATE
          AND cd.checkin_health_pct > 0                                          THEN 'COMPLETED'
        WHEN (cd.midpoint + INTERVAL '5 days')::DATE < CURRENT_DATE             THEN 'OVERDUE'
        ELSE 'IN_PROGRESS'
      END,
      cd.checkin_health_pct, FALSE
    FROM cycle_data cd

    UNION ALL

    SELECT 'CYCLE_REVIEW_' || cd.id::TEXT, 'CYCLE_REVIEW',
      'Revisión y cierre: ' || cd.name,
      'Evaluar el logro final de cada OKR, documentar el score del ciclo y comunicar resultados.',
      'Todo el equipo', 'Ciclo cerrado, score calculado y resultados comunicados',
      CASE cd.type WHEN 'QUARTERLY' THEN 'Trimestral' WHEN 'ANNUAL' THEN 'Anual' ELSE 'Por ciclo' END,
      (cd.end_date - INTERVAL '7 days')::DATE, (cd.end_date + INTERVAL '7 days')::DATE,
      cd.id, cd.name, cd.type,
      CASE
        WHEN cd.status = 'CLOSED'                                                THEN 'COMPLETED'
        WHEN (cd.end_date - INTERVAL '7 days')::DATE > CURRENT_DATE             THEN 'UPCOMING'
        WHEN (cd.end_date + INTERVAL '7 days')::DATE < CURRENT_DATE
          AND cd.status != 'CLOSED'                                              THEN 'OVERDUE'
        ELSE 'IN_PROGRESS'
      END,
      CASE WHEN cd.status = 'CLOSED' THEN 100 ELSE 0 END, FALSE
    FROM cycle_data cd

    UNION ALL

    SELECT 'RETRO_' || cd.id::TEXT, 'RETROSPECTIVE',
      'Retrospectiva: ' || cd.name,
      'Reflexionar sobre el proceso OKR: ¿qué funcionó?, ¿qué no?, ¿cómo mejorar la ejecución?',
      'Líderes OKR + Equipos', 'Lecciones aprendidas documentadas y plan de mejora',
      CASE cd.type WHEN 'QUARTERLY' THEN 'Trimestral' WHEN 'ANNUAL' THEN 'Anual' ELSE 'Por ciclo' END,
      (cd.end_date + INTERVAL '3 days')::DATE, (cd.end_date + INTERVAL '21 days')::DATE,
      cd.id, cd.name, cd.type,
      CASE
        WHEN (cd.end_date + INTERVAL '3 days')::DATE > CURRENT_DATE  THEN 'UPCOMING'
        WHEN (cd.end_date + INTERVAL '21 days')::DATE < CURRENT_DATE THEN 'COMPLETED'
        ELSE 'IN_PROGRESS'
      END,
      CASE WHEN (cd.end_date + INTERVAL '21 days')::DATE < CURRENT_DATE THEN 100 ELSE 0 END, FALSE
    FROM cycle_data cd
    WHERE cd.status IN ('CLOSED', 'ACTIVE')
      OR (cd.end_date + INTERVAL '21 days')::DATE >= CURRENT_DATE

    UNION ALL

    SELECT 'STRATEGIC_' || cd.id::TEXT, 'STRATEGIC_REVIEW',
      'Revisión estratégica ' || EXTRACT(YEAR FROM cd.end_date)::TEXT,
      'Revisar las intenciones estratégicas de largo plazo y actualizar la dirección organizacional.',
      'Alta dirección / Comité estratégico', 'Intenciones estratégicas revisadas, actualizadas y aprobadas',
      'Anual',
      (cd.end_date - INTERVAL '45 days')::DATE, (cd.end_date - INTERVAL '7 days')::DATE,
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
      0, FALSE
    FROM cycle_data cd WHERE cd.type IN ('ANNUAL', 'CUSTOM')

    UNION ALL

    SELECT 'ANNUAL_PLAN_' || cd.id::TEXT, 'ANNUAL_PLANNING',
      'Planificación anual ' || EXTRACT(YEAR FROM cd.start_date)::TEXT,
      'Definir las prioridades estratégicas del año, diseñar los OKRs de empresa y área.',
      'Dirección + Líderes de área', 'Plan anual publicado con OKRs de empresa y área alineados',
      'Anual',
      (cd.start_date - INTERVAL '28 days')::DATE, (cd.start_date + INTERVAL '14 days')::DATE,
      cd.id, cd.name, cd.type,
      CASE
        WHEN (cd.start_date - INTERVAL '28 days')::DATE > CURRENT_DATE THEN 'UPCOMING'
        WHEN cd.obj_count > 0                                           THEN 'COMPLETED'
        WHEN (cd.start_date + INTERVAL '14 days')::DATE < CURRENT_DATE THEN 'OVERDUE'
        ELSE 'IN_PROGRESS'
      END,
      LEAST(100, cd.obj_count * 10), FALSE
    FROM cycle_data cd WHERE cd.type IN ('ANNUAL', 'CUSTOM')

    UNION ALL

    -- ── Actividades personalizadas ──────────────────────────────
    SELECT
      'CUSTOM_' || ga.id::TEXT,
      ga.event_type,
      ga.title,
      COALESCE(ga.description, ''),
      COALESCE(ga.responsible, 'Sin asignar'),
      COALESCE(ga.deliverable, 'Sin especificar'),
      COALESCE(ga.frequency, 'Única vez'),
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
    ae.event_id, ae.event_type, ae.title, ae.description,
    ae.responsible, ae.deliverable, ae.frequency,
    ae.scheduled_date, ae.due_date,
    ae.cycle_id, ae.cycle_name, ae.cycle_type,
    ae.status,
    ae.completion_pct,
    ae.due_date < CURRENT_DATE AND ae.status NOT IN ('COMPLETED') AS is_overdue,
    ae.is_custom
  FROM all_events ae
  ORDER BY ae.scheduled_date, ae.event_type;
END;
$$;
