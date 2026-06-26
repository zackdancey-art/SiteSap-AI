import crypto from "crypto";
import path from "path";
import { v7 as uuidv7 } from "uuid";
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

export type DiaryEditLogEntry = {
  at: string;
  action: "approved" | "reverted" | "edited";
  by: string;
  note?: string;
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
  editLog: DiaryEditLogEntry[];
};

export type TemplateRecord = {
  id: string;
  ownerEmail: string;
  siteId: string;
  name: string;
  weather: string;
  crewCount: string;
  notesTemplate: string;
  createdAt: string;
};

export type SiteInviteRecord = {
  id: string;
  siteId: string;
  invitedEmail: string;
  invitedBy: string;
  role: string;
  token: string;
  expiresAt: string;
  createdAt: string;
};

export type SiteMemberRecord = {
  siteId: string;
  memberEmail: string;
  role: string;
  invitedBy: string;
  joinedAt: string;
};

export type InviteResult = {
  email: string;
  status: "sent" | "resent" | "already_member";
};

type Actor = { email: string; role: UserRole };

type MemoryState = {
  sites: Map<string, SiteRecord>;
  entries: Map<string, EntryRecord>;
  diaries: Map<string, DiaryRecord>;
  templates: Map<string, TemplateRecord>;
  siteInvites: Map<string, SiteInviteRecord>;  // key = token
  siteMembers: Map<string, SiteMemberRecord>;  // key = `${siteId}:${memberEmail}`
};

type MemoryJson = {
  sites: SiteRecord[];
  entries: EntryRecord[];
  diaries: DiaryRecord[];
  templates: TemplateRecord[];
  siteInvites?: SiteInviteRecord[];
  siteMembers?: SiteMemberRecord[];
};

const memory: MemoryState = {
  sites: new Map<string, SiteRecord>(),
  entries: new Map<string, EntryRecord>(),
  diaries: new Map<string, DiaryRecord>(),
  templates: new Map<string, TemplateRecord>(),
  siteInvites: new Map<string, SiteInviteRecord>(),
  siteMembers: new Map<string, SiteMemberRecord>(),
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
    for (const tmpl of Array.isArray(parsed.templates) ? parsed.templates : []) {
      memory.templates.set(tmpl.id, tmpl);
    }
    for (const inv of Array.isArray(parsed.siteInvites) ? parsed.siteInvites : []) {
      memory.siteInvites.set(inv.token, inv);
    }
    for (const mem of Array.isArray(parsed.siteMembers) ? parsed.siteMembers : []) {
      memory.siteMembers.set(`${mem.siteId}:${mem.memberEmail}`, mem);
    }
  },
  () => ({
    sites: Array.from(memory.sites.values()),
    entries: Array.from(memory.entries.values()),
    diaries: Array.from(memory.diaries.values()),
    templates: Array.from(memory.templates.values()),
    siteInvites: Array.from(memory.siteInvites.values()),
    siteMembers: Array.from(memory.siteMembers.values()),
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
  edit_log?: DiaryEditLogEntry[] | null;
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
    editLog: Array.isArray(row.edit_log) ? row.edit_log : [],
  };
}

