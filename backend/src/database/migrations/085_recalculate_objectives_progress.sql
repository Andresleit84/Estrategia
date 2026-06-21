-- Migration 085: Recalculate all objectives progress bottom-up
-- Needed when data is loaded via SQL (bypassing trg_checkin_cascade_recalc)
-- Runs 5 passes to cover up to 5 levels of hierarchy depth (actual max = 3)

DO $$
DECLARE
  pass INT;
BEGIN
  FOR pass IN 1..5 LOOP
    UPDATE objectives o
    SET progress = fn_calculate_objective_progress(o.id),
        updated_at = NOW()
    WHERE o.deleted_at IS NULL
      AND o.status NOT IN ('CANCELLED');
  END LOOP;
END;
$$;
