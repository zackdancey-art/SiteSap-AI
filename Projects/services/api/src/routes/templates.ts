import { Router } from "express";
import { z } from "zod";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth";
import { listTemplates, createTemplate, deleteTemplate } from "../storage/templateStore";

export const templatesRouter: Router = Router();
templatesRouter.use(requireAuth);

function getActor(req: AuthenticatedRequest) {
  return { email: req.auth.email, role: req.auth.role };
}

const TemplateSchema = z.object({
  name: z.string().min(1).max(100),
  notes: z.string().default(""),
  crewCount: z.string().default(""),
  weather: z.string().default(""),
});

templatesRouter.get("/entry-templates", async (req, res) => {
  const templates = await listTemplates(getActor(req as unknown as AuthenticatedRequest));
  return res.json({ templates });
});

templatesRouter.post("/entry-templates", async (req, res) => {
  const parsed = TemplateSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: "Invalid template payload.", details: parsed.error.flatten() });
  const template = await createTemplate(getActor(req as unknown as AuthenticatedRequest), parsed.data);
  return res.status(201).json({ template });
});

templatesRouter.delete("/entry-templates/:id", async (req, res) => {
  const removed = await deleteTemplate(getActor(req as unknown as AuthenticatedRequest), req.params.id);
  if (!removed) return res.status(404).json({ error: "Template not found." });
  return res.json({ ok: true });
});
