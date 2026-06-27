import { v4 as uuidv4 } from "uuid";
import { getPgPool } from "./postgres";
import { UserRole, isElevatedRole } from "../utils/authToken";

export type InspectionTemplateRecord = {
  id: string;
  ownerEmail: string;
  name: string;
  items: string[];
  createdAt: string;
};

export type InspectionResultItem = {
  item: string;
  passed: boolean | null;
  notes: string;
};

export type InspectionRecord = {
  id: string;
  ownerEmail: string;
  siteId: string;
  templateId: string | null;
  name: string;
  date: string;
  results: InspectionResultItem[];
  status: "pending" | "complete";
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

const memoryTemplates = new Map<string, InspectionTemplateRecord>();
const memoryInspections = new Map<string, InspectionRecord>();

// ─── Templates ──────────────────────────────────────────────────────────────

export async function listTemplates(actor: Actor): Promise<InspectionTemplateRecord[]> {
  if (!useDatabase()) {
    return Array.from(memoryTemplates.values()).filter((t) => canAccess(actor, t.ownerEmail));
  }
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (!isElevatedRole(actor.role)) { params.push(actor.email); conditions.push(`owner_email = $${params.length}`); }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const result = await getPgPool().query(
    `SELECT id, owner_email, name, items_json, created_at FROM inspection_templates ${where} ORDER BY name`,
    params
  );
  return result.rows.map((row: { id: string; owner_email: string; name: string; items_json: string[]; created_at: Date }) => ({
    id: row.id, ownerEmail: row.owner_email, name: row.name,
    items: Array.isArray(row.items_json) ? row.items_json : [],
    createdAt: row.created_at.toISOString(),
  }));
}

export async function createTemplate(actor: Actor, name: string, items: string[]): Promise<InspectionTemplateRecord> {
  const record: InspectionTemplateRecord = { id: uuidv4(), ownerEmail: actor.email, name, items, createdAt: new Date().toISOString() };
  if (!useDatabase()) { memoryTemplates.set(record.id, record); return record; }
  const result = await getPgPool().query(
    `INSERT INTO inspection_templates (id, owner_email, name, items_json) VALUES ($1,$2,$3,$4::jsonb) RETURNING *`,
    [record.id, actor.email, name, JSON.stringify(items)]
  );
  const row = result.rows[0];
  return { id: row.id, ownerEmail: row.owner_email, name: row.name, items: row.items_json, createdAt: row.created_at.toISOString() };
}

export async function deleteTemplate(actor: Actor, id: string): Promise<boolean> {
  if (!useDatabase()) {
    const existing = memoryTemplates.get(id);
    if (!existing || !canAccess(actor, existing.ownerEmail)) return false;
    memoryTemplates.delete(id);
    return true;
  }
  const result = await getPgPool().query(`DELETE FROM inspection_templates WHERE id = $1`, [id]);
  return (result.rowCount ?? 0) > 0;
}

// ─── Inspections ─────────────────────────────────────────────────────────────

function mapInspection(row: {
  id: string; owner_email: string; site_id: string; template_id: string | null; name: string; date: string;
  results_json: InspectionResultItem[]; status: "pending" | "complete";
  created_at: Date; updated_at?: Date | null; deleted_at?: Date | null;
}): InspectionRecord {
  return {
    id: row.id, ownerEmail: row.owner_email, siteId: row.site_id,
    templateId: row.template_id, name: row.name, date: row.date,
    results: Array.isArray(row.results_json) ? row.results_json : [],
    status: row.status, createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at ? row.updated_at.toISOString() : undefined,
    deletedAt: row.deleted_at ? row.deleted_at.toISOString() : null,
  };
}

export async function listInspections(actor: Actor, siteId?: string): Promise<InspectionRecord[]> {
  if (!useDatabase()) {
    return Array.from(memoryInspections.values())
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
    `SELECT * FROM inspections WHERE ${conditions.join(" AND ")} ORDER BY date DESC`,
    params
  );
  return result.rows.map(mapInspection);
}

export async function createInspection(actor: Actor, payload: Omit<InspectionRecord, "id" | "ownerEmail" | "createdAt" | "updatedAt" | "deletedAt">): Promise<InspectionRecord> {
  const record: InspectionRecord = { id: uuidv4(), ownerEmail: actor.email, createdAt: new Date().toISOString(), ...payload };
  if (!useDatabase()) { memoryInspections.set(record.id, record); return record; }
  const result = await getPgPool().query(
    `INSERT INTO inspections (id, owner_email, site_id, template_id, name, date, results_json, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8) RETURNING *`,
    [record.id, actor.email, record.siteId, record.templateId ?? null, record.name, record.date,
     JSON.stringify(record.results), record.status]
  );
  return mapInspection(result.rows[0]);
}

export async function updateInspection(actor: Actor, id: string, patch: { results?: InspectionResultItem[]; status?: "pending" | "complete" }): Promise<InspectionRecord | null> {
  if (!useDatabase()) {
    const existing = memoryInspections.get(id);
    if (!existing || !canAccess(actor, existing.ownerEmail) || existing.deletedAt) return null;
    const updated = { ...existing, ...patch };
    memoryInspections.set(id, updated);
    return updated;
  }
  const result = await getPgPool().query(
    `UPDATE inspections SET
       results_json = COALESCE($2::jsonb, results_json),
       status = COALESCE($3, status),
       updated_at = NOW()
     WHERE id = $1 AND deleted_at IS NULL RETURNING *`,
    [id, patch.results ? JSON.stringify(patch.results) : null, patch.status ?? null]
  );
  if (result.rowCount === 0) return null;
  return mapInspection(result.rows[0]);
}

export async function deleteInspection(actor: Actor, id: string): Promise<boolean> {
  if (!useDatabase()) {
    const existing = memoryInspections.get(id);
    if (!existing || !canAccess(actor, existing.ownerEmail)) return false;
    memoryInspections.set(id, { ...existing, deletedAt: new Date().toISOString() });
    return true;
  }
  const result = await getPgPool().query(
    `UPDATE inspections SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  );
  return (result.rowCount ?? 0) > 0;
}
