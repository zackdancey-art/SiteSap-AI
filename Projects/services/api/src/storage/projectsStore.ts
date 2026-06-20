import path from "path";
import { v4 as uuidv4 } from "uuid";
import { getPgPool } from "./postgres";
import { UserRole, isElevatedRole } from "../utils/authToken";
import { FileBackedStore } from "./fileStore";

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
  createdAt: string;
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
  swmsRef?: string;
  hazardNotes?: string;
  toolboxTalk?: boolean;
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
  created_at: Date;
}): SiteRecord {
  return {
    id: row.id,
    ownerEmail: row.owner_email,
    name: row.name,
    address: row.address,
    client: row.client,
    startDate: row.start_date,
    status: row.status,
    createdAt: row.created_at.toISOString(),
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
  swms_ref?: string | null;
  hazard_notes?: string | null;
  toolbox_talk?: boolean | null;
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
    swmsRef: row.swms_ref ?? undefined,
    hazardNotes: row.hazard_notes ?? undefined,
    toolboxTalk: row.toolbox_talk ?? undefined,
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
  };
}

export async function listSites(actor: Actor, limit = 200, offset = 0): Promise<SiteRecord[]> {
  if (!useDatabase()) {
    await ensureMemoryLoaded();
    return Array.from(memory.sites.values())
      .filter((site) => canAccessOwner(actor, site.ownerEmail))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(offset, offset + limit);
  }
  const result = isElevatedRole(actor.role)
    ? await getPgPool().query<{
        id: string;
        owner_email: string;
        name: string;
        address: string;
        client: string;
        start_date: string;
        status: SiteStatus;
        created_at: Date;
      }>(`SELECT * FROM project_sites ORDER BY created_at DESC LIMIT $1 OFFSET $2`, [limit, offset])
    : await getPgPool().query<{
        id: string;
        owner_email: string;
        name: string;
        address: string;
        client: string;
        start_date: string;
        status: SiteStatus;
        created_at: Date;
      }>(
        `SELECT * FROM project_sites WHERE owner_email = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
        [actor.email, limit, offset]
      );
  return result.rows.map(mapSite);
}

export async function createSite(
  actor: Actor,
  payload: Omit<SiteRecord, "id" | "ownerEmail" | "createdAt">
): Promise<SiteRecord> {
  const site: SiteRecord = {
    id: uuidv4(),
    ownerEmail: actor.email,
    createdAt: new Date().toISOString(),
    ...payload,
  };
  if (!useDatabase()) {
    await ensureMemoryLoaded();
    memory.sites.set(site.id, site);
    await persistMemory();
    return site;
  }
  const result = await getPgPool().query<{
    id: string;
    owner_email: string;
    name: string;
    address: string;
    client: string;
    start_date: string;
    status: SiteStatus;
    created_at: Date;
  }>(
    `INSERT INTO project_sites (id, owner_email, name, address, client, start_date, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING *`,
    [site.id, actor.email, site.name, site.address, site.client, site.startDate, site.status]
  );
  return mapSite(result.rows[0]);
}

export async function deleteSite(actor: Actor, siteId: string): Promise<boolean> {
  if (!useDatabase()) {
    await ensureMemoryLoaded();
    const existing = memory.sites.get(siteId);
    if (!existing || !canAccessOwner(actor, existing.ownerEmail)) return false;
    memory.sites.delete(siteId);
    for (const [entryId, entry] of memory.entries.entries()) {
      if (entry.siteId === siteId) memory.entries.delete(entryId);
    }
    for (const [diaryId, diary] of memory.diaries.entries()) {
      if (diary.siteId === siteId) memory.diaries.delete(diaryId);
    }
    await persistMemory();
    return true;
  }
  const result = isElevatedRole(actor.role)
    ? await getPgPool().query(`DELETE FROM project_sites WHERE id = $1`, [siteId])
    : await getPgPool().query(`DELETE FROM project_sites WHERE id = $1 AND owner_email = $2`, [siteId, actor.email]);
  return (result.rowCount ?? 0) > 0;
}

export async function listEntries(actor: Actor, siteId?: string, limit = 200, offset = 0): Promise<EntryRecord[]> {
  if (!useDatabase()) {
    await ensureMemoryLoaded();
    return Array.from(memory.entries.values())
      .filter((entry) => canAccessOwner(actor, entry.ownerEmail))
      .filter((entry) => (siteId ? entry.siteId === siteId : true))
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(offset, offset + limit);
  }

  const queryParts: string[] = [];
  const params: unknown[] = [];
  if (!isElevatedRole(actor.role)) {
    params.push(actor.email);
    queryParts.push(`owner_email = $${params.length}`);
  }
  if (siteId) {
    params.push(siteId);
    queryParts.push(`site_id = $${params.length}`);
  }
  const where = queryParts.length > 0 ? `WHERE ${queryParts.join(" AND ")}` : "";
  params.push(limit, offset);
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
    swms_ref: string | null;
    hazard_notes: string | null;
    toolbox_talk: boolean | null;
  }>(
    `INSERT INTO project_entries
       (id, owner_email, site_id, date, location_address, weather, crew_count, notes, photos_json, swms_ref, hazard_notes, toolbox_talk)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12)
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
      entry.swmsRef ?? "",
      entry.hazardNotes ?? "",
      entry.toolboxTalk ?? false,
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
    swms_ref: string | null;
    hazard_notes: string | null;
    toolbox_talk: boolean | null;
  }>(
    `UPDATE project_entries
     SET
       date = COALESCE($2, date),
       location_address = COALESCE($3, location_address),
       weather = COALESCE($4, weather),
       crew_count = COALESCE($5, crew_count),
       notes = COALESCE($6, notes),
       photos_json = COALESCE($7::jsonb, photos_json),
       swms_ref = COALESCE($8, swms_ref),
       hazard_notes = COALESCE($9, hazard_notes),
       toolbox_talk = COALESCE($10, toolbox_talk),
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
      patch.swmsRef ?? null,
      patch.hazardNotes ?? null,
      patch.toolboxTalk ?? null,
    ]
  );
  if (result.rowCount === 0) return null;
  return mapEntry(result.rows[0]);
}

export async function deleteEntry(actor: Actor, entryId: string): Promise<boolean> {
  if (!useDatabase()) {
    await ensureMemoryLoaded();
    const existing = memory.entries.get(entryId);
    if (!existing || !canAccessOwner(actor, existing.ownerEmail)) return false;
    memory.entries.delete(entryId);
    await persistMemory();
    return true;
  }
  const result = isElevatedRole(actor.role)
    ? await getPgPool().query(`DELETE FROM project_entries WHERE id = $1`, [entryId])
    : await getPgPool().query(`DELETE FROM project_entries WHERE id = $1 AND owner_email = $2`, [entryId, actor.email]);
  return (result.rowCount ?? 0) > 0;
}

export async function listDiaries(actor: Actor, siteId?: string, limit = 200, offset = 0): Promise<DiaryRecord[]> {
  if (!useDatabase()) {
    await ensureMemoryLoaded();
    return Array.from(memory.diaries.values())
      .filter((diary) => canAccessOwner(actor, diary.ownerEmail))
      .filter((diary) => (siteId ? diary.siteId === siteId : true))
      .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt))
      .slice(offset, offset + limit);
  }
  const queryParts: string[] = [];
  const params: unknown[] = [];
  if (!isElevatedRole(actor.role)) {
    params.push(actor.email);
    queryParts.push(`owner_email = $${params.length}`);
  }
  if (siteId) {
    params.push(siteId);
    queryParts.push(`site_id = $${params.length}`);
  }
  const where = queryParts.length > 0 ? `WHERE ${queryParts.join(" AND ")}` : "";
  params.push(limit, offset);
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
  patch: Partial<Pick<DiaryRecord, "status" | "summary" | "reportPeriod" | "fullReport" | "safetyChecklist" | "sections">>
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
  }>(
    `UPDATE project_diaries
     SET
       status = COALESCE($2, status),
       summary = COALESCE($3, summary),
       report_period = COALESCE($4, report_period),
       full_report = COALESCE($5, full_report),
       safety_checklist_json = COALESCE($6::jsonb, safety_checklist_json),
       sections_json = COALESCE($7::jsonb, sections_json)
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
    ]
  );
  if (result.rowCount === 0) return null;
  return mapDiary(result.rows[0]);
}

export async function getScopedBootstrap(actor: Actor) {
  const [sites, entries, diaries] = await Promise.all([listSites(actor), listEntries(actor), listDiaries(actor)]);
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
    for (const [id, site] of memory.sites.entries()) {
      if (site.ownerEmail === email) memory.sites.delete(id);
    }
    for (const [id, entry] of memory.entries.entries()) {
      if (entry.ownerEmail === email) memory.entries.delete(id);
    }
    for (const [id, diary] of memory.diaries.entries()) {
      if (diary.ownerEmail === email) memory.diaries.delete(id);
    }
    await persistMemory();
    return;
  }
  // CASCADE constraints handle entries/diaries automatically on site delete
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
