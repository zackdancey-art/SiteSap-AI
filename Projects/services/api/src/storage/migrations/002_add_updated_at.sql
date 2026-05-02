-- Add updated_at tracking to project tables for audit trail

ALTER TABLE project_sites
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE project_entries
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE project_diaries
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Trigger function to auto-update updated_at on row modification
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_project_sites_updated_at') THEN
    CREATE TRIGGER set_project_sites_updated_at
      BEFORE UPDATE ON project_sites
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_project_entries_updated_at') THEN
    CREATE TRIGGER set_project_entries_updated_at
      BEFORE UPDATE ON project_entries
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_project_diaries_updated_at') THEN
    CREATE TRIGGER set_project_diaries_updated_at
      BEFORE UPDATE ON project_diaries
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;
