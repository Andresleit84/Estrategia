-- ================================================================
-- Migration 040: Org Parameters
-- Adds configurable parameters per organization
-- ================================================================

-- ----------------------------------------------------------------
-- 1. Add parameters column
-- ----------------------------------------------------------------
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS parameters JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Initialize all existing orgs with default parameters
UPDATE organizations
   SET parameters = '{
     "max_objectives_per_level": 5,
     "max_krs_per_objective":    5,
     "auto_complete_threshold":  70,
     "confidence_at_risk":       0.40,
     "confidence_on_track":      0.70,
     "progress_behind_threshold": 30,
     "stale_checkin_days":       14,
     "unstarted_kr_days":        7,
     "story_points_scale":       [1, 2, 3, 5, 8, 13, 21],
     "max_sprints_per_year":     52
   }'::jsonb
 WHERE parameters = '{}'::jsonb;

-- ----------------------------------------------------------------
-- 2. Helper: get a numeric parameter with fallback default
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_get_org_param(
  p_org_id  UUID,
  p_key     TEXT,
  p_default NUMERIC
) RETURNS NUMERIC LANGUAGE sql STABLE AS $$
  SELECT COALESCE((parameters ->> p_key)::numeric, p_default)
    FROM organizations WHERE id = p_org_id;
$$;

-- ----------------------------------------------------------------
-- 3. SP to patch parameters (merge, not replace)
-- ----------------------------------------------------------------
CREATE OR REPLACE PROCEDURE sp_update_org_parameters(
  p_org_id UUID,
  p_params  JSONB
)
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE organizations
     SET parameters = parameters || p_params,
         updated_at = NOW()
   WHERE id = p_org_id;
END;
$$;

-- ----------------------------------------------------------------
-- 4. Update fn_validate_objective_limits to use org parameter
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_validate_objective_limits()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_count INT;
  v_max   INT;
BEGIN
  v_max := fn_get_org_param(NEW.organization_id, 'max_objectives_per_level', 5)::int;

  SELECT COUNT(*) INTO v_count
    FROM objectives
   WHERE organization_id = NEW.organization_id
     AND cycle_id        = NEW.cycle_id
     AND level           = NEW.level
     AND deleted_at IS NULL
     AND status NOT IN ('CANCELLED');

  IF v_count >= v_max THEN
    RAISE EXCEPTION 'Se alcanzó el límite de % objetivos por nivel (%) en este ciclo.', v_max, NEW.level
      USING ERRCODE = 'P0006';
  END IF;
  RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------
-- 5. Update fn_validate_kr_limits to use org parameter
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_validate_kr_limits()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_count  INT;
  v_max    INT;
  v_org_id UUID;
BEGIN
  SELECT o.organization_id INTO v_org_id
    FROM objectives o WHERE o.id = NEW.objective_id;

  v_max := fn_get_org_param(v_org_id, 'max_krs_per_objective', 5)::int;

  SELECT COUNT(*) INTO v_count
    FROM key_results
   WHERE objective_id = NEW.objective_id
     AND deleted_at IS NULL
     AND status NOT IN ('CANCELLED');

  IF v_count >= v_max THEN
    RAISE EXCEPTION 'Se alcanzó el límite de % resultados clave por objetivo.', v_max
      USING ERRCODE = 'P0007';
  END IF;
  RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------
-- 6. View: expose parameters in v_org_parameters
-- ----------------------------------------------------------------
CREATE OR REPLACE VIEW v_org_parameters AS
SELECT
  id                                                          AS organization_id,
  COALESCE((parameters->>'max_objectives_per_level')::int,  5)    AS max_objectives_per_level,
  COALESCE((parameters->>'max_krs_per_objective')::int,     5)    AS max_krs_per_objective,
  COALESCE((parameters->>'auto_complete_threshold')::int,  70)    AS auto_complete_threshold,
  COALESCE((parameters->>'confidence_at_risk')::numeric,   0.40)  AS confidence_at_risk,
  COALESCE((parameters->>'confidence_on_track')::numeric,  0.70)  AS confidence_on_track,
  COALESCE((parameters->>'progress_behind_threshold')::int, 30)   AS progress_behind_threshold,
  COALESCE((parameters->>'stale_checkin_days')::int,       14)    AS stale_checkin_days,
  COALESCE((parameters->>'unstarted_kr_days')::int,         7)    AS unstarted_kr_days,
  COALESCE(parameters->'story_points_scale',               '[1,2,3,5,8,13,21]'::jsonb) AS story_points_scale,
  COALESCE((parameters->>'max_sprints_per_year')::int,     52)    AS max_sprints_per_year,
  parameters                                                       AS raw
FROM organizations
WHERE deleted_at IS NULL;
