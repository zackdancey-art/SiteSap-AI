import path from "path";
import { v4 as uuidv4 } from "uuid";
import { getPgPool } from "./postgres";
import { UserRole, isElevatedRole } from "../utils/authToken";
import { FileBackedStore } from "./fileStore";
import { getMediaStorage } from "./mediaStorage";

type SiteStatus = "active" | "completed" | "on-hold";
type DiaryStatus = "draft" | "approved";
type ReportPeriod = "daily" | "weekly" | "monthly";

export type SiteRecord = {
  id: string;
  ownerEmail: string;
  name: string;
  address: string;
  client: string;
  startDate: string;
  status: SiteStatus;
  progressPercent?: number;
  createdAt: string;
  updatedAt?: string;
  deletedAt?: string | null;
};

export type EntryRecord = {
  id: string;
  ownerEmail: string;
  siteId: string;
  date: string;
  locationAddress: string;
  weather: string;
  crewCount: string;
  notes: string;
  photos: Array<Record<string, unknown>>;
  timestamp: string;
  updatedAt?: string;
  deletedAt?: string | null;
};

export type DiaryRecord = {
  id: string;
  ownerEmail: string;
  siteId: string;
  generatedAt: string;
  status: DiaryStatus;
  summary: string;
  reportPeriod: ReportPeriod;
  fullReport: string;
  safetyChecklist: string[];
  sections: Array<Record<string, unknown>>;
  signedBy?: string | null;
  signedAt?: string | null;
  updatedAt?: string;
  deletedAt?: string | null;
};

type Actor = { email: string; role: UserRole };

type MemoryState = {
  sites: Map<string, SiteRecord>;
  entries: Map<string, EntryRecord>;
  diaries: Map<string, DiaryRecord>;
};

type MemoryJson = {
  sites: SiteRecord[];
  entries: EntryRecord[];
  diaries: DiaryRecord[];
};

const memory: MemoryState = {
  sites: new Map<string, SiteRecord>(),
  entries: new Map<string, EntryRecord>(),
  diaries: new Map<string, DiaryRecord>(),
};

function useDatabase() {
  return Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim());
}

function canAccessOwner(actor: Actor, ownerEmail: string) {
  return isElevatedRole(actor.role) || actor.email === ownerEmail;
}

