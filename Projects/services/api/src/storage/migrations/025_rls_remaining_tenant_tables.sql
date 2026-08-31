-- H1b: extend Row-Level Security to the remaining company-scoped operational
-- tables — site_members, site_invites, deliveries, crew_timecards, inspections.
-- Same pattern as 019-022: ENABLE + FORCE + a company-isolation policy against
-- current_setting('app.company_id', true), fail-closed. The app connects as the
-- table owner, so FORCE is required to subject it to the policy. Every store
-- query on these tables must run through withTenant() (converted alongside this
-- migration) or it fails closed (zero rows).
--
-- Additive + idempotent: ADD COLUMN IF NOT EXISTS / ENABLE+FORCE (idempotent) /
-- DROP POLICY IF EXISTS then CREATE. storage/migrate.ts wraps this file in its
-- own BEGIN/COMMIT.

-- ══ 1. site_members has no company_id (created in 008); add + backfill ════════
ALTER TABLE site_members ADD COLUMN IF NOT EXISTS company_id TEXT;

-- Backfill site_members.company_id (and any NULL site_invites.company_id) from
-- the owning project_sites row. project_sites is FORCE ROW LEVEL SECURITY
-- (migration 022): this migration runs as the owner with NO app.company_id set,
-- so current_setting('app.company_id', true) is NULL and a read of project_sites
-- returns ZERO rows — the backfill would silently set NULL. Lift FORCE for the
-- owner-run cross-company read, then restore it (the 024/H7 backfill pattern).
ALTER TABLE project_sites NO FORCE ROW LEVEL SECURITY;
UPDATE site_members sm
   SET company_id = ps.company_id
  FROM project_sites ps
 WHERE ps.id = sm.site_id
   AND sm.company_id IS NULL;
UPDATE site_invites si
   SET company_id = ps.company_id
  FROM project_sites ps
 WHERE ps.id = si.site_id
   AND si.site_id IS NOT NULL
   AND si.company_id IS NULL;
ALTER TABLE project_sites FORCE ROW LEVEL SECURITY;
-- company_id is left NULLABLE deliberately: a row orphaned by a deleted parent
-- site keeps a NULL company_id, which fails closed under the policy (invisible)
-- rather than failing the migration on a NOT NULL constraint.

-- ══ 2. Standard company-isolation RLS on the four straightforward tables ══════
-- (material_deliveries, crew_timecards, inspections already carry company_id from
--  017; site_members now does, from §1. NB: the deliveries table is named
--  `material_deliveries` — created in migration 010.)
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['site_members','material_deliveries','crew_timecards','inspections']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_company_isolation', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING (company_id = current_setting(''app.company_id'', true)) '
      || 'WITH CHECK (company_id = current_setting(''app.company_id'', true))',
      t || '_company_isolation', t
    );
  END LOOP;
END $$;

-- ══ 3. site_invites — company-OR-token policy ════════════════════════════════
-- Invite acceptance is intentionally CROSS-COMPANY: an invitee reads an invite
-- (by unguessable token) that belongs to the company they are JOINING, not their
-- current one. A plain company_id policy would hide the invite from the very
-- person accepting it. So the READ (USING) branch also matches on the token,
-- which acceptSiteInvite supplies via `SET LOCAL app.invite_token = <token>`
-- inside its transaction. The token is unique, so the token branch grants
-- exactly the single named invite — never a wider read; unset -> NULL -> matches
-- nothing (fail-closed). WITH CHECK stays company-only: you cannot INSERT/UPDATE
-- an invite into another company via the token branch.
ALTER TABLE site_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_invites FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS site_invites_company_or_token ON site_invites;
CREATE POLICY site_invites_company_or_token ON site_invites
  USING (
    company_id = current_setting('app.company_id', true)
    OR token = current_setting('app.invite_token', true)
  )
  WITH CHECK (company_id = current_setting('app.company_id', true));
