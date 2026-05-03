import { Router } from "express";
import { z } from "zod";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth";
import { listTimecards, createTimecard, deleteTimecard } from "../storage/crewStore";
import { UserRole } from "../utils/authToken";

export const crewRouter: Router = Router();

function getActor(req: unknown) {
  const r = req as AuthenticatedRequest;
  return { email: r.auth.email, role: r.auth.role as UserRole };
}

const TimecardSchema = z.object({
  siteId: z.string().min(1),
  entryId: z.string().nullable().optional(),
  workerName: z.string().min(1),
  date: z.string().min(1),
  hoursRegular: z.number().min(0).max(24),
  hoursOvertime: z.number().min(0).max(24).default(0),
  trade: z.string().default(""),
  notes: z.string().default(""),
});

crewRouter.get("/crew/timecards", requireAuth, async (req, res) => {
  const siteId = typeof req.query.siteId === "string" ? req.query.siteId : undefined;
  const timecards = await listTimecards(getActor(req), siteId);
  return res.json({ timecards });
});

crewRouter.post("/crew/timecards", requireAuth, async (req, res) => {
  const parsed = TimecardSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid timecard payload.", details: parsed.error.flatten() });
  }
  const timecard = await createTimecard(getActor(req), {
    ...parsed.data,
    entryId: parsed.data.entryId ?? null,
  });
  return res.status(201).json({ timecard });
});

crewRouter.delete("/crew/timecards/:id", requireAuth, async (req, res) => {
  const removed = await deleteTimecard(getActor(req), req.params.id);
  if (!removed) return res.status(404).json({ error: "Timecard not found." });
  return res.json({ ok: true });
});
