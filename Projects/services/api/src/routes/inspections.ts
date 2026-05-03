import { Router } from "express";
import { z } from "zod";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth";
import {
  listTemplates, createTemplate, deleteTemplate,
  listInspections, createInspection, updateInspection, deleteInspection,
} from "../storage/inspectionStore";
import { UserRole } from "../utils/authToken";

export const inspectionsRouter: Router = Router();

function getActor(req: unknown) {
  const r = req as AuthenticatedRequest;
  return { email: r.auth.email, role: r.auth.role as UserRole };
}

const TemplateSchema = z.object({
  name: z.string().min(1),
  items: z.array(z.string().min(1)).min(1),
});

const ResultItemSchema = z.object({
  item: z.string(),
  passed: z.boolean().nullable().default(null),
  notes: z.string().default(""),
});

const InspectionSchema = z.object({
  siteId: z.string().min(1),
  templateId: z.string().nullable().optional(),
  name: z.string().min(1),
  date: z.string().min(1),
  results: z.array(ResultItemSchema).default([]),
  status: z.enum(["pending", "complete"]).default("pending"),
});

const InspectionPatchSchema = z.object({
  results: z.array(ResultItemSchema).optional(),
  status: z.enum(["pending", "complete"]).optional(),
});

// ─── Templates ──────────────────────────────────────────────────────────────

inspectionsRouter.get("/inspection-templates", requireAuth, async (req, res) => {
  const templates = await listTemplates(getActor(req));
  return res.json({ templates });
});

inspectionsRouter.post("/inspection-templates", requireAuth, async (req, res) => {
  const parsed = TemplateSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid template payload.", details: parsed.error.flatten() });
  }
  const template = await createTemplate(getActor(req), parsed.data.name, parsed.data.items);
  return res.status(201).json({ template });
});

inspectionsRouter.delete("/inspection-templates/:id", requireAuth, async (req, res) => {
  const removed = await deleteTemplate(getActor(req), req.params.id);
  if (!removed) return res.status(404).json({ error: "Template not found." });
  return res.json({ ok: true });
});

// ─── Inspections ─────────────────────────────────────────────────────────────

inspectionsRouter.get("/inspections", requireAuth, async (req, res) => {
  const siteId = typeof req.query.siteId === "string" ? req.query.siteId : undefined;
  const inspections = await listInspections(getActor(req), siteId);
  return res.json({ inspections });
});

inspectionsRouter.post("/inspections", requireAuth, async (req, res) => {
  const parsed = InspectionSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid inspection payload.", details: parsed.error.flatten() });
  }
  const inspection = await createInspection(getActor(req), {
    ...parsed.data,
    templateId: parsed.data.templateId ?? null,
  });
  return res.status(201).json({ inspection });
});

inspectionsRouter.patch("/inspections/:id", requireAuth, async (req, res) => {
  const parsed = InspectionPatchSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid patch.", details: parsed.error.flatten() });
  }
  const inspection = await updateInspection(getActor(req), req.params.id, parsed.data);
  if (!inspection) return res.status(404).json({ error: "Inspection not found." });
  return res.json({ inspection });
});

inspectionsRouter.delete("/inspections/:id", requireAuth, async (req, res) => {
  const removed = await deleteInspection(getActor(req), req.params.id);
  if (!removed) return res.status(404).json({ error: "Inspection not found." });
  return res.json({ ok: true });
});
