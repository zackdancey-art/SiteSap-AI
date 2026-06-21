-- Performance indexes for the main slow-path queries identified in load testing.
-- Combines the entries/diaries indexes (load-test fixes) with the broader
-- list-by-owner and list-by-site index set from the API performance pass.
-- Duplicate (owner_email, timestamp DESC) entries index deduplicated into one.

-- Site listing: list-by-owner ordered by creation date.
CREATE INDEX IF NOT EXISTS idx_project_sites_owner_created
  ON project_sites(owner_email, created_at DESC);

-- Worker path: SELECT * FROM project_entries WHERE owner_email = $1 ORDER BY timestamp DESC
-- Without this index, every worker's entries query does a full sequential scan.
CREATE INDEX IF NOT EXISTS idx_project_entries_owner_ts
  ON project_entries(owner_email, timestamp DESC);

-- Supervisor dashboard JOIN: project_entries e ON e.site_id = s.id
-- COUNT(DISTINCT e.id) per site without this index scans the whole entries table.
-- Ordered by timestamp so the same index serves list-by-site reads.
CREATE INDEX IF NOT EXISTS idx_project_entries_site_ts
  ON project_entries(site_id, timestamp DESC);

-- Diaries: list-by-owner ordered by generation date.
CREATE INDEX IF NOT EXISTS idx_project_diaries_owner_gen
  ON project_diaries(owner_email, generated_at DESC);

-- Parallel fix for diaries (same supervisor report pattern), ordered by generation date.
CREATE INDEX IF NOT EXISTS idx_project_diaries_site_gen
  ON project_diaries(site_id, generated_at DESC);
