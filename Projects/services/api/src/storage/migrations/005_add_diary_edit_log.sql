-- Add server-side audit trail to project_diaries
ALTER TABLE project_diaries
  ADD COLUMN IF NOT EXISTS edit_log JSONB NOT NULL DEFAULT '[]';
