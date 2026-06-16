-- Migration 049: AI analysis column for sector assessments
ALTER TABLE sector_assessments
  ADD COLUMN IF NOT EXISTS ai_analysis JSONB;
