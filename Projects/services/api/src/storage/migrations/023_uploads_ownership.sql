-- Finding H7 — cross-tenant media access. Binds every upload to its owning
-- company in a place the requester cannot forge: a dedicated `uploads` table
-- written from the authenticated uploader's identity at POST /uploads, and
-- checked on the fetch + sign paths. (The prior attempt inferred ownership from
-- project_entries scoped to the CALLER's company — forgeable, because a caller
-- can write an entry in their own company referencing any upload id.)
--
-- Runs in one transaction (migrate.ts wraps each migration in BEGIN/COMMIT).

CREATE TABLE IF NOT EXISTS uploads (
  id          TEXT PRIMARY KEY,
  filename    TEXT NOT NULL DEFAULT '',
  company_id  TEXT NOT NULL,
  owner_email TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── One-time backfill for files uploaded before this table existed ───────────
-- Attribute each referenced upload id to the EARLIEST entry that references it
-- (the genuine uploader), so a forged later entry cannot claim ownership. The
-- upload id is embedded in each photo's storageKey ('uploads/<id>-<file>') or
-- uri ('/api/uploads/<id>/<file>'); the id is <digits>-<hex>.
--
-- project_entries is FORCE-RLS'd (migration 022), which applies even to the DB
-- owner running this migration, so lift FORCE for the read then restore it.
ALTER TABLE project_entries NO FORCE ROW LEVEL SECURITY;

INSERT INTO uploads (id, company_id, owner_email, created_at)
SELECT DISTINCT ON (x.upload_id)
  x.upload_id, e.company_id, e.owner_email, NOW()
FROM project_entries e
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(e.photos_json, '[]'::jsonb)) AS photo
CROSS JOIN LATERAL (
  SELECT COALESCE(
    substring(photo->>'storageKey' FROM 'uploads/([0-9]+-[0-9a-f]+)-'),
    substring(photo->>'uri'        FROM '/uploads/([0-9]+-[0-9a-f]+)/')
  ) AS upload_id
) x
WHERE x.upload_id IS NOT NULL
ORDER BY x.upload_id, e.created_at ASC
ON CONFLICT (id) DO NOTHING;

ALTER TABLE project_entries FORCE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_uploads_company ON uploads(company_id);

-- ── RLS (pattern from migration 019; FORCE because the app connects as owner) ──
ALTER TABLE uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE uploads FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS uploads_company_isolation ON uploads;
CREATE POLICY uploads_company_isolation ON uploads
  USING (company_id = current_setting('app.company_id', true))
  WITH CHECK (company_id = current_setting('app.company_id', true));
