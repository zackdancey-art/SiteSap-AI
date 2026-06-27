-- Add token generation counter to auth_users.
-- Incrementing this invalidates all tokens issued with a previous generation,
-- enabling sign-out-all-devices without maintaining a blocklist.
-- Source: feature/soon-and-v2-features migration 006, renumbered to 012 for main's sequence
ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS token_generation INTEGER NOT NULL DEFAULT 0;
