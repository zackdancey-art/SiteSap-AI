import { v4 as uuidv4 } from "uuid";
import { getPgPool } from "./postgres";
import { Actor, isCrew } from "./actor";

export type IncidentSeverity = "near-miss" | "minor" | "major" | "critical";
export type IncidentStatus = "open" | "closed";

export type IncidentRecord = {
  id: string;
  ownerEmail: string;
  companyId: string;
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

function useDatabase() {
  return Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim());
}

// Company-scoped access for a row. Non-crew see everything in their company;
// crew see only rows they own (membership sharing is enforced in the DB path).
function canAccess(actor: Actor, companyId: string, ownerEmail: string) {
  if (companyId !== actor.companyId) return false;
  if (!isCrew(actor)) return true;
  return actor.email === ownerEmail;
}

const memoryIncidents = new Map<string, IncidentRecord>();

function mapRow(row: {
  id: string; owner_email: string; company_id: string; site_id: string; date: string;
  severity: IncidentSeverity; description: string; injured_party: string | null;
  corrective_action: string | null; status: IncidentStatus;
  created_at: Date; updated_at?: Date | null; deleted_at?: Date | null;
}): IncidentRecord {
  return {
    id: row.id, ownerEmail: row.owner_email, companyId: row.company_id, siteId: row.site_id, date: row.date,
    severity: row.severity, description: row.description,
    injuredParty: row.injured_party || "", correctiveAction: row.corrective_action || "",
    status: row.status, createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at ? row.updated_at.toISOString() : undefined,
    deletedAt: row.deleted_at ? row.deleted_at.toISOString() : null,
  };
}

// Crew scoping clause shared by list queries (DB path). Appends membership
// sharing so crew see their own + sites they are members of.
function crewScopeSql(actor: Actor, params: unknown[]): string | null {
  if (!isCrew(actor)) return null;
  params.push(actor.email);
  const p = params.length;
  return `(owner_email = $${p} OR site_id IN (SELECT site_id FROM site_members WHERE member_email = $${p}))`;
}

export async function listIncidents(actor: Actor, siteId?: string): Promise<IncidentRecord[]> {
  if (!useDatabase()) {
    return Array.from(memoryIncidents.values())
      .filter((i) => canAccess(actor, i.companyId, i.ownerEmail))
      .filter((i) => !i.deletedAt)
      .filter((i) => (siteId ? i.siteId === siteId : true))
      .sort((a, b) => b.date.localeCompare(a.date));
  }
  const params: unknown[] = [actor.companyId];
  const conditions = ["deleted_at IS NULL", `company_id = $1`];
  const crew = crewScopeSql(actor, params);
  if (crew) conditions.push(crew);
  if (siteId) { params.push(siteId); conditions.push(`site_id = $${params.length}`); }
  const result = await getPgPool().query(
    `SELECT * FROM incidents WHERE ${conditions.join(" AND ")} ORDER BY date DESC`,
    params
  );
  return result.rows.map(mapRow);
}

export async function createIncident(actor: Actor, payload: Omit<IncidentRecord, "id" | "ownerEmail" | "companyId" | "createdAt" | "updatedAt" | "deletedAt">): Promise<IncidentRecord> {
  const record: IncidentRecord = { id: uuidv4(), ownerEmail: actor.email, companyId: actor.companyId, createdAt: new Date().toISOString(), ...payload };
  if (!useDatabase()) { memoryIncidents.set(record.id, record); return record; }
  const result = await getPgPool().query(
    `INSERT INTO incidents (id,owner_email,company_id,site_id,date,severity,description,injured_party,corrective_action,status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [record.id, actor.email, actor.companyId, record.siteId, record.date, record.severity, record.description,
     record.injuredParty || null, record.correctiveAction || null, record.status]
  );
  return mapRow(result.rows[0]);
}

export async function updateIncident(actor: Actor, id: string, patch: Partial<Pick<IncidentRecord, "status" | "correctiveAction" | "severity">>): Promise<IncidentRecord | null> {
  if (!useDatabase()) {
    const existing = memoryIncidents.get(id);
    if (!existing || !canAccess(actor, existing.companyId, existing.ownerEmail) || existing.deletedAt) return null;
    const updated = { ...existing, ...patch };
    memoryIncidents.set(id, updated);
    return updated;
  }
  // Cross-company guard is enforced in the WHERE clause (company_id = actor).
  const result = await getPgPool().query(
    `UPDATE incidents SET
       status = COALESCE($3, status),
       corrective_action = COALESCE($4, corrective_action),
       severity = COALESCE($5, severity),
       updated_at = NOW()
     WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL RETURNING *`,
    [id, actor.companyId, patch.status ?? null, patch.correctiveAction ?? null, patch.severity ?? null]
  );
  if (result.rowCount === 0) return null;
  return mapRow(result.rows[0]);
}

export async function deleteIncident(actor: Actor, id: string): Promise<boolean> {
  if (!useDatabase()) {
    const existing = memoryIncidents.get(id);
    if (!existing || !canAccess(actor, existing.companyId, existing.ownerEmail)) return false;
    memoryIncidents.set(id, { ...existing, deletedAt: new Date().toISOString() });
    return true;
  }
  const result = await getPgPool().query(
    `UPDATE incidents SET deleted_at = NOW() WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL`,
    [id, actor.companyId]
  );
  return (result.rowCount ?? 0) > 0;
}
