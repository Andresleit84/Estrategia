-- ================================================================
-- Migración 003 — Hito 3: Ciclos OKR
-- REGLA: Toda la lógica de negocio reside en la base de datos.
-- Node.js solo transporta datos — nunca los transforma.
-- ================================================================

-- ----------------------------------------------------------------
-- TABLA: cycles
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cycles (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  type            TEXT NOT NULL DEFAULT 'ANNUAL'
                    CHECK (type IN ('QUARTERLY', 'ANNUAL', 'CUSTOM')),
  status          TEXT NOT NULL DEFAULT 'DRAFT'
                    CHECK (status IN ('DRAFT', 'ACTIVE', 'CLOSED')),
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  closed_at       TIMESTAMPTZ,
  snapshot        JSONB,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ,
  CONSTRAINT cycles_dates_check CHECK (end_date > start_date)
);

CREATE OR REPLACE TRIGGER trg_cycles_updated_at
  BEFORE UPDATE ON cycles
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ----------------------------------------------------------------
-- TRIGGER: solo un ciclo ACTIVE por tipo por organización
-- (strategic + annual + quarterly pueden estar ACTIVE simultáneamente)
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_validate_single_active_cycle()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'ACTIVE' AND EXISTS (
    SELECT 1 FROM cycles
    WHERE organization_id = NEW.organization_id
      AND type            = NEW.type
      AND status          = 'ACTIVE'
      AND id             <> NEW.id
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Ya existe un ciclo % activo para esta organización. Cierra el ciclo actual antes de activar uno nuevo.', NEW.type
      USING ERRCODE = 'P0004';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_validate_single_active_cycle
  BEFORE INSERT OR UPDATE ON cycles
  FOR EACH ROW EXECUTE FUNCTION fn_validate_single_active_cycle();

-- ----------------------------------------------------------------
-- TRIGGER: audit_log en cycles
-- ----------------------------------------------------------------
CREATE OR REPLACE TRIGGER trg_audit_log_cycles
  AFTER INSERT OR UPDATE OR DELETE ON cycles
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

-- ----------------------------------------------------------------
-- FUNCIÓN: score ponderado del ciclo
-- Se completa con lógica real en Hito 4 cuando existan objectives/key_results
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_get_cycle_score(p_cycle_id UUID)
RETURNS NUMERIC LANGUAGE plpgsql STABLE AS $$
BEGIN
  -- Hito 4+: weighted average of COMPANY-level objectives' progress
  RETURN 0.0;
END;
$$;

-- ----------------------------------------------------------------
-- VISTA: ciclos con estadísticas
-- Los contadores de OKRs se llenará en Hito 4
-- ----------------------------------------------------------------
CREATE OR REPLACE VIEW v_cycles_with_stats AS
SELECT
  c.id,
  c.organization_id,
  c.name,
  c.description,
  c.type,
  c.status,
  c.start_date,
  c.end_date,
  c.closed_at,
  c.snapshot,
  c.created_by,
  c.created_at,
  c.updated_at,
  0                                       AS objectives_count,
  0.0::NUMERIC                            AS avg_progress,
  fn_get_cycle_score(c.id)               AS score,
  GREATEST(
    EXTRACT(DAY FROM (c.end_date::TIMESTAMPTZ - NOW()))::INT,
    0
  )                                       AS days_remaining,
  CASE
    WHEN c.status = 'CLOSED'                          THEN 'CLOSED'
    WHEN c.status = 'ACTIVE' AND c.end_date < CURRENT_DATE THEN 'OVERDUE'
    WHEN c.status = 'ACTIVE'                          THEN 'ACTIVE'
    ELSE 'DRAFT'
  END                                     AS display_status
FROM cycles c
WHERE c.deleted_at IS NULL;

-- ----------------------------------------------------------------
-- PROCEDIMIENTO: activar ciclo (DRAFT → ACTIVE)
-- ----------------------------------------------------------------
CREATE OR REPLACE PROCEDURE sp_activate_cycle(
  p_cycle_id UUID,
  p_user_id  UUID
)
LANGUAGE plpgsql AS $$
DECLARE
  v_status TEXT;
BEGIN
  SELECT status INTO v_status FROM cycles WHERE id = p_cycle_id AND deleted_at IS NULL;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Ciclo no encontrado' USING ERRCODE = 'P0002';
  END IF;

  IF v_status <> 'DRAFT' THEN
    RAISE EXCEPTION 'Solo se puede activar un ciclo en estado DRAFT'
      USING ERRCODE = 'P0003';
  END IF;

  -- El trigger trg_validate_single_active_cycle bloquea si ya hay uno activo
  UPDATE cycles
     SET status     = 'ACTIVE',
         updated_at = NOW()
   WHERE id = p_cycle_id;
END;
$$;

-- ----------------------------------------------------------------
-- PROCEDIMIENTO: cerrar ciclo (ACTIVE → CLOSED)
-- Genera snapshot del estado final. En Hito 4+ cierra OKRs en cascada.
-- ----------------------------------------------------------------
CREATE OR REPLACE PROCEDURE sp_close_cycle(
  p_cycle_id UUID,
  p_user_id  UUID
)
LANGUAGE plpgsql AS $$
DECLARE
  v_status   TEXT;
  v_snapshot JSONB;
BEGIN
  SELECT status INTO v_status FROM cycles WHERE id = p_cycle_id AND deleted_at IS NULL;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Ciclo no encontrado' USING ERRCODE = 'P0002';
  END IF;

  IF v_status <> 'ACTIVE' THEN
    RAISE EXCEPTION 'Solo se puede cerrar un ciclo ACTIVE'
      USING ERRCODE = 'P0003';
  END IF;

  -- Snapshot del estado final
  v_snapshot := jsonb_build_object(
    'closed_at',   NOW(),
    'closed_by',   p_user_id,
    'score',       fn_get_cycle_score(p_cycle_id)
  );

  UPDATE cycles
     SET status     = 'CLOSED',
         closed_at  = NOW(),
         snapshot   = v_snapshot,
         updated_at = NOW()
   WHERE id = p_cycle_id;

  -- Hito 4+: CASCADE close active objectives, key_results, sprints
END;
$$;

-- ----------------------------------------------------------------
-- PROCEDIMIENTO: crear ciclo
-- ----------------------------------------------------------------
CREATE OR REPLACE PROCEDURE sp_create_cycle(
  p_org_id      UUID,
  p_name        TEXT,
  p_description TEXT,
  p_type        TEXT,
  p_start_date  DATE,
  p_end_date    DATE,
  p_created_by  UUID,
  OUT p_cycle_id UUID
)
LANGUAGE plpgsql AS $$
BEGIN
  IF p_end_date <= p_start_date THEN
    RAISE EXCEPTION 'La fecha de fin debe ser posterior a la fecha de inicio'
      USING ERRCODE = 'P0005';
  END IF;

  INSERT INTO cycles (organization_id, name, description, type, start_date, end_date, created_by)
  VALUES (p_org_id, p_name, p_description, COALESCE(p_type, 'ANNUAL'), p_start_date, p_end_date, p_created_by)
  RETURNING id INTO p_cycle_id;
END;
$$;

-- ----------------------------------------------------------------
-- PROCEDIMIENTO: actualizar ciclo (solo en DRAFT)
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_update_cycle(
  p_cycle_id    UUID,
  p_name        TEXT,
  p_description TEXT,
  p_type        TEXT,
  p_start_date  DATE,
  p_end_date    DATE
)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  v_status TEXT;
BEGIN
  SELECT status INTO v_status FROM cycles WHERE id = p_cycle_id AND deleted_at IS NULL;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Ciclo no encontrado' USING ERRCODE = 'P0002';
  END IF;

  IF v_status <> 'DRAFT' THEN
    RAISE EXCEPTION 'Solo se pueden editar ciclos en estado DRAFT'
      USING ERRCODE = 'P0003';
  END IF;

  IF p_end_date IS NOT NULL AND p_start_date IS NOT NULL AND p_end_date <= p_start_date THEN
    RAISE EXCEPTION 'La fecha de fin debe ser posterior a la fecha de inicio'
      USING ERRCODE = 'P0005';
  END IF;

  UPDATE cycles
     SET name        = COALESCE(p_name, name),
         description = COALESCE(p_description, description),
         type        = COALESCE(p_type, type),
         start_date  = COALESCE(p_start_date, start_date),
         end_date    = COALESCE(p_end_date, end_date),
         updated_at  = NOW()
   WHERE id = p_cycle_id;
END;
$$;

-- ----------------------------------------------------------------
-- ÍNDICES
-- ----------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_cycles_org_status ON cycles(organization_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cycles_dates      ON cycles(organization_id, start_date, end_date) WHERE deleted_at IS NULL;
