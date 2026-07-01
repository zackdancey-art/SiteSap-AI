import { Router } from "express";
import { z } from "zod";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth";
import { listTimecards, createTimecard, deleteTimecard } from "../storage/crewStore";

export const crewRouter: Router = Router();

function getActor(req: unknown) {
  const r = req as AuthenticatedRequest;
  return { email: r.auth.email, role: r.auth.role, companyId: r.auth.companyId, companyRole: r.auth.companyRole };
}

const TimecardSchema = z.object({
  siteId: z.string().min(1),
  entryId: z.string().nullable().optional(),
  workerName: z.string().min(1),
  date: z.string().min(1),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  breakMinutes: z.number().min(0).max(480).default(0),
  hoursRegular: z.number().min(0).max(24),
  hoursOvertime: z.number().min(0).max(24).default(0),
  trade: z.string().default(""),
  notes: z.string().default(""),
});

crewRouter.get("/crew/timecards", requireAuth, async (req, res) => {
  try {
    const siteId = typeof req.query.siteId === "string" ? req.query.siteId : undefined;
    const timecards = await listTimecards(getActor(req), siteId);
    return res.json({ timecards });
  } catch (err) {
    console.error("[crew] list timecards failed", err);
    return res.status(500).json({ error: "Failed to list timecards." });
  }
});

crewRouter.post("/crew/timecards", requireAuth, async (req, res) => {
  try {
    const parsed = TimecardSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid timecard payload.", details: parsed.error.flatten() });
    }
    const timecard = await createTimecard(getActor(req), {
      ...parsed.data,
      entryId: parsed.data.entryId ?? null,
    });
    return res.status(201).json({ timecard });
  } catch (err) {
    console.error("[crew] create timecard failed", err);
    return res.status(500).json({ error: "Failed to create timecard." });
  }
});

crewRouter.delete("/crew/timecards/:id", requireAuth, async (req, res) => {
  try {
    const removed = await deleteTimecard(getActor(req), req.params.id);
    if (!removed) return res.status(404).json({ error: "Timecard not found." });
    return res.json({ ok: true });
  } catch (err) {
    console.error("[crew] delete timecard failed", err);
    return res.status(500).json({ error: "Failed to delete timecard." });
  }
});
