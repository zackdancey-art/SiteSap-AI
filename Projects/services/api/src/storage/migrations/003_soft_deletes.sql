-- Soft deletes: deleted_at NULL means live, non-NULL means deleted

ALTER TABLE project_sites    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE project_entries  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE project_diaries  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_project_sites_deleted_at    ON project_sites(deleted_at);
CREATE INDEX IF NOT EXISTS idx_project_entries_deleted_at  ON project_entries(deleted_at);
CREATE INDEX IF NOT EXISTS idx_project_diaries_deleted_at  ON project_diaries(deleted_at);
