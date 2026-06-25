-- Per-site entry templates: pre-filled defaults that workers can apply when starting a new entry
CREATE TABLE IF NOT EXISTS project_templates (
  id TEXT PRIMARY KEY,
  owner_email TEXT NOT NULL REFERENCES auth_users(email) ON DELETE CASCADE,
  site_id TEXT NOT NULL REFERENCES project_sites(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Default',
  weather TEXT NOT NULL DEFAULT '',
  crew_count TEXT NOT NULL DEFAULT '',
  notes_template TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_templates_site
  ON project_templates(site_id);
