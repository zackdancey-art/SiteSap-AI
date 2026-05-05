-- Add token generation counter to auth_users.
-- Incrementing this invalidates all tokens issued with a previous generation,
-- enabling sign-out-all-devices without maintaining a blocklist.
ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS token_generation INTEGER NOT NULL DEFAULT 0;
