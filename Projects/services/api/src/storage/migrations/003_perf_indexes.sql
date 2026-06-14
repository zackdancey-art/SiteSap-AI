-- Performance indexes for common list-by-owner and list-by-site queries

CREATE INDEX IF NOT EXISTS idx_project_sites_owner_created
  ON project_sites(owner_email, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_project_entries_owner_ts
  ON project_entries(owner_email, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_project_entries_site_ts
  ON project_entries(site_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_project_diaries_owner_gen
  ON project_diaries(owner_email, generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_project_diaries_site_gen
  ON project_diaries(site_id, generated_at DESC);
