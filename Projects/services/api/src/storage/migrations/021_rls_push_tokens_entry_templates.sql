-- Company + role-based access model — Part 2, Migration C (findings H6 + H1).
-- Secures push_tokens and entry_templates with RLS (pattern from migration 019).
-- Both tables already exist (push_tokens: migration 009; entry_templates:
-- migration 010) and already have company_id NOT NULL (migration 017) — but
-- their store INSERTs never populated company_id, so every write has been
-- failing the NOT NULL constraint in production (H6). The matching code repair
-- (pushStore + templateStore: INSERT populates company_id, record carries it,
-- all DB queries run through withTenant) lands with this migration, because RLS's
-- WITH CHECK requires company_id = current_setting('app.company_id') on insert.
--
-- push_tokens is accessed only by pushStore; entry_templates only by
-- templateStore — both fully converted alongside this migration.

-- ── push_tokens ───────────────────────────────────────────────────────────────
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_tokens FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS push_tokens_company_isolation ON push_tokens;
CREATE POLICY push_tokens_company_isolation ON push_tokens
  USING (company_id = current_setting('app.company_id', true))
  WITH CHECK (company_id = current_setting('app.company_id', true));

-- ── entry_templates ───────────────────────────────────────────────────────────
ALTER TABLE entry_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE entry_templates FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS entry_templates_company_isolation ON entry_templates;
CREATE POLICY entry_templates_company_isolation ON entry_templates
  USING (company_id = current_setting('app.company_id', true))
  WITH CHECK (company_id = current_setting('app.company_id', true));
