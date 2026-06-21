import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole, AuthenticatedRequest } from "../middleware/auth";
import {
  createDiary,
  createEntry,
  createSite,
  deleteEntry,
  deleteSite,
  getScopedBootstrap,
  getSupervisorReport,
  listDiaries,
  listEntries,
  listSites,
  updateDiary,
  updateEntry,
} from "../storage/projectsStore";

function parsePagination(query: Record<string, unknown>) {
  const limit = Math.min(Math.max(Number(query.limit) || 200, 1), 500);
  const offset = Math.max(Number(query.offset) || 0, 0);
  return { limit, offset };
}

const SiteSchema = z.object({
  name: z.string().min(1),
  address: z.string().min(1),
  client: z.string().min(1),
  startDate: z.string().min(1),
  status: z.enum(["active", "completed", "on-hold"]),
});

const EntrySchema = z.object({
  siteId: z.string().min(1),
  date: z.string().min(1),
  locationAddress: z.string().default(""),
  weather: z.string().default(""),
  crewCount: z.string().default(""),
  notes: z.string().default(""),
  photos: z.array(z.record(z.unknown())).default([]),
});

const EntryPatchSchema = EntrySchema.omit({ siteId: true }).partial();

const DiarySchema = z.object({
  siteId: z.string().min(1),
  status: z.enum(["draft", "approved"]),
  summary: z.string().default(""),
  reportPeriod: z.enum(["daily", "weekly", "monthly"]).default("daily"),
  fullReport: z.string().default(""),
  safetyChecklist: z.array(z.string()).default([]),
  sections: z.array(z.record(z.unknown())).default([]),
});

const DiaryPatchSchema = z.object({
  status: z.enum(["draft", "approved"]).optional(),
  summary: z.string().optional(),
  reportPeriod: z.enum(["daily", "weekly", "monthly"]).optional(),
  fullReport: z.string().optional(),
  safetyChecklist: z.array(z.string()).optional(),
  sections: z.array(z.record(z.unknown())).optional(),
  note: z.string().optional(),
});

export const projectsRouter: Router = Router();

projectsRouter.use(requireAuth);

function getActor(req: AuthenticatedRequest) {
  return { email: req.auth.email, role: req.auth.role };
}

projectsRouter.get("/projects/bootstrap", async (req, res) => {
  const payload = await getScopedBootstrap(getActor(req as unknown as AuthenticatedRequest));
  res.json(payload);
});

projectsRouter.get("/projects/summary", async (req, res) => {
  const actor = getActor(req as unknown as AuthenticatedRequest);
  const [sites, entries, diaries] = await Promise.all([
    listSites(actor),
    listEntries(actor),
    listDiaries(actor),
  ]);

  const approvedDiaries = diaries.filter((diary) => diary.status === "approved").length;
  res.json({
    sites: sites.length,
    entries: entries.length,
    diaries: diaries.length,
    approvedDiaries,
    draftDiaries: diaries.length - approvedDiaries,
    actorRole: actor.role,
  });
});

projectsRouter.get("/projects/sites", async (req, res) => {
  const { limit, offset } = parsePagination(req.query as Record<string, unknown>);
  const sites = await listSites(getActor(req as unknown as AuthenticatedRequest), limit, offset);
  res.json({ sites, limit, offset });
});

projectsRouter.post("/projects/sites", async (req, res) => {
  const actor = getActor(req as unknown as AuthenticatedRequest);
  const parsed = SiteSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid site payload.", details: parsed.error.flatten() });
  }
  const site = await createSite(actor, parsed.data);
  return res.status(201).json({ site });
});

projectsRouter.delete("/projects/sites/:id", async (req, res) => {
  const removed = await deleteSite(getActor(req as unknown as AuthenticatedRequest), req.params.id);
  if (!removed) return res.status(404).json({ error: "Site not found." });
  return res.json({ ok: true });
});

projectsRouter.get("/projects/entries", async (req, res) => {
  const actor = getActor(req as unknown as AuthenticatedRequest);
  const siteId = typeof req.query.siteId === "string" ? req.query.siteId : undefined;
  const { limit, offset } = parsePagination(req.query as Record<string, unknown>);
  const entries = await listEntries(actor, siteId, limit, offset);
  return res.json({ entries, limit, offset });
});

projectsRouter.post("/projects/entries", async (req, res) => {
  const actor = getActor(req as unknown as AuthenticatedRequest);
  const parsed = EntrySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid entry payload.", details: parsed.error.flatten() });
  }
  const entry = await createEntry(actor, parsed.data);
  return res.status(201).json({ entry });
});

projectsRouter.patch("/projects/entries/:id", async (req, res) => {
  const actor = getActor(req as unknown as AuthenticatedRequest);
  const parsed = EntryPatchSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid entry patch.", details: parsed.error.flatten() });
  }
  const entry = await updateEntry(actor, req.params.id, parsed.data);
  if (!entry) return res.status(404).json({ error: "Entry not found." });
  return res.json({ entry });
});

projectsRouter.delete("/projects/entries/:id", async (req, res) => {
  const removed = await deleteEntry(getActor(req as unknown as AuthenticatedRequest), req.params.id);
  if (!removed) return res.status(404).json({ error: "Entry not found." });
  return res.json({ ok: true });
});

projectsRouter.get("/projects/diaries", async (req, res) => {
  const actor = getActor(req as unknown as AuthenticatedRequest);
  const siteId = typeof req.query.siteId === "string" ? req.query.siteId : undefined;
  const { limit, offset } = parsePagination(req.query as Record<string, unknown>);
  const diaries = await listDiaries(actor, siteId, limit, offset);
  return res.json({ diaries, limit, offset });
});

projectsRouter.post("/projects/diaries", async (req, res) => {
  const actor = getActor(req as unknown as AuthenticatedRequest);
  const parsed = DiarySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid diary payload.", details: parsed.error.flatten() });
  }
  const diary = await createDiary(actor, parsed.data);
  return res.status(201).json({ diary });
});

projectsRouter.patch("/projects/diaries/:id", async (req, res) => {
  const actor = getActor(req as unknown as AuthenticatedRequest);
  const parsed = DiaryPatchSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid diary patch.", details: parsed.error.flatten() });
  }
  const { note, ...diaryPatch } = parsed.data;
  const diary = await updateDiary(actor, req.params.id, diaryPatch, note);
  if (!diary) return res.status(404).json({ error: "Diary not found." });
  return res.json({ diary });
});

projectsRouter.get("/projects/reports/supervisor", requireRole("supervisor", "admin"), async (req, res) => {
  const perSite = await getSupervisorReport();
  return res.json({ generatedAt: new Date().toISOString(), perSite });
});
