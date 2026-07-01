-- Company + role-based access model (Part 1, Migration D)
-- Stamps company_id onto every operational table, backfilling from the parent
-- site (where a site_id exists) or the owner's user record, then makes the
-- column NOT NULL + indexed.
--
-- NO foreign key to companies from operational tables — soft relationship only
-- (compliance: a company soft-cancel must never cascade-delete records).

-- ── project_sites (root: backfill from owner) ────────────────────────────────
ALTER TABLE project_sites ADD COLUMN IF NOT EXISTS company_id TEXT;
UPDATE project_sites s SET company_id = u.company_id
  FROM auth_users u WHERE u.email = s.owner_email AND s.company_id IS NULL;
-- Fallback: any site whose owner is missing from auth_users → derive from owner_email.
UPDATE project_sites s SET company_id = 'company_' || md5(s.owner_email)
  WHERE s.company_id IS NULL;
ALTER TABLE project_sites ALTER COLUMN company_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_project_sites_company ON project_sites(company_id);

-- ── project_entries (via site, fallback owner) ───────────────────────────────
ALTER TABLE project_entries ADD COLUMN IF NOT EXISTS company_id TEXT;
UPDATE project_entries t SET company_id = s.company_id
  FROM project_sites s WHERE s.id = t.site_id AND t.company_id IS NULL;
UPDATE project_entries t SET company_id = u.company_id
  FROM auth_users u WHERE u.email = t.owner_email AND t.company_id IS NULL;
ALTER TABLE project_entries ALTER COLUMN company_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_project_entries_company ON project_entries(company_id);

-- ── project_diaries (via site, fallback owner) ───────────────────────────────
ALTER TABLE project_diaries ADD COLUMN IF NOT EXISTS company_id TEXT;
UPDATE project_diaries t SET company_id = s.company_id
  FROM project_sites s WHERE s.id = t.site_id AND t.company_id IS NULL;
UPDATE project_diaries t SET company_id = u.company_id
  FROM auth_users u WHERE u.email = t.owner_email AND t.company_id IS NULL;
ALTER TABLE project_diaries ALTER COLUMN company_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_project_diaries_company ON project_diaries(company_id);

-- ── project_templates (per-site; via site, fallback owner) ───────────────────
ALTER TABLE project_templates ADD COLUMN IF NOT EXISTS company_id TEXT;
UPDATE project_templates t SET company_id = s.company_id
  FROM project_sites s WHERE s.id = t.site_id AND t.company_id IS NULL;
UPDATE project_templates t SET company_id = u.company_id
  FROM auth_users u WHERE u.email = t.owner_email AND t.company_id IS NULL;
ALTER TABLE project_templates ALTER COLUMN company_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_project_templates_company ON project_templates(company_id);

-- ── entry_templates (per-user; no site_id → owner only) ──────────────────────
ALTER TABLE entry_templates ADD COLUMN IF NOT EXISTS company_id TEXT;
UPDATE entry_templates t SET company_id = u.company_id
  FROM auth_users u WHERE u.email = t.owner_email AND t.company_id IS NULL;
ALTER TABLE entry_templates ALTER COLUMN company_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_entry_templates_company ON entry_templates(company_id);

-- ── crew_timecards (via site, fallback owner) ────────────────────────────────
ALTER TABLE crew_timecards ADD COLUMN IF NOT EXISTS company_id TEXT;
UPDATE crew_timecards t SET company_id = s.company_id
  FROM project_sites s WHERE s.id = t.site_id AND t.company_id IS NULL;
UPDATE crew_timecards t SET company_id = u.company_id
  FROM auth_users u WHERE u.email = t.owner_email AND t.company_id IS NULL;
ALTER TABLE crew_timecards ALTER COLUMN company_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crew_timecards_company ON crew_timecards(company_id);

-- ── incidents (via site, fallback owner) ─────────────────────────────────────
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS company_id TEXT;
UPDATE incidents t SET company_id = s.company_id
  FROM project_sites s WHERE s.id = t.site_id AND t.company_id IS NULL;
UPDATE incidents t SET company_id = u.company_id
  FROM auth_users u WHERE u.email = t.owner_email AND t.company_id IS NULL;
ALTER TABLE incidents ALTER COLUMN company_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_incidents_company ON incidents(company_id);

-- ── inspection_templates (per-user; no site_id → owner only) ─────────────────
ALTER TABLE inspection_templates ADD COLUMN IF NOT EXISTS company_id TEXT;
UPDATE inspection_templates t SET company_id = u.company_id
  FROM auth_users u WHERE u.email = t.owner_email AND t.company_id IS NULL;
ALTER TABLE inspection_templates ALTER COLUMN company_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inspection_templates_company ON inspection_templates(company_id);

-- ── inspections (via site, fallback owner) ───────────────────────────────────
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS company_id TEXT;
UPDATE inspections t SET company_id = s.company_id
  FROM project_sites s WHERE s.id = t.site_id AND t.company_id IS NULL;
UPDATE inspections t SET company_id = u.company_id
  FROM auth_users u WHERE u.email = t.owner_email AND t.company_id IS NULL;
ALTER TABLE inspections ALTER COLUMN company_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inspections_company ON inspections(company_id);

-- ── material_deliveries (via site, fallback owner) ───────────────────────────
ALTER TABLE material_deliveries ADD COLUMN IF NOT EXISTS company_id TEXT;
UPDATE material_deliveries t SET company_id = s.company_id
  FROM project_sites s WHERE s.id = t.site_id AND t.company_id IS NULL;
UPDATE material_deliveries t SET company_id = u.company_id
  FROM auth_users u WHERE u.email = t.owner_email AND t.company_id IS NULL;
ALTER TABLE material_deliveries ALTER COLUMN company_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_material_deliveries_company ON material_deliveries(company_id);

-- ── push_tokens (per-user; no site_id → owner only) ──────────────────────────
ALTER TABLE push_tokens ADD COLUMN IF NOT EXISTS company_id TEXT;
UPDATE push_tokens t SET company_id = u.company_id
  FROM auth_users u WHERE u.email = t.owner_email AND t.company_id IS NULL;
ALTER TABLE push_tokens ALTER COLUMN company_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_push_tokens_company ON push_tokens(company_id);
