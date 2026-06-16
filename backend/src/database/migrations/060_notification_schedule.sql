-- ================================================================
-- Migration 060: Notification Schedule per Organization
-- Configurable schedule + channels + per-org Telegram/email
-- ================================================================

-- ----------------------------------------------------------------
-- 1. Add default notification settings to all active orgs
--    New fields:
--      telegram_chat_id   — overrides global TELEGRAM_CHAT_ID for this org
--      email_recipients   — additional emails (comma-separated)
-- ----------------------------------------------------------------
UPDATE organizations
   SET parameters = parameters || jsonb_build_object(
     'notifications', jsonb_build_object(
       'timezone',          'America/Lima',
       'telegram_chat_id',  '',
       'email_recipients',  '',
       'risk_sentinel',     '{"enabled":true,"channels":["email","telegram"],"hour":2,"frequency":"daily"}'::jsonb,
       'executive_briefer', '{"enabled":true,"channels":["email","telegram"],"hour":8,"frequency":"weekly","day_of_week":1}'::jsonb,
       'checkin_reminder',  '{"enabled":true,"channels":["telegram"],"hour":10,"frequency":"weekly","day_of_week":4,"stale_days":7}'::jsonb,
       'cycle_closure',     '{"enabled":true,"channels":["telegram"],"hour":9,"frequency":"daily"}'::jsonb
     )
   )
 WHERE deleted_at IS NULL
   AND (parameters -> 'notifications') IS NULL;

-- ----------------------------------------------------------------
-- 2. Recreate v_org_parameters with notifications + sent_at fields
-- ----------------------------------------------------------------
DROP VIEW IF EXISTS v_org_parameters;
CREATE VIEW v_org_parameters AS
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
  -- SMTP
  COALESCE(o.parameters->>'smtp_host', '')           AS smtp_host,
  COALESCE((o.parameters->>'smtp_port')::int, 587)   AS smtp_port,
  COALESCE(o.parameters->>'smtp_user', '')           AS smtp_user,
  COALESCE(o.parameters->>'smtp_from', '')           AS smtp_from,
  -- Notification schedule (fully per-org)
  COALESCE(
    o.parameters -> 'notifications',
    '{"timezone":"America/Lima",
      "telegram_chat_id":"",
      "email_recipients":"",
      "risk_sentinel":     {"enabled":true,"channels":["email","telegram"],"hour":2,"frequency":"daily"},
      "executive_briefer": {"enabled":true,"channels":["email","telegram"],"hour":8,"frequency":"weekly","day_of_week":1},
      "checkin_reminder":  {"enabled":true,"channels":["telegram"],"hour":10,"frequency":"weekly","day_of_week":4,"stale_days":7},
      "cycle_closure":     {"enabled":true,"channels":["telegram"],"hour":9,"frequency":"daily"}
    }'::jsonb
  ) AS notifications,
  -- Last sent timestamps (flat keys — updated via sp_update_org_parameters)
  o.parameters->>'notif_sent_risk_sentinel'      AS notif_sent_risk_sentinel,
  o.parameters->>'notif_sent_executive_briefer'  AS notif_sent_executive_briefer,
  o.parameters->>'notif_sent_checkin_reminder'   AS notif_sent_checkin_reminder,
  o.parameters->>'notif_sent_cycle_closure'      AS notif_sent_cycle_closure,
  -- Raw
  o.parameters AS raw
FROM organizations o
WHERE o.deleted_at IS NULL;
