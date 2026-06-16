-- Migration 066: extend ai_briefings type check to include personal_briefing and engagement_roi
ALTER TABLE ai_briefings DROP CONSTRAINT IF EXISTS ai_briefings_type_check;
ALTER TABLE ai_briefings ADD CONSTRAINT ai_briefings_type_check
  CHECK (type = ANY (ARRAY[
    'risk_sentinel'::text,
    'executive_briefing'::text,
    'alignment_audit'::text,
    'cycle_close'::text,
    'engagement_roi'::text,
    'personal_briefing'::text
  ]));
