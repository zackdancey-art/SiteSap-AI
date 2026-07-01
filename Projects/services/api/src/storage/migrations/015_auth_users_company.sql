-- Company + role-based access model (Part 1, Migration B)
-- Adds company membership + company_role to auth_users.
-- The legacy `role` column is intentionally kept — it coexists with
-- company_role during the transition.
--
-- NO foreign key on company_id: soft relationship only. A company soft-cancel
-- (status='cancelled') must NOT cascade-delete its users (compliance).
ALTER TABLE auth_users
  ADD COLUMN IF NOT EXISTS company_id   TEXT,
  ADD COLUMN IF NOT EXISTS company_role TEXT NOT NULL DEFAULT 'crew'
    CHECK (company_role IN ('owner','manager','viewer','crew'));

CREATE INDEX IF NOT EXISTS idx_auth_users_company ON auth_users(company_id);
