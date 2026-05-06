import { Router } from "express";
import { z } from "zod";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth";
import { upsertLocation, getAllWorkerLocations } from "../storage/locationStore";
import { UserRole } from "../utils/authToken";

export const locationRouter: Router = Router();

function getActor(req: unknown) {
  const r = req as AuthenticatedRequest;
  return { email: r.auth.email, role: r.auth.role as UserRole };
}

const UpdateSchema = z.object({
  latitude:  z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy:  z.number().min(0).optional(),
  siteId:    z.string().optional(),
  userName:  z.string().optional(),
});

locationRouter.post("/location/update", requireAuth, async (req, res) => {
  const parsed = UpdateSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid location payload.", details: parsed.error.flatten() });
  }
  const location = await upsertLocation(getActor(req), parsed.data);
  return res.json({ ok: true, location });
});

locationRouter.get("/location/workers", requireAuth, async (req, res) => {
  const actor = getActor(req);
  const locations = await getAllWorkerLocations(actor);
  return res.json({ locations });
});
