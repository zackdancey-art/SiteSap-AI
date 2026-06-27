-- V2 features: progress tracking, push tokens, crew timecards, incidents, inspection checklists
-- Source: feature/soon-and-v2-features migration 004, renumbered to 009 for main's sequence

-- Site progress
ALTER TABLE project_sites ADD COLUMN IF NOT EXISTS progress_percent INTEGER NOT NULL DEFAULT 0;

-- Push notification tokens
CREATE TABLE IF NOT EXISTS push_tokens (
  id          TEXT PRIMARY KEY,
  owner_email TEXT NOT NULL REFERENCES auth_users(email) ON DELETE CASCADE,
  token       TEXT NOT NULL,
  platform    TEXT NOT NULL DEFAULT 'expo',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(owner_email, token)
);

-- Crew timecards
CREATE TABLE IF NOT EXISTS crew_timecards (
  id             TEXT PRIMARY KEY,
  owner_email    TEXT NOT NULL REFERENCES auth_users(email) ON DELETE CASCADE,
  site_id        TEXT NOT NULL REFERENCES project_sites(id) ON DELETE CASCADE,
  entry_id       TEXT REFERENCES project_entries(id) ON DELETE SET NULL,
  worker_name    TEXT NOT NULL,
  date           TEXT NOT NULL,
  hours_regular  NUMERIC(5,2) NOT NULL DEFAULT 0,
  hours_overtime NUMERIC(5,2) NOT NULL DEFAULT 0,
  trade          TEXT,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_crew_timecards_site ON crew_timecards(site_id);
CREATE INDEX IF NOT EXISTS idx_crew_timecards_owner ON crew_timecards(owner_email);

-- Incidents / near-miss reports
CREATE TABLE IF NOT EXISTS incidents (
  id                TEXT PRIMARY KEY,
  owner_email       TEXT NOT NULL REFERENCES auth_users(email) ON DELETE CASCADE,
  site_id           TEXT NOT NULL REFERENCES project_sites(id) ON DELETE CASCADE,
  date              TEXT NOT NULL,
  severity          TEXT NOT NULL DEFAULT 'near-miss',
  description       TEXT NOT NULL,
  injured_party     TEXT,
  corrective_action TEXT,
  status            TEXT NOT NULL DEFAULT 'open',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_incidents_site ON incidents(site_id);
CREATE INDEX IF NOT EXISTS idx_incidents_owner ON incidents(owner_email);

-- Inspection / safety checklist templates
CREATE TABLE IF NOT EXISTS inspection_templates (
  id          TEXT PRIMARY KEY,
  owner_email TEXT NOT NULL REFERENCES auth_users(email) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  items_json  JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Completed inspections
CREATE TABLE IF NOT EXISTS inspections (
  id           TEXT PRIMARY KEY,
  owner_email  TEXT NOT NULL REFERENCES auth_users(email) ON DELETE CASCADE,
  site_id      TEXT NOT NULL REFERENCES project_sites(id) ON DELETE CASCADE,
  template_id  TEXT REFERENCES inspection_templates(id) ON DELETE SET NULL,
  name         TEXT NOT NULL,
  date         TEXT NOT NULL,
  results_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  status       TEXT NOT NULL DEFAULT 'pending',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_inspections_site ON inspections(site_id);
CREATE INDEX IF NOT EXISTS idx_inspections_owner ON inspections(owner_email);
