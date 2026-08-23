-- Combined additive migration from the mobile UX-polish pass:
--   1. project_entries — optional hourly-notes template (Part 5b)
--   2. incidents      — persist the fields the API was silently DROPPING
--                       (data-loss bug) + WorkSafe NZ investigation fields (Part 2)
--   3. inspections    — defensible-inspection fields (Part 3)
--   4. inspection_signatures — NEW append-only, RLS-forced table with a
--                       DB-level immutability trigger (void-and-re-sign, never edit)
--
-- Additive + idempotent ONLY: ADD COLUMN IF NOT EXISTS / CREATE ... IF NOT EXISTS /
-- DROP ... IF EXISTS then CREATE. No column drops, no type changes on existing
-- columns. storage/migrate.ts wraps this file in its own BEGIN/COMMIT, so there
-- is deliberately no explicit transaction here.

-- ══ 1. project_entries — optional hourly-notes template (Part 5b) ══════════════
ALTER TABLE project_entries ADD COLUMN IF NOT EXISTS hourly_notes JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE project_entries ADD COLUMN IF NOT EXISTS notes_mode   TEXT  NOT NULL DEFAULT 'free';  -- 'free' | 'hourly'
-- Photo annotation (Part 5a) needs no DDL: derivative fields (kind, derivedFromId,
-- annotationVector) live inside the existing photos_json JSONB shape.

-- ══ 2. incidents — stop the data loss + WorkSafe NZ fields ═════════════════════
-- (a) Fields the incident form has always collected but the API never persisted:
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS time                TEXT;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS type                TEXT;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS location_area       TEXT;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS injured_role        TEXT;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS injured_employer    TEXT;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS nature_of_injury    TEXT;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS body_part           TEXT;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS treatment_required  TEXT;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS witnesses           TEXT;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS immediate_actions   TEXT;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS root_cause          TEXT;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS reported_by         TEXT;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS supervisor_notified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS supervisor_name     TEXT;
-- (b) New WorkSafe NZ investigation fields (Part 2 deferred):
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS property_damage       TEXT;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS first_aider_name      TEXT;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS contributing_factors  JSONB   NOT NULL DEFAULT '{}'::jsonb;  -- {environment,human,equipment,methods}
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS worksafe_notified     BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS worksafe_notified_at  TIMESTAMPTZ;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS worksafe_notified_how TEXT;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS investigator_name     TEXT;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS corrective_actions    JSONB   NOT NULL DEFAULT '[]'::jsonb;  -- [{action,owner,dueDate,status}]

-- Backfill corrective_actions from the legacy single corrective_action string as
-- the first list item. The legacy column is KEPT (additive) so nothing is
-- orphaned. Idempotent: only fills rows whose list is still empty, so re-running
-- changes nothing.
--
-- incidents is FORCE ROW LEVEL SECURITY (migration 019), which subjects even the
-- table owner to the policy. This migration runs as the owner with NO
-- app.company_id set, so current_setting('app.company_id', true) is NULL and a
-- plain UPDATE would match ZERO rows — silently backfilling nothing. Lift FORCE
-- for the owner-run backfill, then restore it (the H7-backfill pattern).
ALTER TABLE incidents NO FORCE ROW LEVEL SECURITY;
UPDATE incidents
SET corrective_actions = jsonb_build_array(
      jsonb_build_object('action', corrective_action, 'owner', '', 'dueDate', NULL, 'status', 'open'))
WHERE corrective_action IS NOT NULL
  AND corrective_action <> ''
  AND (corrective_actions IS NULL OR corrective_actions = '[]'::jsonb);
ALTER TABLE incidents FORCE ROW LEVEL SECURITY;

