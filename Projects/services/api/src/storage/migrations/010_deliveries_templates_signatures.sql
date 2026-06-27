-- Material deliveries, entry templates, diary digital signatures
-- Source: feature/soon-and-v2-features migration 005, renumbered to 010 for main's sequence

CREATE TABLE IF NOT EXISTS material_deliveries (
  id           TEXT PRIMARY KEY,
  owner_email  TEXT NOT NULL REFERENCES auth_users(email) ON DELETE CASCADE,
  site_id      TEXT NOT NULL REFERENCES project_sites(id) ON DELETE CASCADE,
  date         TEXT NOT NULL,
  supplier     TEXT NOT NULL DEFAULT '',
  items_json   JSONB NOT NULL DEFAULT '[]'::jsonb,
  quantity     TEXT NOT NULL DEFAULT '',
  notes        TEXT NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_deliveries_site  ON material_deliveries(site_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_owner ON material_deliveries(owner_email);

-- Per-user entry form presets (distinct from per-site project_templates added in 007)
CREATE TABLE IF NOT EXISTS entry_templates (
  id          TEXT PRIMARY KEY,
  owner_email TEXT NOT NULL REFERENCES auth_users(email) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  notes       TEXT NOT NULL DEFAULT '',
  crew_count  TEXT NOT NULL DEFAULT '',
  weather     TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_entry_templates_owner ON entry_templates(owner_email);

-- Diary digital signatures
ALTER TABLE project_diaries
  ADD COLUMN IF NOT EXISTS signed_by TEXT,
  ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ;
