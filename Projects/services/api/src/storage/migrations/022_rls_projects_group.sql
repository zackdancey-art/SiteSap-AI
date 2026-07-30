-- Company + role-based access model — Part 2, Migration D (finding H1).
-- Secures the projectsStore core group with RLS: project_sites and its children
-- project_entries, project_diaries, project_templates. This is the LAST and most
-- entangled step of the X1 tenancy pass — project_sites is referenced directly
-- only by projectsStore (other stores reach it solely via the
-- `site_id IN (SELECT site_id FROM site_members ...)` subquery, which is scoped by
-- the caller's own member_email and is NOT affected by RLS on project_sites), so
-- the conversion is contained to projectsStore, but that store also holds two
-- cross-company operations that need explicit tenant context (see the code
-- change landing with this migration):
--   * deleteAllUserProjectData(email) — no Actor; derives companyId and runs its
--     DELETEs inside withTenant so account deletion is not silently no-op'd.
--   * acceptSiteInvite — sets app.company_id to the invite's company for the
--     single project_sites name read (cross-company by nature).
--
-- All four tables already carry company_id NOT NULL (migration 017) and their
-- INSERTs already populate it, so WITH CHECK passes. Same pattern as migration
-- 019 (FORCE because the app connects as the DB owner; fail-closed via
-- current_setting(...,true) → NULL → zero rows). Idempotent.
--
-- NOTE: site_members and site_invites are intentionally NOT RLS-secured here —
-- they are read by un-converted crew-scope subqueries in deliveries/crew/
-- inspections and are scoped by member_email; securing them is tracked as H1b.

-- ── project_sites ─────────────────────────────────────────────────────────────
ALTER TABLE project_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_sites FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS project_sites_company_isolation ON project_sites;
CREATE POLICY project_sites_company_isolation ON project_sites
  USING (company_id = current_setting('app.company_id', true))
  WITH CHECK (company_id = current_setting('app.company_id', true));

-- ── project_entries ───────────────────────────────────────────────────────────
ALTER TABLE project_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_entries FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS project_entries_company_isolation ON project_entries;
CREATE POLICY project_entries_company_isolation ON project_entries
  USING (company_id = current_setting('app.company_id', true))
  WITH CHECK (company_id = current_setting('app.company_id', true));

-- ── project_diaries ───────────────────────────────────────────────────────────
ALTER TABLE project_diaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_diaries FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS project_diaries_company_isolation ON project_diaries;
CREATE POLICY project_diaries_company_isolation ON project_diaries
  USING (company_id = current_setting('app.company_id', true))
  WITH CHECK (company_id = current_setting('app.company_id', true));

-- ── project_templates ─────────────────────────────────────────────────────────
ALTER TABLE project_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_templates FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS project_templates_company_isolation ON project_templates;
CREATE POLICY project_templates_company_isolation ON project_templates
  USING (company_id = current_setting('app.company_id', true))
  WITH CHECK (company_id = current_setting('app.company_id', true));
