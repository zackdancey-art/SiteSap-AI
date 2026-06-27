import { v4 as uuidv4 } from "uuid";
import { getPgPool } from "./postgres";
import { UserRole, isElevatedRole } from "../utils/authToken";

export type IncidentSeverity = "near-miss" | "minor" | "major" | "critical";
export type IncidentStatus = "open" | "closed";

export type IncidentRecord = {
  id: string;
  ownerEmail: string;
  siteId: string;
  date: string;
  severity: IncidentSeverity;
  description: string;
  injuredParty: string;
  correctiveAction: string;
  status: IncidentStatus;
  createdAt: string;
  updatedAt?: string;
  deletedAt?: string | null;
};

type Actor = { email: string; role: UserRole };

function useDatabase() {
  return Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim());
}

function canAccess(actor: Actor, ownerEmail: string) {
  return isElevatedRole(actor.role) || actor.email === ownerEmail;
}

const memoryIncidents = new Map<string, IncidentRecord>();

function mapRow(row: {
  id: string; owner_email: string; site_id: string; date: string;
  severity: IncidentSeverity; description: string; injured_party: string | null;
  corrective_action: string | null; status: IncidentStatus;
  created_at: Date; updated_at?: Date | null; deleted_at?: Date | null;
}): IncidentRecord {
  return {
    id: row.id, ownerEmail: row.owner_email, siteId: row.site_id, date: row.date,
    severity: row.severity, description: row.description,
    injuredParty: row.injured_party || "", correctiveAction: row.corrective_action || "",
    status: row.status, createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at ? row.updated_at.toISOString() : undefined,
    deletedAt: row.deleted_at ? row.deleted_at.toISOString() : null,
  };
}

export async function listIncidents(actor: Actor, siteId?: string): Promise<IncidentRecord[]> {
  if (!useDatabase()) {
    return Array.from(memoryIncidents.values())
      .filter((i) => canAccess(actor, i.ownerEmail))
      .filter((i) => !i.deletedAt)
      .filter((i) => (siteId ? i.siteId === siteId : true))
      .sort((a, b) => b.date.localeCompare(a.date));
  }
  const conditions = ["deleted_at IS NULL"];
  const params: unknown[] = [];
  if (!isElevatedRole(actor.role)) { params.push(actor.email); conditions.push(`owner_email = $${params.length}`); }
  if (siteId) { params.push(siteId); conditions.push(`site_id = $${params.length}`); }
  const result = await getPgPool().query(
    `SELECT * FROM incidents WHERE ${conditions.join(" AND ")} ORDER BY date DESC`,
    params
  );
  return result.rows.map(mapRow);
}

export async function createIncident(actor: Actor, payload: Omit<IncidentRecord, "id" | "ownerEmail" | "createdAt" | "updatedAt" | "deletedAt">): Promise<IncidentRecord> {
  const record: IncidentRecord = { id: uuidv4(), ownerEmail: actor.email, createdAt: new Date().toISOString(), ...payload };
  if (!useDatabase()) { memoryIncidents.set(record.id, record); return record; }
  const result = await getPgPool().query(
    `INSERT INTO incidents (id,owner_email,site_id,date,severity,description,injured_party,corrective_action,status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [record.id, actor.email, record.siteId, record.date, record.severity, record.description,
     record.injuredParty || null, record.correctiveAction || null, record.status]
  );
  return mapRow(result.rows[0]);
}

export async function updateIncident(actor: Actor, id: string, patch: Partial<Pick<IncidentRecord, "status" | "correctiveAction" | "severity">>): Promise<IncidentRecord | null> {
  if (!useDatabase()) {
    const existing = memoryIncidents.get(id);
    if (!existing || !canAccess(actor, existing.ownerEmail) || existing.deletedAt) return null;
    const updated = { ...existing, ...patch };
    memoryIncidents.set(id, updated);
    return updated;
  }
  const result = await getPgPool().query(
    `UPDATE incidents SET
       status = COALESCE($2, status),
       corrective_action = COALESCE($3, corrective_action),
       severity = COALESCE($4, severity),
       updated_at = NOW()
     WHERE id = $1 AND deleted_at IS NULL RETURNING *`,
    [id, patch.status ?? null, patch.correctiveAction ?? null, patch.severity ?? null]
  );
  if (result.rowCount === 0) return null;
  return mapRow(result.rows[0]);
}

export async function deleteIncident(actor: Actor, id: string): Promise<boolean> {
  if (!useDatabase()) {
    const existing = memoryIncidents.get(id);
    if (!existing || !canAccess(actor, existing.ownerEmail)) return false;
    memoryIncidents.set(id, { ...existing, deletedAt: new Date().toISOString() });
    return true;
  }
  const result = await getPgPool().query(
    `UPDATE incidents SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  );
  return (result.rowCount ?? 0) > 0;
}
