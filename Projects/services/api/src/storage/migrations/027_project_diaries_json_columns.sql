-- 027: add the project_diaries JSONB columns the store actually writes.
--
-- Found by store-roundtrip.test.ts against a real Postgres: createDiary INSERTs
-- (and mapRow reads) safety_checklist_json and sections_json, but only
-- safety_checklist_json ever got created — via an inline `ADD COLUMN IF NOT
-- EXISTS` in initProjectSchema. sections_json was listed ONLY in that function's
-- `CREATE TABLE IF NOT EXISTS project_diaries`, which is a no-op because migration
-- 001 already created the table (with the older, unused `sections`/
-- `safety_checklist` columns). So sections_json never existed on any migrated
-- database, and every diary INSERT failed with `column "sections_json" does not
-- exist` — diary creation has been broken on Postgres, the same class as the
-- crew_timecards drift (026). The static column audit MISSED this because a
-- CREATE-TABLE-IF-NOT-EXISTS column list looks present on paper; only the real
-- INSERT against a booted DB reveals it.
--
-- This adds BOTH *_json columns via ADD COLUMN IF NOT EXISTS (safety_checklist_json
-- is already present, so that line is a no-op) so migrations alone are authoritative
-- for the diary write path — no longer dependent on the inline initProjectSchema
-- (see L12: the two-schema-source root cause). Additive + idempotent. The legacy
-- `sections`/`safety_checklist` columns are left in place; dropping those dead
-- columns is a separate, data-touching cleanup (L11).

ALTER TABLE project_diaries ADD COLUMN IF NOT EXISTS safety_checklist_json JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE project_diaries ADD COLUMN IF NOT EXISTS sections_json         JSONB NOT NULL DEFAULT '[]'::jsonb;
