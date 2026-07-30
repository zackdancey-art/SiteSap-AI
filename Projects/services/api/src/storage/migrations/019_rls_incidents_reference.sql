-- Company + role-based access model — Part 2, Migration A (finding H1).
-- Tenant isolation enforcement FLOOR: Row-Level Security.
--
-- Until now, cross-company isolation was enforced only by hand-written
-- `WHERE company_id = $1` clauses in every store query (a convention). This
-- migration begins moving enforcement into the database itself so a query that
-- forgets the clause returns zero rows instead of leaking another tenant's data.
--
-- `incidents` is the REFERENCE table: it is already Actor-scoped and its INSERT
-- already populates company_id, so proving RLS here is pure addition. The same
-- pattern is applied to the remaining tables in later migrations (020+), with
-- the broken-write tables (push_tokens, entry_templates, worker_locations)
-- repaired as they are secured, and project_sites last.
--
-- How the policy reads tenant context: the application runs every tenanted query
-- inside withTenant() (services/api/src/storage/tenant.ts), which does
-- `set_config('app.company_id', <caller's company>, true)` (SET LOCAL) at the
-- start of the transaction. current_setting('app.company_id', true) uses
-- missing_ok = true, so a query that runs OUTSIDE withTenant sees NULL and the
-- policy excludes every row (fail closed).
--
-- FORCE is required: plain ENABLE exempts the table OWNER from RLS, and the app
-- connects to Render Postgres as the database owner. FORCE makes the policy
-- apply to the owner too.
--
-- Idempotent: ENABLE/FORCE are no-ops if already set; the policy is dropped and
-- recreated.

ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS incidents_company_isolation ON incidents;
CREATE POLICY incidents_company_isolation ON incidents
  USING (company_id = current_setting('app.company_id', true))
  WITH CHECK (company_id = current_setting('app.company_id', true));
