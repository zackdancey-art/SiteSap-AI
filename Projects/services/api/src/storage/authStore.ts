import fs from "fs/promises";
import path from "path";
import { getPgPool } from "./postgres";

export type AuthUser = {
  email: string;
  passwordHash: string;
  phone: string | null;
  fullName: string;
  role: "worker" | "supervisor" | "admin";
  createdAt: string;
};

export type PendingRegistration = {
  email: string;
  passwordHash: string;
  phone: string;
  emailCode: string;
  smsCode: string;
  expiresAt: string;
  attempts: number;
};

export type PasswordResetRecord = {
  token: string;
  email: string;
  expiresAt: string;
};

type AuthMemoryJson = {
  users: AuthUser[];
  pending: PendingRegistration[];
  resetTokens: PasswordResetRecord[];
};

const memoryUsers = new Map<string, AuthUser>();
const memoryPending = new Map<string, PendingRegistration>();
const memoryResetTokens = new Map<string, PasswordResetRecord>();
let memoryLoaded = false;
let loadPromise: Promise<void> | null = null;
let persistQueue: Promise<void> = Promise.resolve();

function useDatabase() {
  return Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim());
}

function getStorePath() {
  return path.join(process.cwd(), "data", "auth-store.json");
}

function uniqueViolationError(message: string) {
  return { code: "23505", message };
}

function serializeMemory(): AuthMemoryJson {
  return {
    users: Array.from(memoryUsers.values()),
    pending: Array.from(memoryPending.values()),
    resetTokens: Array.from(memoryResetTokens.values()),
  };
}

async function ensureMemoryLoaded() {
  if (useDatabase() || memoryLoaded) return;
  if (!loadPromise) {
    loadPromise = (async () => {
      try {
        const raw = await fs.readFile(getStorePath(), "utf8");
        const parsed = JSON.parse(raw) as Partial<AuthMemoryJson>;
        for (const user of Array.isArray(parsed.users) ? parsed.users : []) {
          memoryUsers.set(user.email, user);
        }
        for (const pending of Array.isArray(parsed.pending) ? parsed.pending : []) {
          memoryPending.set(pending.email, pending);
        }
        for (const token of Array.isArray(parsed.resetTokens) ? parsed.resetTokens : []) {
          memoryResetTokens.set(token.token, token);
        }
      } catch (error) {
        const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code?: string }).code) : "";
        if (code !== "ENOENT") {
          console.warn("[auth] Failed to read fallback auth store; starting empty.", error);
        }
      }
      memoryLoaded = true;
    })().finally(() => {
      loadPromise = null;
    });
  }
  await loadPromise;
}

async function persistMemory() {
  if (useDatabase()) return;
  await ensureMemoryLoaded();
  persistQueue = persistQueue.then(async () => {
    const filepath = getStorePath();
    await fs.mkdir(path.dirname(filepath), { recursive: true });
    await fs.writeFile(filepath, JSON.stringify(serializeMemory(), null, 2), "utf8");
  });
  await persistQueue;
}

