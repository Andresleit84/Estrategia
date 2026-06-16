-- Extend v_alignment_map to COMPANY→AREA→TEAM→INDIVIDUAL (4 levels)
-- Adds: area_objectives (JSONB with nested team_objectives and individual_objectives),
--       area_count, team_count, individual_count

DROP VIEW IF EXISTS v_alignment_map;

CREATE VIEW v_alignment_map AS
WITH individual_agg AS (
  SELECT
    parent_objective_id          AS team_obj_id,
    organization_id,
    cycle_id,
    COALESCE(
      json_agg(json_build_object(
        'id',       id,
        'title',    title,
        'progress', progress,
        'status',   status,
        'owner',    owner_name
      ) ORDER BY title) FILTER (WHERE id IS NOT NULL),
      '[]'::json
    )                            AS individual_objectives,
    COUNT(*)::INT                AS individual_count
  FROM v_objectives_with_progress
  WHERE level = 'INDIVIDUAL'
    AND parent_objective_id IS NOT NULL
  GROUP BY parent_objective_id, organization_id, cycle_id
),
team_agg AS (
  SELECT
    o.parent_objective_id        AS area_obj_id,
    o.organization_id,
    o.cycle_id,
    COALESCE(
      json_agg(json_build_object(
        'id',                   o.id,
        'title',                o.title,
        'progress',             o.progress,
        'status',               o.status,
        'owner',                o.owner_name,
        'team_name',            o.team_name,
        'individual_objectives', COALESCE(ia.individual_objectives, '[]'::json)
      ) ORDER BY o.title) FILTER (WHERE o.id IS NOT NULL),
      '[]'::json
    )                            AS team_objectives,
    COUNT(DISTINCT o.id)::INT    AS team_count,
    COALESCE(SUM(ia.individual_count), 0)::INT AS individual_count
  FROM v_objectives_with_progress o
  LEFT JOIN individual_agg ia
    ON ia.team_obj_id      = o.id
   AND ia.organization_id  = o.organization_id
   AND ia.cycle_id         = o.cycle_id
  WHERE o.level = 'TEAM'
    AND o.parent_objective_id IS NOT NULL
  GROUP BY o.parent_objective_id, o.organization_id, o.cycle_id
),
area_agg AS (
  SELECT
    o.parent_objective_id        AS company_obj_id,
    o.organization_id,
    o.cycle_id,
    COALESCE(
      json_agg(json_build_object(
        'id',              o.id,
        'title',           o.title,
        'progress',        o.progress,
        'status',          o.status,
        'owner',           o.owner_name,
        'team_objectives', COALESCE(ta.team_objectives, '[]'::json)
      ) ORDER BY o.title) FILTER (WHERE o.id IS NOT NULL),
      '[]'::json
    )                            AS area_objectives,
    COUNT(DISTINCT o.id)::INT    AS area_count,
    COALESCE(SUM(ta.team_count), 0)::INT        AS team_count,
    COALESCE(SUM(ta.individual_count), 0)::INT  AS individual_count
  FROM v_objectives_with_progress o
  LEFT JOIN team_agg ta
    ON ta.area_obj_id     = o.id
   AND ta.organization_id = o.organization_id
   AND ta.cycle_id        = o.cycle_id
  WHERE o.level = 'AREA'
    AND o.parent_objective_id IS NOT NULL
  GROUP BY o.parent_objective_id, o.organization_id, o.cycle_id
)
SELECT
  c.id                                                 AS company_obj_id,
  c.organization_id,
  c.cycle_id,
  c.title                                              AS company_title,
  c.progress                                           AS company_progress,
  c.status                                             AS company_status,
  c.owner_name                                         AS company_owner,
  COALESCE(aa.area_objectives, '[]'::json)::JSONB      AS area_objectives,
  COALESCE(aa.area_count,        0)::INT               AS area_count,
  COALESCE(aa.team_count,        0)::INT               AS team_count,
  COALESCE(aa.individual_count,  0)::INT               AS individual_count
FROM v_objectives_with_progress c
LEFT JOIN area_agg aa
  ON aa.company_obj_id   = c.id
 AND aa.organization_id  = c.organization_id
 AND aa.cycle_id         = c.cycle_id
WHERE c.level = 'COMPANY';