const store = new FileBackedStore<Partial<MemoryJson>>(
  path.join(process.cwd(), "data", "projects-store.json"),
  (parsed) => {
    for (const site of Array.isArray(parsed.sites) ? parsed.sites : []) {
      memory.sites.set(site.id, site);
    }
    for (const entry of Array.isArray(parsed.entries) ? parsed.entries : []) {
      memory.entries.set(entry.id, entry);
    }
    for (const diary of Array.isArray(parsed.diaries) ? parsed.diaries : []) {
      memory.diaries.set(diary.id, diary);
    }
  },
  () => ({
    sites: Array.from(memory.sites.values()),
    entries: Array.from(memory.entries.values()),
    diaries: Array.from(memory.diaries.values()),
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

export async function initProjectSchema() {
  if (!useDatabase()) {
    await ensureMemoryLoaded();
    return;
  }

  await getPgPool().query(`
    CREATE TABLE IF NOT EXISTS project_sites (
      id TEXT PRIMARY KEY,
      owner_email TEXT NOT NULL REFERENCES auth_users(email) ON DELETE CASCADE,
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      client TEXT NOT NULL,
      start_date TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await getPgPool().query(`
    CREATE TABLE IF NOT EXISTS project_entries (
      id TEXT PRIMARY KEY,
      owner_email TEXT NOT NULL REFERENCES auth_users(email) ON DELETE CASCADE,
      site_id TEXT NOT NULL REFERENCES project_sites(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      location_address TEXT NOT NULL DEFAULT '',
      weather TEXT NOT NULL DEFAULT '',
      crew_count TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      photos_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await getPgPool().query(`
    CREATE TABLE IF NOT EXISTS project_diaries (
      id TEXT PRIMARY KEY,
      owner_email TEXT NOT NULL REFERENCES auth_users(email) ON DELETE CASCADE,
      site_id TEXT NOT NULL REFERENCES project_sites(id) ON DELETE CASCADE,
      generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      status TEXT NOT NULL DEFAULT 'draft',
      summary TEXT NOT NULL DEFAULT '',
      report_period TEXT NOT NULL DEFAULT 'daily',
      full_report TEXT NOT NULL DEFAULT '',
      safety_checklist_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      sections_json JSONB NOT NULL DEFAULT '[]'::jsonb
    )
  `);
  await getPgPool().query(`
    ALTER TABLE project_diaries
      ADD COLUMN IF NOT EXISTS report_period TEXT NOT NULL DEFAULT 'daily',
      ADD COLUMN IF NOT EXISTS full_report TEXT NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS safety_checklist_json JSONB NOT NULL DEFAULT '[]'::jsonb
  `);
}

function mapSite(row: {
  id: string;
  owner_email: string;
  name: string;
  address: string;
  client: string;
  start_date: string;
  status: SiteStatus;
  progress_percent?: number;
  created_at: Date;
  updated_at?: Date | null;
  deleted_at?: Date | null;
}): SiteRecord {
  return {
    id: row.id,
    ownerEmail: row.owner_email,
    name: row.name,
    address: row.address,
    client: row.client,
    startDate: row.start_date,
    status: row.status,
    progressPercent: row.progress_percent ?? 0,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at ? row.updated_at.toISOString() : undefined,
    deletedAt: row.deleted_at ? row.deleted_at.toISOString() : null,
  };
}

function mapEntry(row: {
  id: string;
  owner_email: string;
  site_id: string;
  date: string;
  location_address: string;
  weather: string;
  crew_count: string;
  notes: string;
  photos_json: Array<Record<string, unknown>>;
  timestamp: Date;
  updated_at?: Date | null;
  deleted_at?: Date | null;
}): EntryRecord {
  return {
    id: row.id,
    ownerEmail: row.owner_email,
    siteId: row.site_id,
    date: row.date,
    locationAddress: row.location_address,
    weather: row.weather,
    crewCount: row.crew_count,
    notes: row.notes,
    photos: row.photos_json,
    timestamp: row.timestamp.toISOString(),
    updatedAt: row.updated_at ? row.updated_at.toISOString() : undefined,
    deletedAt: row.deleted_at ? row.deleted_at.toISOString() : null,
  };
}

function mapDiary(row: {
  id: string;
  owner_email: string;
  site_id: string;
  generated_at: Date;
  status: DiaryStatus;
  summary: string;
  report_period: string;
  full_report: string;
  safety_checklist_json: string[] | null;
  sections_json: Array<Record<string, unknown>>;
  signed_by?: string | null;
  signed_at?: Date | null;
  updated_at?: Date | null;
  deleted_at?: Date | null;
}): DiaryRecord {
  const period: ReportPeriod =
    row.report_period === "weekly" || row.report_period === "monthly" ? row.report_period : "daily";
  return {
    id: row.id,
    ownerEmail: row.owner_email,
    siteId: row.site_id,
    generatedAt: row.generated_at.toISOString(),
    status: row.status,
    summary: row.summary,
    reportPeriod: period,
    fullReport: row.full_report || "",
    safetyChecklist: Array.isArray(row.safety_checklist_json) ? row.safety_checklist_json : [],
    sections: row.sections_json,
    signedBy: row.signed_by ?? null,
    signedAt: row.signed_at ? row.signed_at.toISOString() : null,
    updatedAt: row.updated_at ? row.updated_at.toISOString() : undefined,
    deletedAt: row.deleted_at ? row.deleted_at.toISOString() : null,
  };
}

export async function listSites(actor: Actor, limit = 200, offset = 0, since?: string): Promise<SiteRecord[]> {
  if (!useDatabase()) {
    await ensureMemoryLoaded();
    return Array.from(memory.sites.values())
      .filter((site) => canAccessOwner(actor, site.ownerEmail))
      .filter((site) => !site.deletedAt)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(offset, offset + limit);
  }
  const params: unknown[] = [];
  const conditions: string[] = ["deleted_at IS NULL"];
  if (!isElevatedRole(actor.role)) {
    params.push(actor.email);
    conditions.push(`owner_email = $${params.length}`);
  }
  if (since) {
    params.push(since);
    conditions.push(`updated_at > $${params.length}`);
  }
  const where = `WHERE ${conditions.join(" AND ")}`;
  params.push(limit, offset);
  const result = await getPgPool().query<{
    id: string; owner_email: string; name: string; address: string; client: string;
    start_date: string; status: SiteStatus; progress_percent: number;
    created_at: Date; updated_at: Date; deleted_at: Date | null;
  }>(`SELECT * FROM project_sites ${where} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
  return result.rows.map(mapSite);
}

export async function createSite(
  actor: Actor,
  payload: Omit<SiteRecord, "id" | "ownerEmail" | "createdAt" | "updatedAt" | "deletedAt">
): Promise<SiteRecord> {
  const site: SiteRecord = {
    id: uuidv4(),
    ownerEmail: actor.email,
    createdAt: new Date().toISOString(),
    ...payload,
    progressPercent: payload.progressPercent ?? 0,
  };
  if (!useDatabase()) {
    await ensureMemoryLoaded();
    memory.sites.set(site.id, site);
    await persistMemory();
    return site;
  }
  const result = await getPgPool().query<{
    id: string; owner_email: string; name: string; address: string; client: string;
    start_date: string; status: SiteStatus; progress_percent: number;
    created_at: Date; updated_at: Date; deleted_at: Date | null;
  }>(
    `INSERT INTO project_sites (id, owner_email, name, address, client, start_date, status, progress_percent)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING *`,
    [site.id, actor.email, site.name, site.address, site.client, site.startDate, site.status, site.progressPercent]
  );
  return mapSite(result.rows[0]);
}

export async function updateSiteProgress(actor: Actor, siteId: string, progressPercent: number): Promise<SiteRecord | null> {
  const pct = Math.max(0, Math.min(100, Math.round(progressPercent)));
  if (!useDatabase()) {
    await ensureMemoryLoaded();
    const existing = memory.sites.get(siteId);
    if (!existing || !canAccessOwner(actor, existing.ownerEmail) || existing.deletedAt) return null;
    const updated: SiteRecord = { ...existing, progressPercent: pct };
    memory.sites.set(siteId, updated);
    await persistMemory();
    return updated;
  }
  const result = await getPgPool().query<{
    id: string; owner_email: string; name: string; address: string; client: string;
    start_date: string; status: SiteStatus; progress_percent: number;
    created_at: Date; updated_at: Date; deleted_at: Date | null;
  }>(
    `UPDATE project_sites SET progress_percent = $2 WHERE id = $1 AND deleted_at IS NULL RETURNING *`,
    [siteId, pct]
  );
  if (result.rowCount === 0) return null;
  return mapSite(result.rows[0]);
}

export async function deleteSite(actor: Actor, siteId: string): Promise<boolean> {
  const now = new Date().toISOString();
  if (!useDatabase()) {
    await ensureMemoryLoaded();
    const existing = memory.sites.get(siteId);
    if (!existing || !canAccessOwner(actor, existing.ownerEmail)) return false;
    memory.sites.set(siteId, { ...existing, deletedAt: now });
    for (const [, entry] of memory.entries.entries()) {
      if (entry.siteId === siteId && !entry.deletedAt) {
        memory.entries.set(entry.id, { ...entry, deletedAt: now });
      }
    }
    for (const [, diary] of memory.diaries.entries()) {
      if (diary.siteId === siteId && !diary.deletedAt) {
        memory.diaries.set(diary.id, { ...diary, deletedAt: now });
      }
    }
    await persistMemory();
    return true;
  }
  const conditions = isElevatedRole(actor.role)
    ? `id = $1`
    : `id = $1 AND owner_email = $2`;
  const params = isElevatedRole(actor.role) ? [siteId] : [siteId, actor.email];
  const result = await getPgPool().query(
    `UPDATE project_sites SET deleted_at = NOW() WHERE ${conditions} AND deleted_at IS NULL`,
    params
  );
  if ((result.rowCount ?? 0) === 0) return false;
  await getPgPool().query(`UPDATE project_entries SET deleted_at = NOW() WHERE site_id = $1 AND deleted_at IS NULL`, [siteId]);
  await getPgPool().query(`UPDATE project_diaries SET deleted_at = NOW() WHERE site_id = $1 AND deleted_at IS NULL`, [siteId]);
  return true;
}

export async function listEntries(actor: Actor, siteId?: string, limit = 200, offset = 0, since?: string): Promise<EntryRecord[]> {
  if (!useDatabase()) {
    await ensureMemoryLoaded();
    return Array.from(memory.entries.values())
      .filter((entry) => canAccessOwner(actor, entry.ownerEmail))
      .filter((entry) => !entry.deletedAt)
      .filter((entry) => (siteId ? entry.siteId === siteId : true))
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(offset, offset + limit);
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
  if (since) {
    params.push(since);
    conditions.push(`updated_at > $${params.length}`);
  }
  const where = `WHERE ${conditions.join(" AND ")}`;
  params.push(limit, offset);
  const result = await getPgPool().query<{
    id: string; owner_email: string; site_id: string; date: string;
    location_address: string; weather: string; crew_count: string; notes: string;
    photos_json: Array<Record<string, unknown>>; timestamp: Date;
    updated_at: Date | null; deleted_at: Date | null;
  }>(`SELECT * FROM project_entries ${where} ORDER BY timestamp DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
  return result.rows.map(mapEntry);
}

export async function createEntry(
  actor: Actor,
  payload: Omit<EntryRecord, "id" | "ownerEmail" | "timestamp">
): Promise<EntryRecord> {
  const entry: EntryRecord = {
    id: uuidv4(),
    ownerEmail: actor.email,
    timestamp: new Date().toISOString(),
    ...payload,
  };
  if (!useDatabase()) {
    await ensureMemoryLoaded();
    memory.entries.set(entry.id, entry);
    await persistMemory();
    return entry;
  }
  const result = await getPgPool().query<{
    id: string;
    owner_email: string;
    site_id: string;
    date: string;
    location_address: string;
    weather: string;
    crew_count: string;
    notes: string;
    photos_json: Array<Record<string, unknown>>;
    timestamp: Date;
  }>(
    `INSERT INTO project_entries (id, owner_email, site_id, date, location_address, weather, crew_count, notes, photos_json)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
     RETURNING *`,
    [
      entry.id,
      actor.email,
      entry.siteId,
      entry.date,
      entry.locationAddress,
      entry.weather,
      entry.crewCount,
      entry.notes,
      JSON.stringify(entry.photos),
    ]
  );
  return mapEntry(result.rows[0]);
}

export async function updateEntry(
  actor: Actor,
  entryId: string,
  patch: Partial<Omit<EntryRecord, "id" | "ownerEmail" | "timestamp" | "siteId">>
): Promise<EntryRecord | null> {
  if (!useDatabase()) {
    await ensureMemoryLoaded();
    const current = memory.entries.get(entryId);
    if (!current || !canAccessOwner(actor, current.ownerEmail)) return null;
    const updated: EntryRecord = {
      ...current,
      ...patch,
      timestamp: new Date().toISOString(),
    };
    memory.entries.set(entryId, updated);
    await persistMemory();
    return updated;
  }
  const existingResult = await getPgPool().query<{ owner_email: string }>(
    `SELECT owner_email FROM project_entries WHERE id = $1 LIMIT 1`,
    [entryId]
  );
  if (existingResult.rowCount === 0) return null;
  const ownerEmail = existingResult.rows[0].owner_email;
  if (!canAccessOwner(actor, ownerEmail)) return null;

  const result = await getPgPool().query<{
    id: string;
    owner_email: string;
    site_id: string;
    date: string;
    location_address: string;
    weather: string;
    crew_count: string;
    notes: string;
    photos_json: Array<Record<string, unknown>>;
    timestamp: Date;
  }>(
    `UPDATE project_entries
     SET
       date = COALESCE($2, date),
       location_address = COALESCE($3, location_address),
       weather = COALESCE($4, weather),
       crew_count = COALESCE($5, crew_count),
       notes = COALESCE($6, notes),
       photos_json = COALESCE($7::jsonb, photos_json),
       timestamp = NOW()
     WHERE id = $1
     RETURNING *`,
    [
      entryId,
      patch.date ?? null,
      patch.locationAddress ?? null,
      patch.weather ?? null,
      patch.crewCount ?? null,
      patch.notes ?? null,
      patch.photos ? JSON.stringify(patch.photos) : null,
    ]
  );
  if (result.rowCount === 0) return null;
  return mapEntry(result.rows[0]);
}

async function cleanupEntryPhotos(photos: Array<Record<string, unknown>>) {
  const storage = getMediaStorage();
  await Promise.allSettled(
    photos
      .map((p) => String(p.storageKey || "").trim())
      .filter(Boolean)
      .map((key) => storage.deleteFile(key))
  );
}

export async function deleteEntry(actor: Actor, entryId: string): Promise<boolean> {
  const now = new Date().toISOString();
  if (!useDatabase()) {
    await ensureMemoryLoaded();
    const existing = memory.entries.get(entryId);
    if (!existing || !canAccessOwner(actor, existing.ownerEmail)) return false;
    await cleanupEntryPhotos(existing.photos);
    memory.entries.set(entryId, { ...existing, deletedAt: now });
    await persistMemory();
    return true;
  }
  const fetchResult = await getPgPool().query<{ photos_json: Array<Record<string, unknown>>; owner_email: string }>(
    `SELECT photos_json, owner_email FROM project_entries WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
    [entryId]
  );
  if (fetchResult.rowCount === 0) return false;
  if (!canAccessOwner(actor, fetchResult.rows[0].owner_email)) return false;
  await cleanupEntryPhotos(fetchResult.rows[0].photos_json);
  const result = await getPgPool().query(
    `UPDATE project_entries SET deleted_at = NOW() WHERE id = $1`,
    [entryId]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function listDiaries(actor: Actor, siteId?: string, limit = 200, offset = 0, since?: string): Promise<DiaryRecord[]> {
  if (!useDatabase()) {
    await ensureMemoryLoaded();
    return Array.from(memory.diaries.values())
      .filter((diary) => canAccessOwner(actor, diary.ownerEmail))
      .filter((diary) => !diary.deletedAt)
      .filter((diary) => (siteId ? diary.siteId === siteId : true))
      .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt))
      .slice(offset, offset + limit);
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
  if (since) {
    params.push(since);
    conditions.push(`updated_at > $${params.length}`);
  }
  const where = `WHERE ${conditions.join(" AND ")}`;
  params.push(limit, offset);
  const result = await getPgPool().query<{
    id: string; owner_email: string; site_id: string; generated_at: Date;
    status: DiaryStatus; summary: string; report_period: string; full_report: string;
    safety_checklist_json: string[] | null; sections_json: Array<Record<string, unknown>>;
    updated_at: Date | null; deleted_at: Date | null;
  }>(`SELECT * FROM project_diaries ${where} ORDER BY generated_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
  return result.rows.map(mapDiary);
}

export async function createDiary(
  actor: Actor,
  payload: Omit<DiaryRecord, "id" | "ownerEmail" | "generatedAt">
): Promise<DiaryRecord> {
  const diary: DiaryRecord = {
    id: uuidv4(),
    ownerEmail: actor.email,
    generatedAt: new Date().toISOString(),
    ...payload,
  };
  if (!useDatabase()) {
    await ensureMemoryLoaded();
    memory.diaries.set(diary.id, diary);
    await persistMemory();
    return diary;
  }
  const result = await getPgPool().query<{
    id: string;
    owner_email: string;
    site_id: string;
    generated_at: Date;
    status: DiaryStatus;
    summary: string;
    report_period: string;
    full_report: string;
    safety_checklist_json: string[] | null;
    sections_json: Array<Record<string, unknown>>;
  }>(
    `INSERT INTO project_diaries (
      id, owner_email, site_id, status, summary, report_period, full_report, safety_checklist_json, sections_json
    )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb)
     RETURNING *`,
    [
      diary.id,
      actor.email,
      diary.siteId,
      diary.status,
      diary.summary,
      diary.reportPeriod,
      diary.fullReport,
      JSON.stringify(diary.safetyChecklist),
      JSON.stringify(diary.sections),
    ]
  );
  return mapDiary(result.rows[0]);
}

export async function updateDiary(
  actor: Actor,
  diaryId: string,
  patch: Partial<Pick<DiaryRecord, "status" | "summary" | "reportPeriod" | "fullReport" | "safetyChecklist" | "sections" | "signedBy" | "signedAt">>
): Promise<DiaryRecord | null> {
  if (!useDatabase()) {
    await ensureMemoryLoaded();
    const current = memory.diaries.get(diaryId);
    if (!current || !canAccessOwner(actor, current.ownerEmail)) return null;
    const updated = { ...current, ...patch };
    memory.diaries.set(diaryId, updated);
    await persistMemory();
    return updated;
  }

  const existingResult = await getPgPool().query<{ owner_email: string }>(
    `SELECT owner_email FROM project_diaries WHERE id = $1 LIMIT 1`,
    [diaryId]
  );
  if (existingResult.rowCount === 0) return null;
  const ownerEmail = existingResult.rows[0].owner_email;
  if (!canAccessOwner(actor, ownerEmail)) return null;

  const result = await getPgPool().query<{
    id: string;
    owner_email: string;
    site_id: string;
    generated_at: Date;
    status: DiaryStatus;
    summary: string;
    report_period: string;
    full_report: string;
    safety_checklist_json: string[] | null;
    sections_json: Array<Record<string, unknown>>;
    signed_by: string | null;
    signed_at: Date | null;
  }>(
    `UPDATE project_diaries
     SET
       status = COALESCE($2, status),
       summary = COALESCE($3, summary),
       report_period = COALESCE($4, report_period),
       full_report = COALESCE($5, full_report),
       safety_checklist_json = COALESCE($6::jsonb, safety_checklist_json),
       sections_json = COALESCE($7::jsonb, sections_json),
       signed_by = COALESCE($8, signed_by),
       signed_at = COALESCE($9, signed_at)
     WHERE id = $1
     RETURNING *`,
    [
      diaryId,
      patch.status ?? null,
      patch.summary ?? null,
      patch.reportPeriod ?? null,
      patch.fullReport ?? null,
      patch.safetyChecklist ? JSON.stringify(patch.safetyChecklist) : null,
      patch.sections ? JSON.stringify(patch.sections) : null,
      patch.signedBy ?? null,
      patch.signedAt ?? null,
    ]
  );
  if (result.rowCount === 0) return null;
  return mapDiary(result.rows[0]);
}

export async function getScopedBootstrap(actor: Actor, since?: string) {
  const [sites, entries, diaries] = await Promise.all([
    listSites(actor, 200, 0, since),
    listEntries(actor, undefined, 200, 0, since),
    listDiaries(actor, undefined, 200, 0, since),
  ]);
  return { sites, entries, diaries };
}

export type SupervisorReportRow = {
  siteId: string;
  name: string;
  client: string;
  status: SiteStatus;
  ownerEmail: string;
  entries: number;
  diaries: number;
  approvedDiaries: number;
};

export async function getSupervisorReport(): Promise<SupervisorReportRow[]> {
  if (!useDatabase()) {
    await ensureMemoryLoaded();
    const sites = Array.from(memory.sites.values());
    const entries = Array.from(memory.entries.values());
    const diaries = Array.from(memory.diaries.values());
    return sites.map((site) => {
      const siteDiaries = diaries.filter((d) => d.siteId === site.id);
      return {
        siteId: site.id,
        name: site.name,
        client: site.client,
        status: site.status,
        ownerEmail: site.ownerEmail,
        entries: entries.filter((e) => e.siteId === site.id).length,
        diaries: siteDiaries.length,
        approvedDiaries: siteDiaries.filter((d) => d.status === "approved").length,
      };
    });
  }

  const result = await getPgPool().query<{
    site_id: string;
    name: string;
    client: string;
    status: SiteStatus;
    owner_email: string;
    entries: string;
    diaries: string;
    approved_diaries: string;
  }>(`
    SELECT
      s.id AS site_id,
      s.name,
      s.client,
      s.status,
      s.owner_email,
      COUNT(DISTINCT e.id) AS entries,
      COUNT(DISTINCT d.id) AS diaries,
      COUNT(DISTINCT CASE WHEN d.status = 'approved' THEN d.id END) AS approved_diaries
    FROM project_sites s
    LEFT JOIN project_entries e ON e.site_id = s.id
    LEFT JOIN project_diaries d ON d.site_id = s.id
    GROUP BY s.id, s.name, s.client, s.status, s.owner_email
    ORDER BY s.created_at DESC
  `);

  return result.rows.map((row) => ({
    siteId: row.site_id,
    name: row.name,
    client: row.client,
    status: row.status,
    ownerEmail: row.owner_email,
    entries: Number(row.entries),
    diaries: Number(row.diaries),
    approvedDiaries: Number(row.approved_diaries),
  }));
}

export async function deleteAllUserProjectData(email: string): Promise<void> {
  if (!useDatabase()) {
    await ensureMemoryLoaded();
    for (const [id, entry] of memory.entries.entries()) {
      if (entry.ownerEmail === email) {
        await cleanupEntryPhotos(entry.photos);
        memory.entries.delete(id);
      }
    }
    for (const [id, site] of memory.sites.entries()) {
      if (site.ownerEmail === email) memory.sites.delete(id);
    }
    for (const [id, diary] of memory.diaries.entries()) {
      if (diary.ownerEmail === email) memory.diaries.delete(id);
    }
    await persistMemory();
    return;
  }
  // Clean up stored media before deleting rows
  const entriesResult = await getPgPool().query<{ photos_json: Array<Record<string, unknown>> }>(
    `SELECT photos_json FROM project_entries WHERE owner_email = $1`,
    [email]
  );
  await Promise.allSettled(entriesResult.rows.map((row) => cleanupEntryPhotos(row.photos_json)));
  // CASCADE constraints handle entries/diaries automatically when sites are deleted
  await getPgPool().query(`DELETE FROM project_sites WHERE owner_email = $1`, [email]);
  await getPgPool().query(`DELETE FROM project_entries WHERE owner_email = $1`, [email]);
  await getPgPool().query(`DELETE FROM project_diaries WHERE owner_email = $1`, [email]);
}

export async function resetProjectStoreForTests() {
  if (useDatabase()) {
    await getPgPool().query(`DELETE FROM project_diaries`);
    await getPgPool().query(`DELETE FROM project_entries`);
    await getPgPool().query(`DELETE FROM project_sites`);
    return;
  }
  memory.sites.clear();
  memory.entries.clear();
  memory.diaries.clear();
  store.resetForTests();
}