export async function initAuthSchema() {
  if (!useDatabase()) {
    await ensureMemoryLoaded();
    return;
  }

  await getPgPool().query(`
    CREATE TABLE IF NOT EXISTS auth_users (
      email TEXT PRIMARY KEY,
      password_hash TEXT NOT NULL,
      phone TEXT,
      full_name TEXT NOT NULL DEFAULT 'User',
      role TEXT NOT NULL DEFAULT 'worker',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await getPgPool().query(`
    ALTER TABLE auth_users
    ADD COLUMN IF NOT EXISTS full_name TEXT NOT NULL DEFAULT 'User'
  `);
  await getPgPool().query(`
    ALTER TABLE auth_users
    ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'worker'
  `);

  await getPgPool().query(`
    CREATE UNIQUE INDEX IF NOT EXISTS auth_users_phone_idx
      ON auth_users(phone)
      WHERE phone IS NOT NULL
  `);

  await getPgPool().query(`
    CREATE TABLE IF NOT EXISTS auth_pending_registrations (
      email TEXT PRIMARY KEY,
      password_hash TEXT NOT NULL,
      phone TEXT NOT NULL,
      email_code TEXT NOT NULL,
      sms_code TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await getPgPool().query(`
    CREATE TABLE IF NOT EXISTS auth_password_reset_tokens (
      token TEXT PRIMARY KEY,
      email TEXT NOT NULL REFERENCES auth_users(email) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

function mapUser(row: {
  email: string;
  password_hash: string;
  phone: string | null;
  full_name: string;
  role: "worker" | "supervisor" | "admin";
  created_at: Date;
}): AuthUser {
  return {
    email: row.email,
    passwordHash: row.password_hash,
    phone: row.phone,
    fullName: row.full_name,
    role: row.role,
    createdAt: row.created_at.toISOString(),
  };
}

function mapPending(row: {
  email: string;
  password_hash: string;
  phone: string;
  email_code: string;
  sms_code: string;
  expires_at: Date;
  attempts: number;
}): PendingRegistration {
  return {
    email: row.email,
    passwordHash: row.password_hash,
    phone: row.phone,
    emailCode: row.email_code,
    smsCode: row.sms_code,
    expiresAt: row.expires_at.toISOString(),
    attempts: row.attempts,
  };
}

export async function findUserByEmail(email: string): Promise<AuthUser | null> {
  if (!useDatabase()) {
    await ensureMemoryLoaded();
    return memoryUsers.get(email) ?? null;
  }

  const result = await getPgPool().query<{
    email: string;
    password_hash: string;
    phone: string | null;
    full_name: string;
    role: "worker" | "supervisor" | "admin";
    created_at: Date;
  }>(
    `SELECT email, password_hash, phone, full_name, role, created_at FROM auth_users WHERE email = $1 LIMIT 1`,
    [email]
  );
  if (result.rowCount === 0) {
    return null;
  }
  return mapUser(result.rows[0]);
}

export async function findUserByIdentifier(identifier: string, normalizedPhone: string): Promise<AuthUser | null> {
  if (!useDatabase()) {
    await ensureMemoryLoaded();
    const byEmail = memoryUsers.get(identifier);
    if (byEmail) {
      return byEmail;
    }
    const byPhone = Array.from(memoryUsers.values()).find((user) => user.phone === normalizedPhone);
    return byPhone ?? null;
  }

  const result = await getPgPool().query<{
    email: string;
    password_hash: string;
    phone: string | null;
    full_name: string;
    role: "worker" | "supervisor" | "admin";
    created_at: Date;
  }>(
    `
    SELECT email, password_hash, phone, full_name, role, created_at
    FROM auth_users
    WHERE email = $1 OR phone = $2
    LIMIT 1
  `,
    [identifier, normalizedPhone]
  );
  if (result.rowCount === 0) {
    return null;
  }
  return mapUser(result.rows[0]);
}

export async function createUser(
  email: string,
  passwordHash: string,
  phone: string | null,
  fullName: string,
  role: "worker" | "supervisor" | "admin"
) {
  if (!useDatabase()) {
    await ensureMemoryLoaded();
    if (memoryUsers.has(email)) {
      throw uniqueViolationError("auth_users_email");
    }
    if (phone) {
      const phoneConflict = Array.from(memoryUsers.values()).some((user) => user.phone === phone);
      if (phoneConflict) {
        throw uniqueViolationError("auth_users_phone");
      }
    }
    memoryUsers.set(email, {
      email,
      passwordHash,
      phone,
      fullName,
      role,
      createdAt: new Date().toISOString(),
    });
    await persistMemory();
    return;
  }

  await getPgPool().query(
    `
    INSERT INTO auth_users (email, password_hash, phone, full_name, role)
    VALUES ($1, $2, $3, $4, $5)
  `,
    [email, passwordHash, phone, fullName, role]
  );
}

export async function upsertPendingRegistration(
  email: string,
  passwordHash: string,
  phone: string,
  emailCode: string,
  smsCode: string,
  expiresAt: Date
) {
  if (!useDatabase()) {
    await ensureMemoryLoaded();
    memoryPending.set(email, {
      email,
      passwordHash,
      phone,
      emailCode,
      smsCode,
      expiresAt: expiresAt.toISOString(),
      attempts: 0,
    });
    await persistMemory();
    return;
  }

  await getPgPool().query(
    `
    INSERT INTO auth_pending_registrations (email, password_hash, phone, email_code, sms_code, expires_at, attempts)
    VALUES ($1, $2, $3, $4, $5, $6, 0)
    ON CONFLICT (email)
    DO UPDATE SET
      password_hash = EXCLUDED.password_hash,
      phone = EXCLUDED.phone,
      email_code = EXCLUDED.email_code,
      sms_code = EXCLUDED.sms_code,
      expires_at = EXCLUDED.expires_at,
      attempts = 0
  `,
    [email, passwordHash, phone, emailCode, smsCode, expiresAt.toISOString()]
  );
}

export async function getPendingRegistration(email: string): Promise<PendingRegistration | null> {
  if (!useDatabase()) {
    await ensureMemoryLoaded();
    return memoryPending.get(email) ?? null;
  }

  const result = await getPgPool().query<{
    email: string;
    password_hash: string;
    phone: string;
    email_code: string;
    sms_code: string;
    expires_at: Date;
    attempts: number;
  }>(
    `
    SELECT email, password_hash, phone, email_code, sms_code, expires_at, attempts
    FROM auth_pending_registrations
    WHERE email = $1
    LIMIT 1
  `,
    [email]
  );
  if (result.rowCount === 0) {
    return null;
  }
  return mapPending(result.rows[0]);
}

export async function incrementPendingAttempts(email: string): Promise<number> {
  if (!useDatabase()) {
    await ensureMemoryLoaded();
    const pending = memoryPending.get(email);
    if (!pending) {
      return 0;
    }
    pending.attempts += 1;
    memoryPending.set(email, pending);
    await persistMemory();
    return pending.attempts;
  }

  const result = await getPgPool().query<{ attempts: number }>(
    `
    UPDATE auth_pending_registrations
    SET attempts = attempts + 1
    WHERE email = $1
    RETURNING attempts
  `,
    [email]
  );
  if (result.rowCount === 0) {
    return 0;
  }
  return result.rows[0].attempts;
}

export async function deletePendingRegistration(email: string) {
  if (!useDatabase()) {
    await ensureMemoryLoaded();
    memoryPending.delete(email);
    await persistMemory();
    return;
  }
  await getPgPool().query(`DELETE FROM auth_pending_registrations WHERE email = $1`, [email]);
}

export async function createPasswordResetToken(token: string, email: string, expiresAt: Date) {
  if (!useDatabase()) {
    await ensureMemoryLoaded();
    memoryResetTokens.set(token, {
      token,
      email,
      expiresAt: expiresAt.toISOString(),
    });
    await persistMemory();
    return;
  }

  await getPgPool().query(
    `
    INSERT INTO auth_password_reset_tokens (token, email, expires_at)
    VALUES ($1, $2, $3)
  `,
    [token, email, expiresAt.toISOString()]
  );
}

export async function getPasswordResetToken(token: string): Promise<PasswordResetRecord | null> {
  if (!useDatabase()) {
    await ensureMemoryLoaded();
    return memoryResetTokens.get(token) ?? null;
  }

  const result = await getPgPool().query<{ token: string; email: string; expires_at: Date }>(
    `
    SELECT token, email, expires_at
    FROM auth_password_reset_tokens
    WHERE token = $1
    LIMIT 1
  `,
    [token]
  );

  if (result.rowCount === 0) {
    return null;
  }

  return {
    token: result.rows[0].token,
    email: result.rows[0].email,
    expiresAt: result.rows[0].expires_at.toISOString(),
  };
}

export async function deletePasswordResetToken(token: string) {
  if (!useDatabase()) {
    await ensureMemoryLoaded();
    memoryResetTokens.delete(token);
    await persistMemory();
    return;
  }
  await getPgPool().query(`DELETE FROM auth_password_reset_tokens WHERE token = $1`, [token]);
}

export async function updateUserPassword(email: string, passwordHash: string) {
  if (!useDatabase()) {
    await ensureMemoryLoaded();
    const user = memoryUsers.get(email);
    if (!user) {
      return;
    }
    memoryUsers.set(email, {
      ...user,
      passwordHash,
    });
    await persistMemory();
    return;
  }
  await getPgPool().query(`UPDATE auth_users SET password_hash = $2 WHERE email = $1`, [email, passwordHash]);
}

export async function updateUserProfile(
  email: string,
  patch: { fullName?: string; role?: "worker" | "supervisor" | "admin" }
) {
  if (!useDatabase()) {
    await ensureMemoryLoaded();
    const user = memoryUsers.get(email);
    if (!user) return null;
    const updated: AuthUser = {
      ...user,
      fullName: patch.fullName ?? user.fullName,
      role: patch.role ?? user.role,
    };
    memoryUsers.set(email, updated);
    await persistMemory();
    return updated;
  }
  const result = await getPgPool().query<{
    email: string;
    password_hash: string;
    phone: string | null;
    full_name: string;
    role: "worker" | "supervisor" | "admin";
    created_at: Date;
  }>(
    `UPDATE auth_users
     SET
      full_name = COALESCE($2, full_name),
      role = COALESCE($3, role)
     WHERE email = $1
     RETURNING email, password_hash, phone, full_name, role, created_at`,
    [email, patch.fullName ?? null, patch.role ?? null]
  );
  if (result.rowCount === 0) return null;
  return mapUser(result.rows[0]);
}

export async function purgeExpiredAuthRecords() {
  if (!useDatabase()) {
    await ensureMemoryLoaded();
    const now = Date.now();
    let changed = false;
    for (const [email, record] of memoryPending.entries()) {
      if (new Date(record.expiresAt).getTime() < now) {
        memoryPending.delete(email);
        changed = true;
      }
    }
    for (const [token, record] of memoryResetTokens.entries()) {
      if (new Date(record.expiresAt).getTime() < now) {
        memoryResetTokens.delete(token);
        changed = true;
      }
    }
    if (changed) {
      await persistMemory();
    }
    return;
  }

  await getPgPool().query(`DELETE FROM auth_pending_registrations WHERE expires_at < NOW()`);
  await getPgPool().query(`DELETE FROM auth_password_reset_tokens WHERE expires_at < NOW()`);
}

export async function resetAuthStoreForTests() {
  if (useDatabase()) {
    await getPgPool().query(`DELETE FROM auth_password_reset_tokens`);
    await getPgPool().query(`DELETE FROM auth_pending_registrations`);
    await getPgPool().query(`DELETE FROM auth_users`);
    return;
  }
  memoryUsers.clear();
  memoryPending.clear();
  memoryResetTokens.clear();
  memoryLoaded = true;
  try {
    await fs.rm(getStorePath(), { force: true });
  } catch {
    // ignore cleanup errors in tests
  }
}
