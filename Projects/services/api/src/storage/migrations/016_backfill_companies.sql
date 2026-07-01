-- Company + role-based access model (Part 1, Migration C)
-- Backfills companies from existing site owners, assigns every auth_user a
-- company_id + company_role, and asserts zero NULLs at the end.
--
-- Determinism: company ids are derived as 'company_' || md5(owner_email).
-- md5() is a Postgres built-in (no pgcrypto/uuid-ossp extension required),
-- and the derivation is stable across re-runs and easy to cross-reference in
-- the subsequent operational-table backfill (migration 017).
--
-- Country is seeded to '' — there is no existing users_au_nz / country column
-- in the schema (migration 006 only added per-entry compliance text fields).

-- Conflict audit table: records every user whose company assignment was
-- ambiguous (member of sites owned by 2+ companies). Nothing is silently
-- discarded — the chosen company + the rejected candidates are preserved.
CREATE TABLE IF NOT EXISTS company_backfill_conflicts (
  id                   TEXT PRIMARY KEY,
  user_email           TEXT NOT NULL,
  chosen_company_id    TEXT NOT NULL,
  conflict_company_ids TEXT[] NOT NULL DEFAULT '{}',
  reason               TEXT NOT NULL DEFAULT '',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 1. Create a company for each distinct site owner ─────────────────────────
INSERT INTO companies (id, name, country, owner_email, status)
SELECT
  'company_' || md5(ps.owner_email)             AS id,
  COALESCE(NULLIF(u.full_name, ''), 'User') || ' Company' AS name,
  ''                                            AS country,
  ps.owner_email                                AS owner_email,
  'active'                                       AS status
FROM (SELECT DISTINCT owner_email FROM project_sites) ps
LEFT JOIN auth_users u ON u.email = ps.owner_email
ON CONFLICT (id) DO NOTHING;

-- ── 2. Assign owner users to their company ───────────────────────────────────
-- Owners are the users who own at least one site. Map legacy role → company_role.
UPDATE auth_users u
SET
  company_id   = 'company_' || md5(u.email),
  company_role = CASE u.role
                   WHEN 'admin'      THEN 'owner'
                   WHEN 'supervisor' THEN 'manager'
                   ELSE 'crew'
                 END
WHERE u.email IN (SELECT DISTINCT owner_email FROM project_sites)
  AND u.company_id IS NULL;

-- Site owners are always at least 'owner' of the company they own, regardless
-- of legacy role (a site owner with legacy role 'worker' still owns a company).
UPDATE auth_users u
SET company_role = 'owner'
WHERE u.email IN (SELECT owner_email FROM companies WHERE owner_email IS NOT NULL)
  AND u.company_id = 'company_' || md5(u.email)
  AND u.company_role <> 'owner';

-- ── 3. Assign site members to a company ──────────────────────────────────────
-- A member's candidate companies are the companies owning the sites they belong
-- to. Tiebreak: company where the member has the most site_member rows; on tie,
-- the company reached via the site the member joined earliest.
--
-- 3a. Record conflicts (members spanning 2+ owner companies) for audit.
INSERT INTO company_backfill_conflicts (id, user_email, chosen_company_id, conflict_company_ids, reason)
SELECT
  'conflict_' || md5(sm.member_email) AS id,
  sm.member_email,
  (
    SELECT 'company_' || md5(ps2.owner_email)
    FROM site_members sm2
    JOIN project_sites ps2 ON ps2.id = sm2.site_id
    WHERE sm2.member_email = sm.member_email
    GROUP BY ps2.owner_email
    ORDER BY COUNT(*) DESC, MIN(sm2.joined_at) ASC
    LIMIT 1
  ) AS chosen_company_id,
  ARRAY(
    SELECT DISTINCT 'company_' || md5(ps3.owner_email)
    FROM site_members sm3
    JOIN project_sites ps3 ON ps3.id = sm3.site_id
    WHERE sm3.member_email = sm.member_email
  ) AS conflict_company_ids,
  'member of sites owned by multiple companies; chose most-sites then earliest-joined'
FROM site_members sm
JOIN project_sites ps ON ps.id = sm.site_id
JOIN auth_users au ON au.email = sm.member_email
WHERE au.company_id IS NULL
GROUP BY sm.member_email
HAVING COUNT(DISTINCT ps.owner_email) > 1
ON CONFLICT (id) DO NOTHING;

-- 3b. Assign each unassigned member to their winning company. Only touches
-- users with company_id IS NULL so owners assigned in step 2 are never
-- overwritten. Map legacy site-member role: worker→crew, supervisor→manager.
UPDATE auth_users au
SET
  company_id   = winner.chosen_company_id,
  company_role = CASE winner.top_role
                   WHEN 'supervisor' THEN 'manager'
                   ELSE 'crew'
                 END
FROM (
  SELECT
    sm.member_email,
    (
      SELECT 'company_' || md5(ps2.owner_email)
      FROM site_members sm2
      JOIN project_sites ps2 ON ps2.id = sm2.site_id
      WHERE sm2.member_email = sm.member_email
      GROUP BY ps2.owner_email
      ORDER BY COUNT(*) DESC, MIN(sm2.joined_at) ASC
      LIMIT 1
    ) AS chosen_company_id,
    (
      SELECT sm3.role
      FROM site_members sm3
      WHERE sm3.member_email = sm.member_email
      ORDER BY CASE sm3.role WHEN 'supervisor' THEN 0 ELSE 1 END, sm3.joined_at ASC
      LIMIT 1
    ) AS top_role
  FROM site_members sm
  GROUP BY sm.member_email
) winner
WHERE au.email = winner.member_email
  AND au.company_id IS NULL
  AND winner.chosen_company_id IS NOT NULL;

-- ── 4. Orphan users: create a solo company each and assign as owner ──────────
INSERT INTO companies (id, name, country, owner_email, status)
SELECT
  'company_' || md5(u.email),
  COALESCE(NULLIF(u.full_name, ''), 'User') || ' Company',
  '',
  u.email,
  'active'
FROM auth_users u
WHERE u.company_id IS NULL
ON CONFLICT (id) DO NOTHING;

UPDATE auth_users u
SET
  company_id   = 'company_' || md5(u.email),
  company_role = 'owner'
WHERE u.company_id IS NULL;

-- ── 5. Assert zero NULLs ─────────────────────────────────────────────────────
DO $$
DECLARE
  null_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_count FROM auth_users WHERE company_id IS NULL;
  IF null_count > 0 THEN
    RAISE EXCEPTION 'Backfill incomplete: % auth_users still have NULL company_id', null_count;
  END IF;
END $$;
