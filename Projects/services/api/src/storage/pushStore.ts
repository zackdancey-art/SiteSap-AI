import { v4 as uuidv4 } from "uuid";
import { getPgPool } from "./postgres";

export type PushTokenRecord = {
  id: string;
  ownerEmail: string;
  token: string;
  platform: string;
  createdAt: string;
};

function useDatabase() {
  return Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim());
}

const memoryTokens = new Map<string, PushTokenRecord>();

export async function initPushSchema() {
  if (!useDatabase()) return;
  await getPgPool().query(`
    CREATE TABLE IF NOT EXISTS push_tokens (
      id          TEXT PRIMARY KEY,
      owner_email TEXT NOT NULL REFERENCES auth_users(email) ON DELETE CASCADE,
      token       TEXT NOT NULL,
      platform    TEXT NOT NULL DEFAULT 'expo',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(owner_email, token)
    )
  `);
}

export async function upsertPushToken(ownerEmail: string, token: string, platform = "expo"): Promise<PushTokenRecord> {
  if (!useDatabase()) {
    const existing = Array.from(memoryTokens.values()).find(
      (t) => t.ownerEmail === ownerEmail && t.token === token
    );
    if (existing) return existing;
    const record: PushTokenRecord = { id: uuidv4(), ownerEmail, token, platform, createdAt: new Date().toISOString() };
    memoryTokens.set(record.id, record);
    return record;
  }
  const result = await getPgPool().query<{ id: string; owner_email: string; token: string; platform: string; created_at: Date }>(
    `INSERT INTO push_tokens (id, owner_email, token, platform)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (owner_email, token) DO UPDATE SET updated_at = NOW(), platform = EXCLUDED.platform
     RETURNING id, owner_email, token, platform, created_at`,
    [uuidv4(), ownerEmail, token, platform]
  );
  const row = result.rows[0];
  return { id: row.id, ownerEmail: row.owner_email, token: row.token, platform: row.platform, createdAt: row.created_at.toISOString() };
}

export async function deletePushToken(ownerEmail: string, token: string): Promise<boolean> {
  if (!useDatabase()) {
    for (const [id, record] of memoryTokens.entries()) {
      if (record.ownerEmail === ownerEmail && record.token === token) {
        memoryTokens.delete(id);
        return true;
      }
    }
    return false;
  }
  const result = await getPgPool().query(
    `DELETE FROM push_tokens WHERE owner_email = $1 AND token = $2`,
    [ownerEmail, token]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function getTokensForUser(ownerEmail: string): Promise<PushTokenRecord[]> {
  if (!useDatabase()) {
    return Array.from(memoryTokens.values()).filter((t) => t.ownerEmail === ownerEmail);
  }
  const result = await getPgPool().query<{ id: string; owner_email: string; token: string; platform: string; created_at: Date }>(
    `SELECT id, owner_email, token, platform, created_at FROM push_tokens WHERE owner_email = $1`,
    [ownerEmail]
  );
  return result.rows.map((row) => ({
    id: row.id, ownerEmail: row.owner_email, token: row.token,
    platform: row.platform, createdAt: row.created_at.toISOString(),
  }));
}

export async function getAllTokensForEmails(emails: string[]): Promise<PushTokenRecord[]> {
  if (emails.length === 0) return [];
  if (!useDatabase()) {
    const emailSet = new Set(emails);
    return Array.from(memoryTokens.values()).filter((t) => emailSet.has(t.ownerEmail));
  }
  const result = await getPgPool().query<{ id: string; owner_email: string; token: string; platform: string; created_at: Date }>(
    `SELECT id, owner_email, token, platform, created_at FROM push_tokens WHERE owner_email = ANY($1)`,
    [emails]
  );
  return result.rows.map((row) => ({
    id: row.id, ownerEmail: row.owner_email, token: row.token,
    platform: row.platform, createdAt: row.created_at.toISOString(),
  }));
}
