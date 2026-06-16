-- Migration 070 — Fix fn_first_day_context: proper LIMIT inside jsonb_agg subqueries

CREATE OR REPLACE FUNCTION fn_first_day_context(p_org_id UUID, p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_cycle_id    UUID;
  v_team_id     UUID;
  v_result      JSONB;
BEGIN
  SELECT id INTO v_cycle_id
    FROM cycles
   WHERE organization_id = p_org_id AND status = 'ACTIVE'
   ORDER BY start_date DESC LIMIT 1;

  SELECT tm.team_id INTO v_team_id
    FROM team_members tm
    JOIN teams t ON t.id = tm.team_id
   WHERE tm.user_id = p_user_id AND t.organization_id = p_org_id
   ORDER BY CASE tm.role WHEN 'LEAD' THEN 1 ELSE 2 END
   LIMIT 1;

  SELECT jsonb_build_object(

    'org', jsonb_build_object(
      'id',          o.id,
      'name',        o.name,
      'vision',      COALESCE(o.vision,  ''),
      'mission',     COALESCE(o.mission, ''),
      'values_list', COALESCE(to_jsonb(o.values_list), '[]'::jsonb),
      'sector',      o.sector
    ),

    'active_cycle', CASE WHEN v_cycle_id IS NULL THEN NULL ELSE (
      SELECT jsonb_build_object(
        'id',            c.id,
        'name',          c.name,
        'type',          c.type,
        'start_date',    c.start_date,
        'end_date',      c.end_date,
        'days_remaining', GREATEST(0, (c.end_date::date - CURRENT_DATE)::int),
        'total_days',    GREATEST(1, (c.end_date::date - c.start_date::date)::int),
        'progress_pct',  CASE
          WHEN (c.end_date::date - c.start_date::date) = 0 THEN 100
          ELSE LEAST(100, GREATEST(0, ROUND(
            ((CURRENT_DATE - c.start_date::date)::numeric /
             NULLIF((c.end_date::date - c.start_date::date)::numeric, 0)) * 100
          )))
        END
      ) FROM cycles c WHERE c.id = v_cycle_id
    ) END,

    'company_objectives', COALESCE((
      SELECT jsonb_agg(r)
      FROM (
        SELECT jsonb_build_object(
          'id',          obj.id,
          'code',        obj.code,
          'title',       obj.title,
          'description', COALESCE(obj.description, ''),
          'progress',    ROUND(obj.progress),
          'kr_count',    (SELECT COUNT(*) FROM key_results kr
                           WHERE kr.objective_id = obj.id AND kr.deleted_at IS NULL)
        ) AS r
        FROM objectives obj
        WHERE obj.organization_id = p_org_id
          AND obj.level = 'COMPANY'
          AND obj.cycle_id = v_cycle_id
          AND obj.deleted_at IS NULL
        ORDER BY obj.progress DESC
        LIMIT 5
      ) sub
    ), '[]'::jsonb),

    'my_team', CASE WHEN v_team_id IS NULL THEN NULL ELSE (
      SELECT jsonb_build_object(
        'id',           t.id,
        'name',         t.name,
        'description',  COALESCE(t.description, ''),
        'member_count', (SELECT COUNT(*) FROM team_members tm2 WHERE tm2.team_id = t.id),
        'lead_name',    (
          SELECT u2.name FROM team_members tm3
          JOIN users u2 ON u2.id = tm3.user_id
          WHERE tm3.team_id = t.id AND tm3.role = 'LEAD'
          LIMIT 1
        )
      ) FROM teams t WHERE t.id = v_team_id
    ) END,

    'team_objective', CASE WHEN v_team_id IS NULL THEN NULL ELSE (
      SELECT jsonb_build_object(
        'id',          tobj.id,
        'code',        tobj.code,
        'title',       tobj.title,
        'description', COALESCE(tobj.description, ''),
        'progress',    ROUND(tobj.progress)
      )
      FROM objectives tobj
      WHERE tobj.team_id = v_team_id
        AND tobj.cycle_id = v_cycle_id
        AND tobj.deleted_at IS NULL
        AND tobj.status NOT IN ('CANCELLED')
      ORDER BY tobj.progress DESC
      LIMIT 1
    ) END,

    'my_krs', COALESCE((
      SELECT jsonb_agg(r)
      FROM (
        SELECT jsonb_build_object(
          'id',            kr.id,
          'code',          kr.code,
          'title',         kr.title,
          'progress',      ROUND(kr.progress),
          'metric_unit',   kr.metric_unit,
          'current_value', kr.current_value,
          'target_value',  kr.target_value,
          'status',        kr.status,
          'objective_title', (SELECT obj2.title FROM objectives obj2 WHERE obj2.id = kr.objective_id)
        ) AS r
        FROM key_results kr
        JOIN objectives obj ON obj.id = kr.objective_id
        WHERE kr.owner_id = p_user_id
          AND obj.organization_id = p_org_id
          AND obj.cycle_id = v_cycle_id
          AND kr.deleted_at IS NULL
          AND obj.deleted_at IS NULL
          AND kr.status NOT IN ('CANCELLED')
        ORDER BY kr.progress ASC
        LIMIT 5
      ) sub
    ), '[]'::jsonb),

    'my_backlog_items', COALESCE((
      SELECT jsonb_agg(r)
      FROM (
        SELECT jsonb_build_object(
          'id',               bi.id,
          'code',             bi.code,
          'type',             bi.type,
          'title',            bi.title,
          'description',      COALESCE(bi.description, ''),
          'story_points',     bi.story_points,
          'status',           bi.status,
          'priority',         bi.priority,
          'initiative_title', (SELECT ini.title FROM initiatives ini WHERE ini.id = bi.initiative_id),
          'initiative_id',    bi.initiative_id
        ) AS r
        FROM backlog_items bi
        WHERE bi.assignee_id = p_user_id
          AND bi.organization_id = p_org_id
          AND bi.status NOT IN ('DONE','CANCELLED')
        ORDER BY
          CASE bi.priority WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END,
          bi.created_at ASC
        LIMIT 3
      ) sub
    ), '[]'::jsonb)

  )
  INTO v_result
  FROM organizations o
  WHERE o.id = p_org_id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_first_day_context(UUID, UUID) TO okr_user;
