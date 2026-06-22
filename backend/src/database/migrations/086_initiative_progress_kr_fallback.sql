-- Migration 086: Initiative progress fallback to linked KR progress
-- When no milestones exist, progress = average of linked KR progress

-- Step 1: Centralized helper used by all triggers
CREATE OR REPLACE FUNCTION fn_recalculate_initiative_progress(p_initiative_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  v_total       INT;
  v_completed   INT;
  v_progress    NUMERIC(5,2);
  v_kr_avg      NUMERIC;
  v_new_status  TEXT;
BEGIN
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'COMPLETED')
  INTO v_total, v_completed
  FROM milestones
  WHERE initiative_id = p_initiative_id
    AND status != 'CANCELLED';

  IF v_total > 0 THEN
    v_progress := ROUND((v_completed::NUMERIC / v_total) * 100, 2);
  ELSE
    SELECT AVG(kr.progress)
    INTO v_kr_avg
    FROM initiative_key_results ikr
    JOIN key_results kr ON kr.id = ikr.kr_id AND kr.deleted_at IS NULL
    WHERE ikr.initiative_id = p_initiative_id;

    v_progress := COALESCE(ROUND(v_kr_avg::NUMERIC, 2), 0);
  END IF;

  SELECT status INTO v_new_status FROM initiatives WHERE id = p_initiative_id;

  IF v_total > 0 AND v_completed = v_total THEN
    v_new_status := 'DONE';
  ELSIF v_new_status = 'TODO' AND v_progress > 0 THEN
    v_new_status := 'IN_PROGRESS';
  END IF;

  UPDATE initiatives
  SET
    progress     = v_progress,
    status       = v_new_status,
    completed_at = CASE WHEN v_new_status = 'DONE' AND completed_at IS NULL THEN NOW() ELSE completed_at END,
    updated_at   = NOW()
  WHERE id = p_initiative_id;
END;
$$;

-- Step 2: Refactor milestone trigger to delegate to helper
CREATE OR REPLACE FUNCTION fn_initiative_progress_from_milestones()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  PERFORM fn_recalculate_initiative_progress(COALESCE(NEW.initiative_id, OLD.initiative_id));
  RETURN NEW;
END;
$$;

-- Step 3: Trigger on initiative_key_results (link / unlink a KR)
CREATE OR REPLACE FUNCTION fn_initiative_progress_from_kr_link()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  PERFORM fn_recalculate_initiative_progress(COALESCE(NEW.initiative_id, OLD.initiative_id));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_initiative_progress_kr_link ON initiative_key_results;
CREATE TRIGGER trg_initiative_progress_kr_link
AFTER INSERT OR DELETE ON initiative_key_results
FOR EACH ROW EXECUTE FUNCTION fn_initiative_progress_from_kr_link();

-- Step 4: Trigger on key_results UPDATE — cascade progress changes to linked initiatives
CREATE OR REPLACE FUNCTION fn_initiative_progress_from_kr_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_init_id UUID;
BEGIN
  IF NEW.progress IS DISTINCT FROM OLD.progress THEN
    FOR v_init_id IN
      SELECT initiative_id FROM initiative_key_results WHERE kr_id = NEW.id
    LOOP
      PERFORM fn_recalculate_initiative_progress(v_init_id);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_initiative_progress_kr_update ON key_results;
CREATE TRIGGER trg_initiative_progress_kr_update
AFTER UPDATE ON key_results
FOR EACH ROW EXECUTE FUNCTION fn_initiative_progress_from_kr_update();

-- Step 5: One-off recalculation for all active initiatives
DO $$
DECLARE
  v_id UUID;
BEGIN
  FOR v_id IN
    SELECT id FROM initiatives WHERE deleted_at IS NULL AND status NOT IN ('CANCELLED')
  LOOP
    PERFORM fn_recalculate_initiative_progress(v_id);
  END LOOP;
END;
$$;
