import path from "path";
import { getPgPool } from "./postgres";
import { FileBackedStore } from "./fileStore";

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

export type InviteRecord = {
  token: string;
  email: string;
  fullName: string;
  role: "worker" | "supervisor";
  invitedBy: string;
  expiresAt: string;
  createdAt: string;
};

type AuthMemoryJson = {
  users: AuthUser[];
  pending: PendingRegistration[];
  resetTokens: PasswordResetRecord[];
  invites: InviteRecord[];
};

const memoryUsers = new Map<string, AuthUser>();
const memoryPending = new Map<string, PendingRegistration>();
const memoryResetTokens = new Map<string, PasswordResetRecord>();
const memoryInvites = new Map<string, InviteRecord>(); // keyed by token

function useDatabase() {
  return Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim());
}

function uniqueViolationError(message: string) {
  return { code: "23505", message };
}

const store = new FileBackedStore<Partial<AuthMemoryJson>>(
  path.join(process.cwd(), "data", "auth-store.json"),
  (parsed) => {
    for (const user of Array.isArray(parsed.users) ? parsed.users : []) {
      memoryUsers.set(user.email, user);
    }
    for (const pending of Array.isArray(parsed.pending) ? parsed.pending : []) {
      memoryPending.set(pending.email, pending);
    }
    for (const token of Array.isArray(parsed.resetTokens) ? parsed.resetTokens : []) {
      memoryResetTokens.set(token.token, token);
    }
    for (const invite of Array.isArray(parsed.invites) ? parsed.invites : []) {
      memoryInvites.set(invite.token, invite);
    }
  },
  () => ({
    users: Array.from(memoryUsers.values()),
    pending: Array.from(memoryPending.values()),
    resetTokens: Array.from(memoryResetTokens.values()),
    invites: Array.from(memoryInvites.values()),
  })
);

async function ensureMemoryLoaded() {
  if (useDatabase()) return;
  await store.ensureLoaded();
}

async function persistMemory() {
  if (useDatabase()) return;
  await store.persist();
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

  await getPgPool().query(`
    CREATE TABLE IF NOT EXISTS auth_invites (
      token TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      full_name TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT 'worker',
      invited_by TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await getPgPool().query(`CREATE UNIQUE INDEX IF NOT EXISTS auth_invites_email_idx ON auth_invites(email)`);
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
    for (const [token, invite] of memoryInvites.entries()) {
      if (new Date(invite.expiresAt).getTime() < now) {
        memoryInvites.delete(token);
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
  await getPgPool().query(`DELETE FROM auth_invites WHERE expires_at < NOW()`);
}

export async function deleteUserAccount(email: string): Promise<void> {
  if (!useDatabase()) {
    await ensureMemoryLoaded();
    memoryUsers.delete(email);
    memoryPending.delete(email);
    for (const [token, record] of memoryResetTokens.entries()) {
      if (record.email === email) memoryResetTokens.delete(token);
    }
    await persistMemory();
    return;
  }
  // Password reset tokens are deleted via CASCADE on auth_users
  await getPgPool().query(`DELETE FROM auth_pending_registrations WHERE email = $1`, [email]);
  await getPgPool().query(`DELETE FROM auth_users WHERE email = $1`, [email]);
}

// In-memory revocation map for file-backed / dev mode (email → generation)
const memoryTokenGenerations = new Map<string, number>();

export async function getTokenGeneration(email: string): Promise<number> {
  if (!useDatabase()) {
    return memoryTokenGenerations.get(email) ?? 0;
  }
  const result = await getPgPool().query<{ token_generation: number }>(
    `SELECT token_generation FROM auth_users WHERE email = $1`,
    [email]
  );
  return result.rows[0]?.token_generation ?? 0;
}

export async function incrementTokenGeneration(email: string): Promise<number> {
  if (!useDatabase()) {
    const next = (memoryTokenGenerations.get(email) ?? 0) + 1;
    memoryTokenGenerations.set(email, next);
    return next;
  }
  const result = await getPgPool().query<{ token_generation: number }>(
    `UPDATE auth_users SET token_generation = token_generation + 1 WHERE email = $1 RETURNING token_generation`,
    [email]
  );
  return result.rows[0]?.token_generation ?? 1;
}

export async function createInvite(
  token: string,
  email: string,
  fullName: string,
  role: "worker" | "supervisor",
  invitedBy: string,
  expiresAt: Date
): Promise<void> {
  const now = new Date().toISOString();
  if (!useDatabase()) {
    await ensureMemoryLoaded();
    memoryInvites.set(token, { token, email, fullName, role, invitedBy, expiresAt: expiresAt.toISOString(), createdAt: now });
    await persistMemory();
    return;
  }
  await getPgPool().query(
    `INSERT INTO auth_invites (token, email, full_name, role, invited_by, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (email) DO UPDATE SET token=EXCLUDED.token, full_name=EXCLUDED.full_name, role=EXCLUDED.role, invited_by=EXCLUDED.invited_by, expires_at=EXCLUDED.expires_at`,
    [token, email, fullName, role, invitedBy, expiresAt.toISOString()]
  );
}

export async function getInviteByToken(token: string): Promise<InviteRecord | null> {
  if (!useDatabase()) {
    await ensureMemoryLoaded();
    return memoryInvites.get(token) ?? null;
  }
  const result = await getPgPool().query<{
    token: string; email: string; full_name: string; role: "worker" | "supervisor";
    invited_by: string; expires_at: Date; created_at: Date;
  }>(
    `SELECT token, email, full_name, role, invited_by, expires_at, created_at FROM auth_invites WHERE token = $1`,
    [token]
  );
  if (result.rowCount === 0) return null;
  const r = result.rows[0];
  return { token: r.token, email: r.email, fullName: r.full_name, role: r.role, invitedBy: r.invited_by, expiresAt: r.expires_at.toISOString(), createdAt: r.created_at.toISOString() };
}

export async function deleteInviteByToken(token: string): Promise<void> {
  if (!useDatabase()) {
    await ensureMemoryLoaded();
    memoryInvites.delete(token);
    await persistMemory();
    return;
  }
  await getPgPool().query(`DELETE FROM auth_invites WHERE token = $1`, [token]);
}

export async function listInvitesByInviter(invitedBy: string): Promise<InviteRecord[]> {
  if (!useDatabase()) {
    await ensureMemoryLoaded();
    const now = Date.now();
    return Array.from(memoryInvites.values())
      .filter((inv) => inv.invitedBy === invitedBy && new Date(inv.expiresAt).getTime() > now)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  const result = await getPgPool().query<{
    token: string; email: string; full_name: string; role: "worker" | "supervisor";
    invited_by: string; expires_at: Date; created_at: Date;
  }>(
    `SELECT token, email, full_name, role, invited_by, expires_at, created_at FROM auth_invites WHERE invited_by = $1 AND expires_at > NOW() ORDER BY created_at DESC`,
    [invitedBy]
  );
  return result.rows.map((r) => ({ token: r.token, email: r.email, fullName: r.full_name, role: r.role, invitedBy: r.invited_by, expiresAt: r.expires_at.toISOString(), createdAt: r.created_at.toISOString() }));
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
  memoryInvites.clear();
  store.resetForTests();
}