export async function listSites(actor: Actor, limit = 200, offset = 0): Promise<SiteRecord[]> {
  if (!useDatabase()) {
    await ensureMemoryLoaded();
    const memberSiteIds = new Set(
      Array.from(memory.siteMembers.values())
        .filter((m) => m.memberEmail === actor.email)
        .map((m) => m.siteId)
    );
    return Array.from(memory.sites.values())
      .filter((site) => canAccessOwner(actor, site.ownerEmail) || memberSiteIds.has(site.id))
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
        `SELECT * FROM project_sites
         WHERE owner_email = $1
            OR id IN (SELECT site_id FROM site_members WHERE member_email = $1)
         ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
        [actor.email, limit, offset]
      );
  return result.rows.map(mapSite);
}

export async function createSite(
  actor: Actor,
  payload: Omit<SiteRecord, "id" | "ownerEmail" | "createdAt">
): Promise<SiteRecord> {
  const site: SiteRecord = {
    id: uuidv7(),
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
    id: uuidv7(),
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
  payload: Omit<DiaryRecord, "id" | "ownerEmail" | "generatedAt" | "editLog">
): Promise<DiaryRecord> {
  const diary: DiaryRecord = {
    id: uuidv7(),
    ownerEmail: actor.email,
    generatedAt: new Date().toISOString(),
    editLog: [],
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

function buildAuditEntry(
  current: DiaryRecord,
  patch: Partial<Pick<DiaryRecord, "status" | "summary" | "reportPeriod" | "fullReport" | "safetyChecklist" | "sections">>,
  actor: Actor,
  note?: string
): DiaryEditLogEntry | null {
  if (patch.status && patch.status !== current.status) {
    const action = patch.status === "approved" ? "approved" : "reverted";
    const entry: DiaryEditLogEntry = { at: new Date().toISOString(), action, by: actor.email };
    if (note) entry.note = note;
    return entry;
  }
  const contentChanged =
    (patch.summary !== undefined && patch.summary !== current.summary) ||
    (patch.fullReport !== undefined && patch.fullReport !== current.fullReport);
  if (contentChanged) {
    return { at: new Date().toISOString(), action: "edited", by: actor.email };
  }
  return null;
}

export async function updateDiary(
  actor: Actor,
  diaryId: string,
  patch: Partial<Pick<DiaryRecord, "status" | "summary" | "reportPeriod" | "fullReport" | "safetyChecklist" | "sections">>,
  note?: string
): Promise<DiaryRecord | null> {
  if (!useDatabase()) {
    await ensureMemoryLoaded();
    const current = memory.diaries.get(diaryId);
    if (!current || !canAccessOwner(actor, current.ownerEmail)) return null;
    const auditEntry = buildAuditEntry(current, patch, actor, note);
    const updated: DiaryRecord = {
      ...current,
      ...patch,
      editLog: auditEntry ? [...current.editLog, auditEntry] : current.editLog,
    };
    memory.diaries.set(diaryId, updated);
    await persistMemory();
    return updated;
  }

  const existingResult = await getPgPool().query<{
    owner_email: string;
    status: DiaryStatus;
    summary: string;
    full_report: string;
    edit_log: DiaryEditLogEntry[] | null;
  }>(
    `SELECT owner_email, status, summary, full_report, edit_log FROM project_diaries WHERE id = $1 LIMIT 1`,
    [diaryId]
  );
  if (existingResult.rowCount === 0) return null;
  const existing = existingResult.rows[0];
  if (!canAccessOwner(actor, existing.owner_email)) return null;

  const currentForAudit: DiaryRecord = {
    id: diaryId,
    ownerEmail: existing.owner_email,
    siteId: "",
    generatedAt: "",
    status: existing.status,
    summary: existing.summary,
    reportPeriod: "daily",
    fullReport: existing.full_report,
    safetyChecklist: [],
    sections: [],
    editLog: Array.isArray(existing.edit_log) ? existing.edit_log : [],
  };
  const auditEntry = buildAuditEntry(currentForAudit, patch, actor, note);

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
    edit_log: DiaryEditLogEntry[] | null;
  }>(
    `UPDATE project_diaries
     SET
       status = COALESCE($2, status),
       summary = COALESCE($3, summary),
       report_period = COALESCE($4, report_period),
       full_report = COALESCE($5, full_report),
       safety_checklist_json = COALESCE($6::jsonb, safety_checklist_json),
       sections_json = COALESCE($7::jsonb, sections_json),
       edit_log = CASE WHEN $8::jsonb IS NOT NULL THEN edit_log || $8::jsonb ELSE edit_log END
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
      auditEntry ? JSON.stringify([auditEntry]) : null,
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
    for (const [id, tmpl] of memory.templates.entries()) {
      if (tmpl.ownerEmail === email) memory.templates.delete(id);
    }
    await persistMemory();
    return;
  }
  // CASCADE constraints handle entries/diaries/templates automatically on site delete
  await getPgPool().query(`DELETE FROM project_sites WHERE owner_email = $1`, [email]);
  await getPgPool().query(`DELETE FROM project_entries WHERE owner_email = $1`, [email]);
  await getPgPool().query(`DELETE FROM project_diaries WHERE owner_email = $1`, [email]);
  await getPgPool().query(`DELETE FROM project_templates WHERE owner_email = $1`, [email]);
}

export async function resetProjectStoreForTests() {
  if (useDatabase()) {
    await getPgPool().query(`DELETE FROM site_members`);
    await getPgPool().query(`DELETE FROM site_invites`);
    await getPgPool().query(`DELETE FROM project_diaries`);
    await getPgPool().query(`DELETE FROM project_entries`);
    await getPgPool().query(`DELETE FROM project_templates`);
    await getPgPool().query(`DELETE FROM project_sites`);
    return;
  }
  memory.sites.clear();
  memory.entries.clear();
  memory.diaries.clear();
  memory.templates.clear();
  memory.siteInvites.clear();
  memory.siteMembers.clear();
  store.resetForTests();
}

