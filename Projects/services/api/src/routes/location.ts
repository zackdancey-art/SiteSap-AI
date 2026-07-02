import { Router } from "express";
import { z } from "zod";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth";
import { upsertLocation, getAllWorkerLocations } from "../storage/locationStore";

export const locationRouter: Router = Router();

function getActor(req: unknown) {
  const r = req as AuthenticatedRequest;
  return { email: r.auth.email, role: r.auth.role, companyId: r.auth.companyId, companyRole: r.auth.companyRole };
}

const UpdateSchema = z.object({
  latitude:  z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy:  z.number().min(0).optional(),
  siteId:    z.string().optional(),
  userName:  z.string().optional(),
});

locationRouter.post("/location/update", requireAuth, async (req, res) => {
  try {
    const parsed = UpdateSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid location payload.", details: parsed.error.flatten() });
    }
    const location = await upsertLocation(getActor(req), parsed.data);
    return res.json({ ok: true, location });
  } catch (err) {
    console.error("[location] update failed", err);
    return res.status(500).json({ error: "Failed to update location." });
  }
});

locationRouter.get("/location/workers", requireAuth, async (req, res) => {
  try {
    const locations = await getAllWorkerLocations(getActor(req));
    return res.json({ locations });
  } catch (err) {
    console.error("[location] list workers failed", err);
    return res.status(500).json({ error: "Failed to list worker locations." });
  }
});