-- ══ 3. inspections — defensible-inspection fields (Part 3) ═════════════════════
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS scope              TEXT;
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS area_inspected     TEXT;
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS time               TEXT;
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS inspector_name     TEXT;
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS inspector_role     TEXT;
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS inspector_company  TEXT;
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS defects            JSONB   NOT NULL DEFAULT '[]'::jsonb;  -- [{description,severity,owner,dueDate,status}]
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS overall_outcome    TEXT;
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS follow_up_required BOOLEAN NOT NULL DEFAULT false;
-- Per-item photo + N/A result state live inside results_json (JSONB) — no DDL.

-- ══ 4. inspection_signatures — append-only, immutable, RLS-forced ══════════════
CREATE TABLE IF NOT EXISTS inspection_signatures (
  id             TEXT PRIMARY KEY,
  inspection_id  TEXT NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
  company_id     TEXT NOT NULL,
  role           TEXT NOT NULL,                  -- inspector | manager | client
  signer_name    TEXT NOT NULL,
  signed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  path           TEXT NOT NULL,                  -- SVG path data (offline, vector)
  view_box       TEXT NOT NULL,                  -- SVG viewBox for the path
  content_hash   TEXT NOT NULL,                  -- SHA-256 of the signed content
  snapshot       JSONB NOT NULL,                 -- exact content that was signed
  status         TEXT NOT NULL DEFAULT 'active', -- active | voided
  voided_at      TIMESTAMPTZ,
  voided_reason  TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_inspection_signatures_inspection ON inspection_signatures(inspection_id);

-- Company-scoped RLS: ENABLE + FORCE (the app connects as the table owner), and
-- fail-closed via current_setting('app.company_id', true) — an unscoped query
-- (no app.company_id set) matches zero rows. Same pattern as migrations 019/022.
ALTER TABLE inspection_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_signatures FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS inspection_signatures_company_isolation ON inspection_signatures;
CREATE POLICY inspection_signatures_company_isolation ON inspection_signatures
  USING (company_id = current_setting('app.company_id', true))
  WITH CHECK (company_id = current_setting('app.company_id', true));

-- Schema-level immutability. A signature's signed content can NEVER be edited in
-- place; the ONLY permitted UPDATE is the one-way void (status active->voided,
-- plus voided_at / voided_reason). Every immutable column is NOT NULL, so the
-- `<>` comparisons never see NULL. Voiding-and-re-signing = a new INSERT.
CREATE OR REPLACE FUNCTION inspection_signatures_immutable() RETURNS trigger AS $$
BEGIN
  IF NEW.id <> OLD.id
     OR NEW.inspection_id <> OLD.inspection_id
     OR NEW.company_id <> OLD.company_id
     OR NEW.role <> OLD.role
     OR NEW.signer_name <> OLD.signer_name
     OR NEW.signed_at <> OLD.signed_at
     OR NEW.path <> OLD.path
     OR NEW.view_box <> OLD.view_box
     OR NEW.content_hash <> OLD.content_hash
     OR NEW.snapshot::text <> OLD.snapshot::text
     OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'inspection_signatures are immutable; void and re-sign instead of editing';
  END IF;
  -- status may only ever be one of the two known states, and may only
  -- transition one-way active -> voided. A voided signature is then frozen
  -- entirely (append-only: re-signing is a new INSERT, never an in-place edit),
  -- so voided_at / voided_reason cannot be changed once set.
  IF NEW.status NOT IN ('active', 'voided') THEN
    RAISE EXCEPTION 'inspection_signatures.status must be active or voided';
  END IF;
  IF OLD.status = 'voided'
     AND (NEW.status <> 'voided'
          OR NEW.voided_at     IS DISTINCT FROM OLD.voided_at
          OR NEW.voided_reason IS DISTINCT FROM OLD.voided_reason) THEN
    RAISE EXCEPTION 'a voided inspection_signature is immutable; void is final';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_inspection_signatures_immutable ON inspection_signatures;
CREATE TRIGGER trg_inspection_signatures_immutable
  BEFORE UPDATE ON inspection_signatures
  FOR EACH ROW EXECUTE FUNCTION inspection_signatures_immutable();
