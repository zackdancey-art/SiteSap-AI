-- Pending invitations (not yet accepted)
CREATE TABLE IF NOT EXISTS site_invites (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES project_sites(id) ON DELETE CASCADE,
  invited_email TEXT NOT NULL,
  invited_by TEXT NOT NULL REFERENCES auth_users(email) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'worker',
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS site_invites_site_email
  ON site_invites(site_id, invited_email);

-- Accepted memberships
CREATE TABLE IF NOT EXISTS site_members (
  site_id TEXT NOT NULL REFERENCES project_sites(id) ON DELETE CASCADE,
  member_email TEXT NOT NULL REFERENCES auth_users(email) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'worker',
  invited_by TEXT NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (site_id, member_email)
);
CREATE INDEX IF NOT EXISTS idx_site_members_email
  ON site_members(member_email);
