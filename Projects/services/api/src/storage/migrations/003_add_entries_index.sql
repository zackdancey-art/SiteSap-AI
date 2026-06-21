-- Performance indexes for the two main slow-path queries identified in load testing.

-- Worker path: SELECT * FROM project_entries WHERE owner_email = $1 ORDER BY timestamp DESC
-- Without this index, every worker's entries query does a full sequential scan.
CREATE INDEX IF NOT EXISTS idx_project_entries_owner_timestamp
  ON project_entries(owner_email, timestamp DESC);

-- Supervisor dashboard JOIN: project_entries e ON e.site_id = s.id
-- COUNT(DISTINCT e.id) per site without this index scans the whole entries table.
CREATE INDEX IF NOT EXISTS idx_project_entries_site_id
  ON project_entries(site_id);

-- Parallel fix for diaries (same supervisor report pattern).
CREATE INDEX IF NOT EXISTS idx_project_diaries_site_id
  ON project_diaries(site_id);
