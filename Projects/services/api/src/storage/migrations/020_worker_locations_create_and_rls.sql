-- Company + role-based access model — Part 2, Migration B (findings H4 + H1).
-- Creates the worker_locations table (it had NO schema definition anywhere in
-- the codebase — see H4; the supervisor worker-map was broken on Postgres because
-- the table did not exist) WITH a company_id column, then secures it with RLS
-- using the pattern proven on `incidents` in migration 019.
--
-- The matching code repair lands with this migration: locationStore's INSERT now
-- populates company_id and every DB query runs through withTenant(). RLS's
-- WITH CHECK requires company_id = current_setting('app.company_id'), so the
-- code and this migration must ship together.

-- ── Table (idempotent; also handles the drift case if it exists sans company_id)
CREATE TABLE IF NOT EXISTS worker_locations (
  user_email  TEXT PRIMARY KEY REFERENCES auth_users(email) ON DELETE CASCADE,
  user_name   TEXT,
  latitude    DOUBLE PRECISION NOT NULL,
  longitude   DOUBLE PRECISION NOT NULL,
  accuracy    DOUBLE PRECISION,
  site_id     TEXT,
  timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE worker_locations ADD COLUMN IF NOT EXISTS company_id TEXT;
UPDATE worker_locations wl SET company_id = u.company_id
  FROM auth_users u WHERE u.email = wl.user_email AND wl.company_id IS NULL;
-- Location rows are ephemeral (4-hour window) and whole-row keyed on user_email.
-- Any row whose user no longer exists in auth_users cannot be tenant-scoped;
-- drop it rather than admit an unscoped row.
DELETE FROM worker_locations WHERE company_id IS NULL;
ALTER TABLE worker_locations ALTER COLUMN company_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_worker_locations_company ON worker_locations(company_id);

-- ── RLS (pattern from migration 019; FORCE because the app connects as owner) ──
ALTER TABLE worker_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_locations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS worker_locations_company_isolation ON worker_locations;
CREATE POLICY worker_locations_company_isolation ON worker_locations
  USING (company_id = current_setting('app.company_id', true))
  WITH CHECK (company_id = current_setting('app.company_id', true));
