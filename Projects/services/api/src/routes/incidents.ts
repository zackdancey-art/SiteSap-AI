import { Router } from "express";
import { z } from "zod";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth";
import { listIncidents, createIncident, updateIncident, deleteIncident } from "../storage/incidentStore";
import { getAllTokensForEmails } from "../storage/pushStore";
import { sendExpoPushNotifications } from "../utils/expoPush";
import { UserRole } from "../utils/authToken";

export const incidentsRouter: Router = Router();

function getActor(req: unknown) {
  const r = req as AuthenticatedRequest;
  return { email: r.auth.email, role: r.auth.role as UserRole };
}

const IncidentSchema = z.object({
  siteId: z.string().min(1),
  date: z.string().min(1),
  severity: z.enum(["near-miss", "minor", "major", "critical"]),
  description: z.string().min(1),
  injuredParty: z.string().default(""),
  correctiveAction: z.string().default(""),
  status: z.enum(["open", "closed"]).default("open"),
});

const IncidentPatchSchema = z.object({
  status: z.enum(["open", "closed"]).optional(),
  correctiveAction: z.string().optional(),
  severity: z.enum(["near-miss", "minor", "major", "critical"]).optional(),
});

incidentsRouter.get("/incidents", requireAuth, async (req, res) => {
  try {
    const siteId = typeof req.query.siteId === "string" ? req.query.siteId : undefined;
    const incidents = await listIncidents(getActor(req), siteId);
    return res.json({ incidents });
  } catch (err) {
    console.error("[incidents] list failed", err);
    return res.status(500).json({ error: "Failed to list incidents." });
  }
});

incidentsRouter.post("/incidents", requireAuth, async (req, res) => {
  try {
    const parsed = IncidentSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid incident payload.", details: parsed.error.flatten() });
    }
    const actor = getActor(req);
    const incident = await createIncident(actor, parsed.data);

    // Notify supervisors for major/critical incidents
    if (["major", "critical"].includes(parsed.data.severity)) {
      try {
        const tokens = await getAllTokensForEmails([actor.email]);
        const pushTokens = tokens.map((t) => t.token).filter((t) => t.startsWith("ExponentPushToken"));
        if (pushTokens.length > 0) {
          await sendExpoPushNotifications([{
            to: pushTokens,
            title: `${parsed.data.severity.toUpperCase()} Incident Reported`,
            body: parsed.data.description.slice(0, 100),
            data: { incidentId: incident.id, siteId: incident.siteId },
            sound: "default",
          }]);
        }
      } catch (pushErr) {
        console.error("[incidents] push notification failed", pushErr);
      }
    }

    return res.status(201).json({ incident });
  } catch (err) {
    console.error("[incidents] create failed", err);
    return res.status(500).json({ error: "Failed to create incident." });
  }
});

incidentsRouter.patch("/incidents/:id", requireAuth, async (req, res) => {
  try {
    const parsed = IncidentPatchSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid patch.", details: parsed.error.flatten() });
    }
    const incident = await updateIncident(getActor(req), req.params.id, parsed.data);
    if (!incident) return res.status(404).json({ error: "Incident not found." });
    return res.json({ incident });
  } catch (err) {
    console.error("[incidents] update failed", err);
    return res.status(500).json({ error: "Failed to update incident." });
  }
});

incidentsRouter.delete("/incidents/:id", requireAuth, async (req, res) => {
  try {
    const removed = await deleteIncident(getActor(req), req.params.id);
    if (!removed) return res.status(404).json({ error: "Incident not found." });
    return res.json({ ok: true });
  } catch (err) {
    console.error("[incidents] delete failed", err);
    return res.status(500).json({ error: "Failed to delete incident." });
  }
});
