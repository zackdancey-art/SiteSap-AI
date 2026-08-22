import { v4 as uuidv4 } from "uuid";
import { getPgPool } from "./postgres";
import { Actor, isCrew } from "./actor";

export type InspectionTemplateRecord = {
  id: string;
  ownerEmail: string;
  companyId: string;
  name: string;
  items: string[];
  createdAt: string;
};

export type InspectionResultItem = {
  item: string;
  passed: boolean | null;
  notes: string;
};

export type InspectionDefectItem = {
  description: string;
  severity: string;
  owner: string;
  dueDate: string | null;
  status: string;
};

export type InspectionRecord = {
  id: string;
  ownerEmail: string;
  companyId: string;
  siteId: string;
  templateId: string | null;
  name: string;
  date: string;
  results: InspectionResultItem[];
  status: "pending" | "complete";
  createdAt: string;
  updatedAt?: string;
  deletedAt?: string | null;
  // Defensible-inspection fields (024):
  scope: string;
  areaInspected: string;
  time: string;
  inspectorName: string;
  inspectorRole: string;
  inspectorCompany: string;
  defects: InspectionDefectItem[];
  overallOutcome: string;
  followUpRequired: boolean;
};

function useDatabase() {
  return Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim());
}

function canAccess(actor: Actor, companyId: string, ownerEmail: string) {
  if (companyId !== actor.companyId) return false;
  if (!isCrew(actor)) return true;
  return actor.email === ownerEmail;
}

function crewScopeSql(actor: Actor, params: unknown[], hasSite: boolean): string | null {
  if (!isCrew(actor)) return null;
  params.push(actor.email);
  const p = params.length;
  return hasSite
    ? `(owner_email = $${p} OR site_id IN (SELECT site_id FROM site_members WHERE member_email = $${p}))`
    : `owner_email = $${p}`;
}

const memoryTemplates = new Map<string, InspectionTemplateRecord>();
const memoryInspections = new Map<string, InspectionRecord>();

// ─── Templates ──────────────────────────────────────────────────────────────

export async function listTemplates(actor: Actor): Promise<InspectionTemplateRecord[]> {
  if (!useDatabase()) {
    return Array.from(memoryTemplates.values()).filter((t) => canAccess(actor, t.companyId, t.ownerEmail));
  }
  const params: unknown[] = [actor.companyId];
  const conditions: string[] = [`company_id = $1`];
  const crew = crewScopeSql(actor, params, false);
  if (crew) conditions.push(crew);
  const result = await getPgPool().query(
    `SELECT id, owner_email, company_id, name, items_json, created_at FROM inspection_templates WHERE ${conditions.join(" AND ")} ORDER BY name`,
    params
  );
  return result.rows.map((row: { id: string; owner_email: string; company_id: string; name: string; items_json: string[]; created_at: Date }) => ({
    id: row.id, ownerEmail: row.owner_email, companyId: row.company_id, name: row.name,
    items: Array.isArray(row.items_json) ? row.items_json : [],
    createdAt: row.created_at.toISOString(),
  }));
}

export async function createTemplate(actor: Actor, name: string, items: string[]): Promise<InspectionTemplateRecord> {
  const record: InspectionTemplateRecord = { id: uuidv4(), ownerEmail: actor.email, companyId: actor.companyId, name, items, createdAt: new Date().toISOString() };
  if (!useDatabase()) { memoryTemplates.set(record.id, record); return record; }
  const result = await getPgPool().query(
    `INSERT INTO inspection_templates (id, owner_email, company_id, name, items_json) VALUES ($1,$2,$3,$4,$5::jsonb) RETURNING *`,
    [record.id, actor.email, actor.companyId, name, JSON.stringify(items)]
  );
  const row = result.rows[0];
  return { id: row.id, ownerEmail: row.owner_email, companyId: row.company_id, name: row.name, items: row.items_json, createdAt: row.created_at.toISOString() };
}

export async function deleteTemplate(actor: Actor, id: string): Promise<boolean> {
  if (!useDatabase()) {
    const existing = memoryTemplates.get(id);
    if (!existing || !canAccess(actor, existing.companyId, existing.ownerEmail)) return false;
    memoryTemplates.delete(id);
    return true;
  }
  const conditions = isCrew(actor) ? `id = $1 AND company_id = $2 AND owner_email = $3` : `id = $1 AND company_id = $2`;
  const params = isCrew(actor) ? [id, actor.companyId, actor.email] : [id, actor.companyId];
  const result = await getPgPool().query(`DELETE FROM inspection_templates WHERE ${conditions}`, params);
  return (result.rowCount ?? 0) > 0;
}

// ─── Inspections ─────────────────────────────────────────────────────────────

