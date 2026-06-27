import { v4 as uuidv4 } from "uuid";
import { getPgPool } from "./postgres";
import { UserRole, isElevatedRole } from "../utils/authToken";

export type TimecardRecord = {
  id: string;
  ownerEmail: string;
  siteId: string;
  entryId: string | null;
  workerName: string;
  date: string;
  startTime?: string;
  endTime?: string;
  breakMinutes?: number;
  hoursRegular: number;
  hoursOvertime: number;
  trade: string;
  notes: string;
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

const memoryTimecards = new Map<string, TimecardRecord>();

function mapRow(row: {
  id: string; owner_email: string; site_id: string; entry_id: string | null;
  worker_name: string; date: string;
  start_time?: string | null; end_time?: string | null; break_minutes?: number | null;
  hours_regular: number; hours_overtime: number;
  trade: string | null; notes: string | null; created_at: Date;
  updated_at?: Date | null; deleted_at?: Date | null;
}): TimecardRecord {
  return {
    id: row.id, ownerEmail: row.owner_email, siteId: row.site_id, entryId: row.entry_id,
    workerName: row.worker_name, date: row.date,
    startTime: row.start_time ?? undefined,
    endTime: row.end_time ?? undefined,
    breakMinutes: row.break_minutes ?? undefined,
    hoursRegular: Number(row.hours_regular), hoursOvertime: Number(row.hours_overtime),
    trade: row.trade || "", notes: row.notes || "",
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at ? row.updated_at.toISOString() : undefined,
    deletedAt: row.deleted_at ? row.deleted_at.toISOString() : null,
  };
}

export async function listTimecards(actor: Actor, siteId?: string): Promise<TimecardRecord[]> {
  if (!useDatabase()) {
    return Array.from(memoryTimecards.values())
      .filter((t) => canAccess(actor, t.ownerEmail))
      .filter((t) => !t.deletedAt)
      .filter((t) => (siteId ? t.siteId === siteId : true))
      .sort((a, b) => b.date.localeCompare(a.date));
  }
  const conditions = ["deleted_at IS NULL"];
  const params: unknown[] = [];
  if (!isElevatedRole(actor.role)) { params.push(actor.email); conditions.push(`owner_email = $${params.length}`); }
  if (siteId) { params.push(siteId); conditions.push(`site_id = $${params.length}`); }
  const result = await getPgPool().query(
    `SELECT * FROM crew_timecards WHERE ${conditions.join(" AND ")} ORDER BY date DESC`,
    params
  );
  return result.rows.map(mapRow);
}

export async function createTimecard(actor: Actor, payload: Omit<TimecardRecord, "id" | "ownerEmail" | "createdAt" | "updatedAt" | "deletedAt">): Promise<TimecardRecord> {
  const record: TimecardRecord = { id: uuidv4(), ownerEmail: actor.email, createdAt: new Date().toISOString(), ...payload };
  if (!useDatabase()) { memoryTimecards.set(record.id, record); return record; }
  const result = await getPgPool().query(
    `INSERT INTO crew_timecards (id,owner_email,site_id,entry_id,worker_name,date,start_time,end_time,break_minutes,hours_regular,hours_overtime,trade,notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
    [record.id, actor.email, record.siteId, record.entryId ?? null, record.workerName, record.date,
     record.startTime ?? null, record.endTime ?? null, record.breakMinutes ?? null,
     record.hoursRegular, record.hoursOvertime, record.trade || null, record.notes || null]
  );
  return mapRow(result.rows[0]);
}

export async function deleteTimecard(actor: Actor, id: string): Promise<boolean> {
  if (!useDatabase()) {
    const existing = memoryTimecards.get(id);
    if (!existing || !canAccess(actor, existing.ownerEmail)) return false;
    memoryTimecards.set(id, { ...existing, deletedAt: new Date().toISOString() });
    return true;
  }
  const result = await getPgPool().query(
    `UPDATE crew_timecards SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  );
  return (result.rowCount ?? 0) > 0;
}
