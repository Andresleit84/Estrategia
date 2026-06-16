-- Migration 022: hierarchical OKR progress
-- Parent objectives derive progress from children's progress, not from their own KRs

CREATE OR REPLACE FUNCTION public.fn_calculate_objective_progress(p_obj_id uuid)
  RETURNS numeric
  LANGUAGE plpgsql
  VOLATILE
AS $$
DECLARE
  v_child_avg NUMERIC;
  v_kr_avg    NUMERIC;
BEGIN
  -- Non-leaf: progress = average of active children's current progress
  SELECT AVG(progress)
    INTO v_child_avg
    FROM objectives
   WHERE parent_objective_id = p_obj_id
     AND deleted_at IS NULL
     AND status NOT IN ('CANCELLED');

  IF v_child_avg IS NOT NULL THEN
    RETURN ROUND(v_child_avg, 2);
  END IF;

  -- Leaf: progress = average of own key results
  SELECT AVG(fn_calculate_kr_progress(kr.id))
    INTO v_kr_avg
    FROM key_results kr
   WHERE kr.objective_id = p_obj_id
     AND kr.deleted_at IS NULL
     AND kr.status NOT IN ('CANCELLED');

  RETURN ROUND(COALESCE(v_kr_avg, 0.0), 2);
END;
$$;

-- Bulk recalculate all objectives bottom-up (deepest leaves first, roots last)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    WITH RECURSIVE tree AS (
      SELECT id, 0 AS depth
      FROM objectives
      WHERE parent_objective_id IS NULL
        AND deleted_at IS NULL
        AND status NOT IN ('CANCELLED')
      UNION ALL
      SELECT o.id, t.depth + 1
      FROM objectives o
      JOIN tree t ON o.parent_objective_id = t.id
      WHERE o.deleted_at IS NULL
        AND o.status NOT IN ('CANCELLED')
    )
    SELECT id FROM tree ORDER BY depth DESC
  LOOP
    UPDATE objectives
       SET progress = fn_calculate_objective_progress(r.id)
     WHERE id = r.id;
  END LOOP;
END;
$$;
