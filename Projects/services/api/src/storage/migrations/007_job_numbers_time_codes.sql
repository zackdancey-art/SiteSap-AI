-- Add job_number to sites, and time_code + hours_worked to entries

ALTER TABLE project_sites
  ADD COLUMN IF NOT EXISTS job_number TEXT NOT NULL DEFAULT '';

ALTER TABLE project_entries
  ADD COLUMN IF NOT EXISTS time_code TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS hours_worked TEXT NOT NULL DEFAULT '';
