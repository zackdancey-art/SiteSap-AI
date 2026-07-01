-- Company + role-based access model (Part 1, Migration A)
-- Companies are the top-level tenant boundary. A company owns users and all
-- operational data. Compliance: companies are NEVER hard-deleted — the status
-- column soft-cancels them ('cancelled') to preserve 7-year record-keeping.
CREATE TABLE IF NOT EXISTS companies (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  country     TEXT NOT NULL DEFAULT '',
  owner_email TEXT,  -- no FK constraint — soft relationship only (compliance: never hard-delete)
  status      TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'cancelled')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Keep updated_at fresh on modification (reuses the shared trigger fn from 002)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_companies_updated_at') THEN
    CREATE TRIGGER set_companies_updated_at
      BEFORE UPDATE ON companies
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;