function mapInspection(row: {
  id: string; owner_email: string; company_id: string; site_id: string; template_id: string | null; name: string; date: string;
  results_json: InspectionResultItem[]; status: "pending" | "complete";
  created_at: Date; updated_at?: Date | null; deleted_at?: Date | null;
  scope?: string | null; area_inspected?: string | null; time?: string | null;
  inspector_name?: string | null; inspector_role?: string | null; inspector_company?: string | null;
  defects?: InspectionDefectItem[] | null; overall_outcome?: string | null; follow_up_required?: boolean | null;
}): InspectionRecord {
  return {
    id: row.id, ownerEmail: row.owner_email, companyId: row.company_id, siteId: row.site_id,
    templateId: row.template_id, name: row.name, date: row.date,
    results: Array.isArray(row.results_json) ? row.results_json : [],
    status: row.status, createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at ? row.updated_at.toISOString() : undefined,
    deletedAt: row.deleted_at ? row.deleted_at.toISOString() : null,
    scope: row.scope || "", areaInspected: row.area_inspected || "", time: row.time || "",
    inspectorName: row.inspector_name || "", inspectorRole: row.inspector_role || "",
    inspectorCompany: row.inspector_company || "",
    defects: Array.isArray(row.defects) ? row.defects : [],
    overallOutcome: row.overall_outcome || "", followUpRequired: row.follow_up_required ?? false,
  };
}

export async function listInspections(actor: Actor, siteId?: string): Promise<InspectionRecord[]> {
  if (!useDatabase()) {
    return Array.from(memoryInspections.values())
      .filter((i) => canAccess(actor, i.companyId, i.ownerEmail))
      .filter((i) => !i.deletedAt)
      .filter((i) => (siteId ? i.siteId === siteId : true))
      .sort((a, b) => b.date.localeCompare(a.date));
  }
  const params: unknown[] = [actor.companyId];
  const conditions = ["deleted_at IS NULL", `company_id = $1`];
  const crew = crewScopeSql(actor, params, true);
  if (crew) conditions.push(crew);
  if (siteId) { params.push(siteId); conditions.push(`site_id = $${params.length}`); }
  const result = await getPgPool().query(
    `SELECT * FROM inspections WHERE ${conditions.join(" AND ")} ORDER BY date DESC`,
    params
  );
  return result.rows.map(mapInspection);
}

export async function createInspection(actor: Actor, payload: Omit<InspectionRecord, "id" | "ownerEmail" | "companyId" | "createdAt" | "updatedAt" | "deletedAt">): Promise<InspectionRecord> {
  const record: InspectionRecord = { id: uuidv4(), ownerEmail: actor.email, companyId: actor.companyId, createdAt: new Date().toISOString(), ...payload };
  if (!useDatabase()) { memoryInspections.set(record.id, record); return record; }
  const result = await getPgPool().query(
    `INSERT INTO inspections (
       id, owner_email, company_id, site_id, template_id, name, date, results_json, status,
       scope, area_inspected, time, inspector_name, inspector_role, inspector_company,
       defects, overall_outcome, follow_up_required
     )
     VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,
       $10,$11,$12,$13,$14,$15,
       $16::jsonb,$17,$18
     ) RETURNING *`,
    [record.id, actor.email, actor.companyId, record.siteId, record.templateId ?? null, record.name, record.date,
     JSON.stringify(record.results), record.status,
     record.scope || null, record.areaInspected || null, record.time || null, record.inspectorName || null,
     record.inspectorRole || null, record.inspectorCompany || null,
     JSON.stringify(record.defects || []), record.overallOutcome || null, record.followUpRequired ?? false]
  );
  return mapInspection(result.rows[0]);
}

export async function updateInspection(actor: Actor, id: string, patch: { results?: InspectionResultItem[]; status?: "pending" | "complete" }): Promise<InspectionRecord | null> {
  if (!useDatabase()) {
    const existing = memoryInspections.get(id);
    if (!existing || !canAccess(actor, existing.companyId, existing.ownerEmail) || existing.deletedAt) return null;
    const updated = { ...existing, ...patch };
    memoryInspections.set(id, updated);
    return updated;
  }
  const result = await getPgPool().query(
    `UPDATE inspections SET
       results_json = COALESCE($3::jsonb, results_json),
       status = COALESCE($4, status),
       updated_at = NOW()
     WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL RETURNING *`,
    [id, actor.companyId, patch.results ? JSON.stringify(patch.results) : null, patch.status ?? null]
  );
  if (result.rowCount === 0) return null;
  return mapInspection(result.rows[0]);
}

export async function deleteInspection(actor: Actor, id: string): Promise<boolean> {
  if (!useDatabase()) {
    const existing = memoryInspections.get(id);
    if (!existing || !canAccess(actor, existing.companyId, existing.ownerEmail)) return false;
    memoryInspections.set(id, { ...existing, deletedAt: new Date().toISOString() });
    return true;
  }
  const result = await getPgPool().query(
    `UPDATE inspections SET deleted_at = NOW() WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL`,
    [id, actor.companyId]
  );
  return (result.rowCount ?? 0) > 0;
}
