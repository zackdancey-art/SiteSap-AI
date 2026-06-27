-- Invite tokens allow supervisors/admins to invite workers to the platform
-- Source: feature/soon-and-v2-features migration 008, renumbered to 013 for main's sequence

CREATE TABLE IF NOT EXISTS auth_invites (
  token      TEXT PRIMARY KEY,
  email      TEXT NOT NULL,
  full_name  TEXT NOT NULL DEFAULT '',
  role       TEXT NOT NULL DEFAULT 'worker',
  invited_by TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS auth_invites_email_idx ON auth_invites(email);
