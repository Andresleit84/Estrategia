-- ================================================================
-- 020_fix_traceability.sql
-- strategic_intent_id was hardcoded to NULL::uuid in migrations 004 and 016.
-- Migration 005 added the column to the objectives table but the view was
-- never updated. No dependent views exist so CASCADE is safe.
-- Uses a DO block to handle presence/absence of rolled_from_id across envs.
-- ================================================================

DROP VIEW IF EXISTS v_objectives_with_progress CASCADE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'objectives' AND column_name = 'rolled_from_id'
  ) THEN
    EXECUTE $view$
      CREATE VIEW v_objectives_with_progress AS
      SELECT
        o.id,
        o.organization_id,
        o.cycle_id,
        o.parent_objective_id,
        o.owner_id,
        o.team_id,
        o.strategic_intent_id,
        o.title,
        o.description,
        o.level,
        o.status,
        o.rolled_from_id,
        o.created_by,
        o.created_at,
        o.updated_at,
        fn_calculate_objective_progress(o.id)  AS progress,
        (
          SELECT COUNT(*)::INT
            FROM key_results kr
           WHERE kr.objective_id = o.id
             AND kr.deleted_at IS NULL
             AND kr.status NOT IN ('CANCELLED')
        )                                       AS kr_count,
        u.name  AS owner_name,
        u.email AS owner_email,
        t.name  AS team_name
      FROM objectives o
      LEFT JOIN users u ON u.id = o.owner_id
      LEFT JOIN teams t ON t.id = o.team_id
      WHERE o.deleted_at IS NULL
    $view$;
  ELSE
    EXECUTE $view$
      CREATE VIEW v_objectives_with_progress AS
      SELECT
        o.id,
        o.organization_id,
        o.cycle_id,
        o.parent_objective_id,
        o.owner_id,
        o.team_id,
        o.strategic_intent_id,
        o.title,
        o.description,
        o.level,
        o.status,
        o.created_by,
        o.created_at,
        o.updated_at,
        fn_calculate_objective_progress(o.id)  AS progress,
        (
          SELECT COUNT(*)::INT
            FROM key_results kr
           WHERE kr.objective_id = o.id
             AND kr.deleted_at IS NULL
             AND kr.status NOT IN ('CANCELLED')
        )                                       AS kr_count,
        u.name  AS owner_name,
        u.email AS owner_email,
        t.name  AS team_name
      FROM objectives o
      LEFT JOIN users u ON u.id = o.owner_id
      LEFT JOIN teams t ON t.id = o.team_id
      WHERE o.deleted_at IS NULL
    $view$;
  END IF;
END;
$$;
