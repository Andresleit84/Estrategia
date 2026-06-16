-- Migration 048: Transformation Program
-- Programa de Transformación Multi-año que agrupa múltiples ciclos OKR

CREATE TABLE IF NOT EXISTS transformation_programs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by       UUID NOT NULL REFERENCES users(id),
  title            TEXT NOT NULL,
  description      TEXT,
  start_year       INTEGER NOT NULL,
  end_year         INTEGER NOT NULL,
  status           TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'COMPLETED', 'PAUSED')),
  vision_statement TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS program_cycles (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id        UUID NOT NULL REFERENCES transformation_programs(id) ON DELETE CASCADE,
  cycle_id          UUID NOT NULL REFERENCES cycles(id),
  year_label        TEXT NOT NULL,
  year_number       INTEGER NOT NULL,
  focus_areas       TEXT[],
  expected_outcomes TEXT,
  UNIQUE(program_id, cycle_id)
);

CREATE INDEX IF NOT EXISTS idx_programs_org         ON transformation_programs(organization_id);
CREATE INDEX IF NOT EXISTS idx_program_cycles_program ON program_cycles(program_id);
CREATE INDEX IF NOT EXISTS idx_program_cycles_cycle   ON program_cycles(cycle_id);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION fn_set_program_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_program_updated_at ON transformation_programs;
CREATE TRIGGER trg_program_updated_at
  BEFORE UPDATE ON transformation_programs
  FOR EACH ROW EXECUTE FUNCTION fn_set_program_updated_at();

-- Vista v_transformation_programs
CREATE OR REPLACE VIEW v_transformation_programs AS
SELECT
  tp.id,
  tp.organization_id,
  tp.title,
  tp.description,
  tp.start_year,
  tp.end_year,
  tp.status,
  tp.vision_statement,
  tp.created_by,
  tp.created_at,
  tp.updated_at,
  COUNT(DISTINCT pc.id)::INTEGER AS cycles_count,
  COALESCE(
    ROUND(AVG(
      CASE
        WHEN c.status IN ('ACTIVE', 'CLOSED') THEN
          (SELECT AVG(fn_calculate_objective_progress(o.id))
           FROM objectives o
           WHERE o.cycle_id = c.id AND o.deleted_at IS NULL)
        ELSE NULL
      END
    )::NUMERIC, 1),
    0
  ) AS overall_progress,
  COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'cycle_id',     pc.cycle_id,
        'year_label',   pc.year_label,
        'year_number',  pc.year_number,
        'cycle_name',   c.name,
        'cycle_status', c.status,
        'avg_progress', COALESCE(
          ROUND((
            SELECT AVG(fn_calculate_objective_progress(o.id))
            FROM objectives o
            WHERE o.cycle_id = c.id AND o.deleted_at IS NULL
          )::NUMERIC, 1), 0),
        'focus_areas',  pc.focus_areas
      )
      ORDER BY pc.year_number
    ) FILTER (WHERE pc.id IS NOT NULL),
    '[]'::JSONB
  ) AS cycles
FROM transformation_programs tp
LEFT JOIN program_cycles pc ON pc.program_id = tp.id
LEFT JOIN cycles c ON c.id = pc.cycle_id
GROUP BY tp.id;

-- Vista v_program_detail
CREATE OR REPLACE VIEW v_program_detail AS
SELECT
  tp.id,
  tp.organization_id,
  tp.title,
  tp.description,
  tp.start_year,
  tp.end_year,
  tp.status,
  tp.vision_statement,
  tp.created_at,
  tp.updated_at,
  pc.id              AS pc_id,
  pc.cycle_id,
  pc.year_label,
  pc.year_number,
  pc.focus_areas,
  pc.expected_outcomes,
  c.name             AS cycle_name,
  c.status           AS cycle_status,
  c.start_date       AS cycle_start_date,
  c.end_date         AS cycle_end_date
FROM transformation_programs tp
LEFT JOIN program_cycles pc ON pc.program_id = tp.id
LEFT JOIN cycles c ON c.id = pc.cycle_id;

-- Procedimiento sp_create_program
CREATE OR REPLACE PROCEDURE sp_create_program(
  p_org_id          UUID,
  p_user_id         UUID,
  p_title           TEXT,
  p_description     TEXT,
  p_start_year      INTEGER,
  p_end_year        INTEGER,
  p_vision          TEXT,
  INOUT p_id        UUID
)
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO transformation_programs (organization_id, created_by, title, description, start_year, end_year, vision_statement)
  VALUES (p_org_id, p_user_id, p_title, p_description, p_start_year, p_end_year, p_vision)
  RETURNING id INTO p_id;
END;
$$;

-- Procedimiento sp_add_program_cycle
CREATE OR REPLACE PROCEDURE sp_add_program_cycle(
  p_program_id      UUID,
  p_cycle_id        UUID,
  p_year_label      TEXT,
  p_year_number     INTEGER,
  p_focus_areas     TEXT[],
  p_expected_outcomes TEXT
)
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO program_cycles (program_id, cycle_id, year_label, year_number, focus_areas, expected_outcomes)
  VALUES (p_program_id, p_cycle_id, p_year_label, p_year_number, p_focus_areas, p_expected_outcomes)
  ON CONFLICT (program_id, cycle_id) DO UPDATE
    SET year_label        = EXCLUDED.year_label,
        year_number       = EXCLUDED.year_number,
        focus_areas       = EXCLUDED.focus_areas,
        expected_outcomes = EXCLUDED.expected_outcomes;
END;
$$;

-- Procedimiento sp_remove_program_cycle
CREATE OR REPLACE PROCEDURE sp_remove_program_cycle(
  p_program_id UUID,
  p_cycle_id   UUID
)
LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM program_cycles
  WHERE program_id = p_program_id AND cycle_id = p_cycle_id;
END;
$$;

GRANT SELECT, INSERT, UPDATE, DELETE ON transformation_programs TO okr_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON program_cycles TO okr_user;
GRANT SELECT ON v_transformation_programs TO okr_user;
GRANT SELECT ON v_program_detail TO okr_user;
GRANT EXECUTE ON PROCEDURE sp_create_program(UUID, UUID, TEXT, TEXT, INTEGER, INTEGER, TEXT, UUID) TO okr_user;
GRANT EXECUTE ON PROCEDURE sp_add_program_cycle(UUID, UUID, TEXT, INTEGER, TEXT[], TEXT) TO okr_user;
GRANT EXECUTE ON PROCEDURE sp_remove_program_cycle(UUID, UUID) TO okr_user;
