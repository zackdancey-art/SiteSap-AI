import { v4 as uuidv4 } from "uuid";
import { getPgPool } from "./postgres";
import { UserRole, isElevatedRole } from "../utils/authToken";

export type DeliveryRecord = {
  id: string;
  ownerEmail: string;
  siteId: string;
  date: string;
  supplier: string;
  items: string[];
  quantity: string;
  notes: string;
  createdAt: string;
  deletedAt?: string | null;
};

type Actor = { email: string; role: UserRole };

const memory = new Map<string, DeliveryRecord>();

function useDatabase() {
  return Boolean(process.env.DATABASE_URL?.trim());
}

function canAccess(actor: Actor, ownerEmail: string) {
  return isElevatedRole(actor.role) || actor.email === ownerEmail;
}

function mapRow(row: {
  id: string; owner_email: string; site_id: string; date: string;
  supplier: string; items_json: string[]; quantity: string; notes: string;
  created_at: Date; deleted_at: Date | null;
}): DeliveryRecord {
  return {
    id: row.id,
    ownerEmail: row.owner_email,
    siteId: row.site_id,
    date: row.date,
    supplier: row.supplier,
    items: Array.isArray(row.items_json) ? row.items_json : [],
    quantity: row.quantity,
    notes: row.notes,
    createdAt: row.created_at.toISOString(),
    deletedAt: row.deleted_at ? row.deleted_at.toISOString() : null,
  };
}

export async function initDeliveriesSchema(): Promise<void> {
  if (!useDatabase()) return;
  await getPgPool().query(`
    CREATE TABLE IF NOT EXISTS material_deliveries (
      id           TEXT PRIMARY KEY,
      owner_email  TEXT NOT NULL REFERENCES auth_users(email) ON DELETE CASCADE,
      site_id      TEXT NOT NULL REFERENCES project_sites(id) ON DELETE CASCADE,
      date         TEXT NOT NULL,
      supplier     TEXT NOT NULL DEFAULT '',
      items_json   JSONB NOT NULL DEFAULT '[]'::jsonb,
      quantity     TEXT NOT NULL DEFAULT '',
      notes        TEXT NOT NULL DEFAULT '',
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at   TIMESTAMPTZ
    )
  `);
}

export async function listDeliveries(actor: Actor, siteId?: string): Promise<DeliveryRecord[]> {
  if (!useDatabase()) {
    return Array.from(memory.values())
      .filter((d) => canAccess(actor, d.ownerEmail) && !d.deletedAt)
      .filter((d) => (siteId ? d.siteId === siteId : true))
      .sort((a, b) => b.date.localeCompare(a.date));
  }
  const conditions: string[] = ["deleted_at IS NULL"];
  const params: unknown[] = [];
  if (!isElevatedRole(actor.role)) {
    params.push(actor.email);
    conditions.push(`owner_email = $${params.length}`);
  }
  if (siteId) {
    params.push(siteId);
    conditions.push(`site_id = $${params.length}`);
  }
  const result = await getPgPool().query<{
    id: string; owner_email: string; site_id: string; date: string;
    supplier: string; items_json: string[]; quantity: string; notes: string;
    created_at: Date; deleted_at: Date | null;
  }>(`SELECT * FROM material_deliveries WHERE ${conditions.join(" AND ")} ORDER BY date DESC`, params);
  return result.rows.map(mapRow);
}

export async function createDelivery(
  actor: Actor,
  payload: { siteId: string; date: string; supplier: string; items: string[]; quantity: string; notes: string }
): Promise<DeliveryRecord> {
  const record: DeliveryRecord = {
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
    id: string; owner_email: string; site_id: string; date: string;
    supplier: string; items_json: string[]; quantity: string; notes: string;
    created_at: Date; deleted_at: Date | null;
  }>(
    `INSERT INTO material_deliveries (id, owner_email, site_id, date, supplier, items_json, quantity, notes)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8) RETURNING *`,
    [record.id, actor.email, payload.siteId, payload.date, payload.supplier,
     JSON.stringify(payload.items), payload.quantity, payload.notes]
  );
  return mapRow(result.rows[0]);
}

export async function updateDelivery(
  actor: Actor,
  id: string,
  patch: Partial<Pick<DeliveryRecord, "date" | "supplier" | "items" | "quantity" | "notes">>
): Promise<DeliveryRecord | null> {
  if (!useDatabase()) {
    const existing = memory.get(id);
    if (!existing || !canAccess(actor, existing.ownerEmail) || existing.deletedAt) return null;
    const updated = { ...existing, ...patch };
    memory.set(id, updated);
    return updated;
  }
  const check = await getPgPool().query<{ owner_email: string }>(
    `SELECT owner_email FROM material_deliveries WHERE id = $1 AND deleted_at IS NULL LIMIT 1`, [id]
  );
  if (check.rowCount === 0 || !canAccess(actor, check.rows[0].owner_email)) return null;
  const result = await getPgPool().query<{
    id: string; owner_email: string; site_id: string; date: string;
    supplier: string; items_json: string[]; quantity: string; notes: string;
    created_at: Date; deleted_at: Date | null;
  }>(
    `UPDATE material_deliveries SET
       date     = COALESCE($2, date),
       supplier = COALESCE($3, supplier),
       items_json = COALESCE($4::jsonb, items_json),
       quantity = COALESCE($5, quantity),
       notes    = COALESCE($6, notes),
       updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [id, patch.date ?? null, patch.supplier ?? null,
     patch.items ? JSON.stringify(patch.items) : null,
     patch.quantity ?? null, patch.notes ?? null]
  );
  if (result.rowCount === 0) return null;
  return mapRow(result.rows[0]);
}

export async function deleteDelivery(actor: Actor, id: string): Promise<boolean> {
  if (!useDatabase()) {
    const existing = memory.get(id);
    if (!existing || !canAccess(actor, existing.ownerEmail)) return false;
    memory.set(id, { ...existing, deletedAt: new Date().toISOString() });
    return true;
  }
  const conditions = isElevatedRole(actor.role) ? `id = $1` : `id = $1 AND owner_email = $2`;
  const params = isElevatedRole(actor.role) ? [id] : [id, actor.email];
  const result = await getPgPool().query(
    `UPDATE material_deliveries SET deleted_at = NOW() WHERE ${conditions} AND deleted_at IS NULL`, params
  );
  return (result.rowCount ?? 0) > 0;
}
