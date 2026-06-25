-- Initial schema: auth and project tables

CREATE TABLE IF NOT EXISTS auth_users (
  email TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL,
  phone TEXT,
  full_name TEXT NOT NULL DEFAULT 'User',
  role TEXT NOT NULL DEFAULT 'worker',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS auth_users_phone_idx
  ON auth_users(phone)
  WHERE phone IS NOT NULL;

CREATE TABLE IF NOT EXISTS auth_pending_registrations (
  email TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL,
  phone TEXT NOT NULL,
  email_code TEXT NOT NULL,
  sms_code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auth_password_reset_tokens (
  token TEXT PRIMARY KEY,
  email TEXT NOT NULL REFERENCES auth_users(email) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_sites (
  id TEXT PRIMARY KEY,
  owner_email TEXT NOT NULL REFERENCES auth_users(email) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  client TEXT NOT NULL DEFAULT '',
  start_date TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_entries (
  id TEXT PRIMARY KEY,
  owner_email TEXT NOT NULL REFERENCES auth_users(email) ON DELETE CASCADE,
  site_id TEXT NOT NULL REFERENCES project_sites(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  location_address TEXT NOT NULL DEFAULT '',
  weather TEXT NOT NULL DEFAULT '',
  crew_count TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  photos_json JSONB NOT NULL DEFAULT '[]',
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_diaries (
  id TEXT PRIMARY KEY,
  owner_email TEXT NOT NULL REFERENCES auth_users(email) ON DELETE CASCADE,
  site_id TEXT NOT NULL REFERENCES project_sites(id) ON DELETE CASCADE,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'draft',
  summary TEXT NOT NULL DEFAULT '',
  report_period TEXT NOT NULL DEFAULT 'daily',
  full_report TEXT NOT NULL DEFAULT '',
  safety_checklist JSONB NOT NULL DEFAULT '[]',
  sections JSONB NOT NULL DEFAULT '[]'
);
