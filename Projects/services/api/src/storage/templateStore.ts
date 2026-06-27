import { v4 as uuidv4 } from "uuid";
import { getPgPool } from "./postgres";
import { UserRole } from "../utils/authToken";

export type EntryTemplate = {
  id: string;
  ownerEmail: string;
  name: string;
  notes: string;
  crewCount: string;
  weather: string;
  createdAt: string;
};

type Actor = { email: string; role: UserRole };

const memory = new Map<string, EntryTemplate>();

function useDatabase() {
  return Boolean(process.env.DATABASE_URL?.trim());
}

function mapRow(row: {
  id: string; owner_email: string; name: string;
  notes: string; crew_count: string; weather: string; created_at: Date;
}): EntryTemplate {
  return {
    id: row.id,
    ownerEmail: row.owner_email,
    name: row.name,
    notes: row.notes,
    crewCount: row.crew_count,
    weather: row.weather,
    createdAt: row.created_at.toISOString(),
  };
}

export async function initTemplateSchema(): Promise<void> {
  if (!useDatabase()) return;
  await getPgPool().query(`
    CREATE TABLE IF NOT EXISTS entry_templates (
      id          TEXT PRIMARY KEY,
      owner_email TEXT NOT NULL REFERENCES auth_users(email) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      notes       TEXT NOT NULL DEFAULT '',
      crew_count  TEXT NOT NULL DEFAULT '',
      weather     TEXT NOT NULL DEFAULT '',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

export async function listTemplates(actor: Actor): Promise<EntryTemplate[]> {
  if (!useDatabase()) {
    return Array.from(memory.values())
      .filter((t) => t.ownerEmail === actor.email)
      .sort((a, b) => a.name.localeCompare(b.name));
  }
  const result = await getPgPool().query<{
    id: string; owner_email: string; name: string;
    notes: string; crew_count: string; weather: string; created_at: Date;
  }>(`SELECT * FROM entry_templates WHERE owner_email = $1 ORDER BY name ASC`, [actor.email]);
  return result.rows.map(mapRow);
}

export async function createTemplate(
  actor: Actor,
  payload: { name: string; notes: string; crewCount: string; weather: string }
): Promise<EntryTemplate> {
  const record: EntryTemplate = {
    id: uuidv4(),
    ownerEmail: actor.email,
    createdAt: new Date().toISOString(),
    ...payload,
  };
  if (!useDatabase()) {
    memory.set(record.id, record);
    return record;
  }
  const result = await getPgPool().query<{
    id: string; owner_email: string; name: string;
    notes: string; crew_count: string; weather: string; created_at: Date;
  }>(
    `INSERT INTO entry_templates (id, owner_email, name, notes, crew_count, weather)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [record.id, actor.email, payload.name, payload.notes, payload.crewCount, payload.weather]
  );
  return mapRow(result.rows[0]);
}

export async function deleteTemplate(actor: Actor, id: string): Promise<boolean> {
  if (!useDatabase()) {
    const existing = memory.get(id);
    if (!existing || existing.ownerEmail !== actor.email) return false;
    memory.delete(id);
    return true;
  }
  const result = await getPgPool().query(
    `DELETE FROM entry_templates WHERE id = $1 AND owner_email = $2`, [id, actor.email]
  );
  return (result.rowCount ?? 0) > 0;
}
