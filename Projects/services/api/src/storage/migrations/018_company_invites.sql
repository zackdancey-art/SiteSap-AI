-- Company + role-based access model (Part 1, Migration E)
-- Extends site_invites so it can carry a company invite (company_id + a target
-- company_role) with an optional site_id. Company-only invites (site_id NULL)
-- add a user to a company; site invites keep their existing shape.
ALTER TABLE site_invites
  ADD COLUMN IF NOT EXISTS company_id   TEXT,
  ADD COLUMN IF NOT EXISTS company_role TEXT CHECK (company_role IN ('owner','manager','viewer','crew'));

-- site_id becomes optional so a pure company invite can exist without a site.
ALTER TABLE site_invites ALTER COLUMN site_id DROP NOT NULL;

-- Replace the old unconditional unique index with two partial indexes:
--   • one for site invites (site_id present)
--   • one for company-only invites (company_id present, no site)
DROP INDEX IF EXISTS site_invites_site_email;
CREATE UNIQUE INDEX IF NOT EXISTS site_invites_site_email_partial
  ON site_invites(site_id, invited_email) WHERE site_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS site_invites_company_email_partial
  ON site_invites(company_id, invited_email)
  WHERE company_id IS NOT NULL AND site_id IS NULL;

-- Drop the dormant auth_invites table (created in migration 013, never used).
DROP TABLE IF EXISTS auth_invites;
