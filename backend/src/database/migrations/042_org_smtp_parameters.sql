-- Migration 042: Add SMTP configuration to org parameters

-- Add SMTP defaults (empty strings — not enabled until configured)
UPDATE organizations
   SET parameters = parameters || '{
     "smtp_host": "",
     "smtp_port": 587,
     "smtp_user": "",
     "smtp_pass": "",
     "smtp_from": ""
   }'::jsonb
 WHERE deleted_at IS NULL;

-- Recreate v_org_parameters to include SMTP fields
CREATE OR REPLACE VIEW v_org_parameters AS
SELECT
  o.id AS organization_id,
  -- OKR limits
  COALESCE((o.parameters->>'max_objectives_per_level')::int,  5)    AS max_objectives_per_level,
  COALESCE((o.parameters->>'max_krs_per_objective')::int,     5)    AS max_krs_per_objective,
  COALESCE((o.parameters->>'auto_complete_threshold')::numeric, 70)  AS auto_complete_threshold,
  -- Confidence thresholds
  COALESCE((o.parameters->>'confidence_at_risk')::numeric,  0.40)   AS confidence_at_risk,
  COALESCE((o.parameters->>'confidence_on_track')::numeric, 0.70)   AS confidence_on_track,
  COALESCE((o.parameters->>'progress_behind_threshold')::numeric, 30) AS progress_behind_threshold,
  -- Staleness
  COALESCE((o.parameters->>'stale_checkin_days')::int,  14)          AS stale_checkin_days,
  COALESCE((o.parameters->>'unstarted_kr_days')::int,    7)          AS unstarted_kr_days,
  -- Backlog
  COALESCE(
    (SELECT array_agg(v::int ORDER BY v) FROM jsonb_array_elements_text(o.parameters->'story_points_scale') v),
    ARRAY[1,2,3,5,8,13,21]
  ) AS story_points_scale,
  COALESCE((o.parameters->>'max_sprints_per_year')::int, 52)         AS max_sprints_per_year,
  -- SMTP (smtp_pass intentionally excluded — read separately in backend)
  COALESCE(o.parameters->>'smtp_host', '')  AS smtp_host,
  COALESCE((o.parameters->>'smtp_port')::int, 587) AS smtp_port,
  COALESCE(o.parameters->>'smtp_user', '')  AS smtp_user,
  COALESCE(o.parameters->>'smtp_from', '')  AS smtp_from,
  -- Metadata
  o.parameters AS raw
FROM organizations o
WHERE o.deleted_at IS NULL;
