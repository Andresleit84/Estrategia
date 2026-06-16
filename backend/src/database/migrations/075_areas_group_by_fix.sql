-- Patch: Fix v_areas_with_teams GROUP BY clause
-- GROUP BY a.id, u.name, u.avatar_url is incorrect — groups by value not identity.
-- Fix: GROUP BY a.id, u.id (u.id is PK, covers u.name and u.avatar_url functionally)

CREATE OR REPLACE VIEW v_areas_with_teams AS
SELECT
  a.id,
  a.org_id,
  a.name,
  a.description,
  a.color,
  a.sort_order,
  a.is_active,
  a.created_at,
  a.updated_at,
  a.manager_id,
  u.name                             AS manager_name,
  u.avatar_url                       AS manager_avatar,
  COUNT(DISTINCT t.id)               AS team_count,
  COUNT(DISTINCT tm.user_id)         AS member_count,
  COALESCE(
    json_agg(
      json_build_object(
        'id',           t.id,
        'name',         t.name,
        'description',  t.description,
        'is_root',      t.is_root,
        'area_id',      t.area_id,
        'member_count', (
          SELECT COUNT(*)::INT FROM team_members tm2 WHERE tm2.team_id = t.id
        )
      ) ORDER BY t.name
    ) FILTER (WHERE t.id IS NOT NULL),
    '[]'
  )::JSONB                           AS teams
FROM areas a
LEFT JOIN users u  ON u.id = a.manager_id AND u.deleted_at IS NULL
LEFT JOIN teams t  ON t.area_id = a.id AND t.deleted_at IS NULL
LEFT JOIN team_members tm ON tm.team_id = t.id
WHERE a.is_active = true
GROUP BY a.id, u.id;