// ─── Templates ───────────────────────────────────────────────────────────────

function mapTemplate(row: {
  id: string;
  owner_email: string;
  site_id: string;
  name: string;
  weather: string;
  crew_count: string;
  notes_template: string;
  created_at: Date;
}): TemplateRecord {
  return {
    id: row.id,
    ownerEmail: row.owner_email,
    siteId: row.site_id,
    name: row.name,
    weather: row.weather,
    crewCount: row.crew_count,
    notesTemplate: row.notes_template,
    createdAt: row.created_at.toISOString(),
  };
}

export async function listTemplates(actor: Actor, siteId?: string): Promise<TemplateRecord[]> {
  if (!useDatabase()) {
    await ensureMemoryLoaded();
    return Array.from(memory.templates.values())
      .filter((t) => canAccessOwner(actor, t.ownerEmail))
      .filter((t) => (siteId ? t.siteId === siteId : true))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
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
  const result = await getPgPool().query<{
    id: string; owner_email: string; site_id: string; name: string;
    weather: string; crew_count: string; notes_template: string; created_at: Date;
  }>(`SELECT * FROM project_templates ${where} ORDER BY created_at DESC`, params);
  return result.rows.map(mapTemplate);
}

export async function createTemplate(
  actor: Actor,
  payload: Pick<TemplateRecord, "siteId" | "name" | "weather" | "crewCount" | "notesTemplate">
): Promise<TemplateRecord> {
  const tmpl: TemplateRecord = {
    id: uuidv7(),
    ownerEmail: actor.email,
    createdAt: new Date().toISOString(),
    ...payload,
  };
  if (!useDatabase()) {
    await ensureMemoryLoaded();
    memory.templates.set(tmpl.id, tmpl);
    await persistMemory();
    return tmpl;
  }
  const result = await getPgPool().query<{
    id: string; owner_email: string; site_id: string; name: string;
    weather: string; crew_count: string; notes_template: string; created_at: Date;
  }>(
    `INSERT INTO project_templates (id, owner_email, site_id, name, weather, crew_count, notes_template)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING *`,
    [tmpl.id, actor.email, tmpl.siteId, tmpl.name, tmpl.weather, tmpl.crewCount, tmpl.notesTemplate]
  );
  return mapTemplate(result.rows[0]);
}

export async function updateTemplate(
  actor: Actor,
  templateId: string,
  patch: Partial<Pick<TemplateRecord, "name" | "weather" | "crewCount" | "notesTemplate">>
): Promise<TemplateRecord | null> {
  if (!useDatabase()) {
    await ensureMemoryLoaded();
    const current = memory.templates.get(templateId);
    if (!current || !canAccessOwner(actor, current.ownerEmail)) return null;
    const updated = { ...current, ...patch };
    memory.templates.set(templateId, updated);
    await persistMemory();
    return updated;
  }
  const existing = await getPgPool().query<{ owner_email: string }>(
    `SELECT owner_email FROM project_templates WHERE id = $1 LIMIT 1`,
    [templateId]
  );
  if (existing.rowCount === 0) return null;
  if (!canAccessOwner(actor, existing.rows[0].owner_email)) return null;
  const result = await getPgPool().query<{
    id: string; owner_email: string; site_id: string; name: string;
    weather: string; crew_count: string; notes_template: string; created_at: Date;
  }>(
    `UPDATE project_templates
     SET name = COALESCE($2, name),
         weather = COALESCE($3, weather),
         crew_count = COALESCE($4, crew_count),
         notes_template = COALESCE($5, notes_template)
     WHERE id = $1
     RETURNING *`,
    [templateId, patch.name ?? null, patch.weather ?? null, patch.crewCount ?? null, patch.notesTemplate ?? null]
  );
  if (result.rowCount === 0) return null;
  return mapTemplate(result.rows[0]);
}

export async function deleteTemplate(actor: Actor, templateId: string): Promise<boolean> {
  if (!useDatabase()) {
    await ensureMemoryLoaded();
    const tmpl = memory.templates.get(templateId);
    if (!tmpl || !canAccessOwner(actor, tmpl.ownerEmail)) return false;
    memory.templates.delete(templateId);
    await persistMemory();
    return true;
  }
  const existing = await getPgPool().query<{ owner_email: string }>(
    `SELECT owner_email FROM project_templates WHERE id = $1 LIMIT 1`,
    [templateId]
  );
  if (existing.rowCount === 0) return false;
  if (!canAccessOwner(actor, existing.rows[0].owner_email)) return false;
  const result = await getPgPool().query(
    `DELETE FROM project_templates WHERE id = $1`,
    [templateId]
  );
  return (result.rowCount ?? 0) > 0;
}

// ─── Site invites & members ───────────────────────────────────────────────────

function generateInviteToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

async function canManageSite(actor: Actor, siteId: string): Promise<boolean> {
  if (isElevatedRole(actor.role)) return true;
  if (!useDatabase()) {
    await ensureMemoryLoaded();
    const site = memory.sites.get(siteId);
    return site?.ownerEmail === actor.email;
  }
  const r = await getPgPool().query<{ owner_email: string }>(
    `SELECT owner_email FROM project_sites WHERE id = $1 LIMIT 1`,
    [siteId]
  );
  return r.rows[0]?.owner_email === actor.email;
}

export async function createSiteInvites(
  actor: Actor,
  siteId: string,
  emails: string[],
  role: string
): Promise<InviteResult[] | null> {
  if (!(await canManageSite(actor, siteId))) return null;

  await ensureMemoryLoaded();
  const results: InviteResult[] = [];
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  for (const email of emails) {
    const token = generateInviteToken();
    if (!useDatabase()) {
      const memberKey = `${siteId}:${email}`;
      if (memory.siteMembers.has(memberKey)) {
        results.push({ email, status: "already_member" });
        continue;
      }
      const existing = Array.from(memory.siteInvites.values()).find(
        (i) => i.siteId === siteId && i.invitedEmail === email
      );
      if (existing) {
        memory.siteInvites.delete(existing.token);
        const resent: SiteInviteRecord = {
          ...existing,
          token,
          expiresAt,
        };
        memory.siteInvites.set(token, resent);
        results.push({ email, status: "resent" });
      } else {
        const invite: SiteInviteRecord = {
          id: uuidv7(),
          siteId,
          invitedEmail: email,
          invitedBy: actor.email,
          role,
          token,
          expiresAt,
          createdAt: new Date().toISOString(),
        };
        memory.siteInvites.set(token, invite);
        results.push({ email, status: "sent" });
      }
    } else {
      const isMember = await getPgPool().query<{ exists: boolean }>(
        `SELECT EXISTS(SELECT 1 FROM site_members WHERE site_id=$1 AND member_email=$2) AS exists`,
        [siteId, email]
      );
      if (isMember.rows[0].exists) {
        results.push({ email, status: "already_member" });
        continue;
      }
      const upsert = await getPgPool().query<{
        id: string; site_id: string; invited_email: string; invited_by: string;
        role: string; token: string; expires_at: Date; created_at: Date;
      }>(
        `INSERT INTO site_invites (id, site_id, invited_email, invited_by, role, token, expires_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (site_id, invited_email) DO UPDATE
           SET token=$6, expires_at=$7, role=$5, invited_by=$4
         RETURNING *, (xmax = 0) AS inserted`,
        [uuidv7(), siteId, email, actor.email, role, token, expiresAt]
      );
      const wasNew = (upsert as unknown as { rows: Array<{ xmax: string }> }).rows[0].xmax === "0";
      results.push({ email, status: wasNew ? "sent" : "resent" });
    }
  }

  if (!useDatabase()) await persistMemory();
  return results;
}

export async function listSiteInvites(
  actor: Actor,
  siteId: string
): Promise<SiteInviteRecord[] | null> {
  if (!(await canManageSite(actor, siteId))) return null;
  if (!useDatabase()) {
    await ensureMemoryLoaded();
    const now = new Date().toISOString();
    return Array.from(memory.siteInvites.values()).filter(
      (i) => i.siteId === siteId && i.expiresAt > now
    );
  }
  const r = await getPgPool().query<{
    id: string; site_id: string; invited_email: string; invited_by: string;
    role: string; token: string; expires_at: Date; created_at: Date;
  }>(
    `SELECT * FROM site_invites WHERE site_id=$1 AND expires_at > NOW() ORDER BY created_at DESC`,
    [siteId]
  );
  return r.rows.map((row) => ({
    id: row.id,
    siteId: row.site_id,
    invitedEmail: row.invited_email,
    invitedBy: row.invited_by,
    role: row.role,
    token: row.token,
    expiresAt: row.expires_at.toISOString(),
    createdAt: row.created_at.toISOString(),
  }));
}

export async function deleteSiteInvite(
  actor: Actor,
  siteId: string,
  inviteId: string
): Promise<boolean> {
  if (!(await canManageSite(actor, siteId))) return false;
  if (!useDatabase()) {
    await ensureMemoryLoaded();
    for (const [token, invite] of memory.siteInvites.entries()) {
      if (invite.id === inviteId && invite.siteId === siteId) {
        memory.siteInvites.delete(token);
        await persistMemory();
        return true;
      }
    }
    return false;
  }
  const r = await getPgPool().query(
    `DELETE FROM site_invites WHERE id=$1 AND site_id=$2`,
    [inviteId, siteId]
  );
  return (r.rowCount ?? 0) > 0;
}

export async function acceptSiteInvite(
  actorEmail: string,
  token: string
): Promise<{ siteId: string; siteName: string; role: string } | "expired" | "not_found" | "wrong_user" | "already_used"> {
  if (!useDatabase()) {
    await ensureMemoryLoaded();
    const invite = memory.siteInvites.get(token);
    if (!invite) return "not_found";
    if (invite.invitedEmail !== actorEmail) return "wrong_user";
    if (new Date(invite.expiresAt) < new Date()) return "expired";

    // Atomic in the single-threaded JS sense: delete first, then insert
    memory.siteInvites.delete(token);
    const memberKey = `${invite.siteId}:${actorEmail}`;
    if (memory.siteMembers.has(memberKey)) {
      // Already a member — still return success
      await persistMemory();
      const site = memory.sites.get(invite.siteId);
      return { siteId: invite.siteId, siteName: site?.name ?? invite.siteId, role: invite.role };
    }
    memory.siteMembers.set(memberKey, {
      siteId: invite.siteId,
      memberEmail: actorEmail,
      role: invite.role,
      invitedBy: invite.invitedBy,
      joinedAt: new Date().toISOString(),
    });
    await persistMemory();
    const site = memory.sites.get(invite.siteId);
    return { siteId: invite.siteId, siteName: site?.name ?? invite.siteId, role: invite.role };
  }

  const pool = getPgPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Atomically claim the token — DELETE RETURNING means only one concurrent
    // request can claim it; subsequent requests get 0 rows.
    const del = await client.query<{
      id: string; site_id: string; invited_email: string; invited_by: string; role: string;
    }>(
      `DELETE FROM site_invites WHERE token=$1 AND expires_at > NOW() RETURNING *`,
      [token]
    );
    if (del.rowCount === 0) {
      // Check if it existed but was expired or already used
      const check = await client.query(
        `SELECT 1 FROM site_invites WHERE token=$1`,
        [token]
      );
      await client.query("ROLLBACK");
      return check.rowCount === 0 ? "not_found" : "expired";
    }
    const invite = del.rows[0];
    if (invite.invited_email !== actorEmail) {
      await client.query("ROLLBACK");
      return "wrong_user";
    }
    await client.query(
      `INSERT INTO site_members (site_id, member_email, role, invited_by)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT DO NOTHING`,
      [invite.site_id, actorEmail, invite.role, invite.invited_by]
    );
    const siteRow = await client.query<{ name: string }>(
      `SELECT name FROM project_sites WHERE id=$1`,
      [invite.site_id]
    );
    await client.query("COMMIT");
    return {
      siteId: invite.site_id,
      siteName: siteRow.rows[0]?.name ?? invite.site_id,
      role: invite.role,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function listSiteMembers(
  actor: Actor,
  siteId: string
): Promise<SiteMemberRecord[] | null> {
  if (!(await canManageSite(actor, siteId))) return null;
  if (!useDatabase()) {
    await ensureMemoryLoaded();
    return Array.from(memory.siteMembers.values()).filter((m) => m.siteId === siteId);
  }
  const r = await getPgPool().query<{
    site_id: string; member_email: string; role: string; invited_by: string; joined_at: Date;
  }>(
    `SELECT * FROM site_members WHERE site_id=$1 ORDER BY joined_at ASC`,
    [siteId]
  );
  return r.rows.map((row) => ({
    siteId: row.site_id,
    memberEmail: row.member_email,
    role: row.role,
    invitedBy: row.invited_by,
    joinedAt: row.joined_at.toISOString(),
  }));
}

export async function removeSiteMember(
  actor: Actor,
  siteId: string,
  memberEmail: string
): Promise<boolean> {
  if (!(await canManageSite(actor, siteId))) return false;
  if (!useDatabase()) {
    await ensureMemoryLoaded();
    const key = `${siteId}:${memberEmail}`;
    if (!memory.siteMembers.has(key)) return false;
    memory.siteMembers.delete(key);
    await persistMemory();
    return true;
  }
  const r = await getPgPool().query(
    `DELETE FROM site_members WHERE site_id=$1 AND member_email=$2`,
    [siteId, memberEmail]
  );
  return (r.rowCount ?? 0) > 0;
}
