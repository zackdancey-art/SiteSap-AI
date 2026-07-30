import { Router } from "express";
import { z } from "zod";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth";
import { rateLimit } from "../middleware/rateLimit";
import { upsertPushToken, deletePushToken, getTokensForUser } from "../storage/pushStore";

export const pushRouter: Router = Router();

function getActor(req: unknown) {
  const r = req as AuthenticatedRequest;
  return { email: r.auth.email, role: r.auth.role, companyId: r.auth.companyId, companyRole: r.auth.companyRole };
}

const RegisterSchema = z.object({
  token: z.string().min(1),
  platform: z.enum(["expo", "apns", "fcm"]).default("expo"),
});

pushRouter.post(
  "/push/tokens",
  requireAuth,
  rateLimit("push-register", 10, 60 * 60 * 1000),
  async (req, res) => {
    const parsed = RegisterSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid payload.", details: parsed.error.flatten() });
    }
    const record = await upsertPushToken(getActor(req), parsed.data.token, parsed.data.platform);
    return res.status(201).json({ token: record });
  }
);

pushRouter.delete("/push/tokens/:token", requireAuth, async (req, res) => {
  const removed = await deletePushToken(getActor(req), decodeURIComponent(req.params.token));
  if (!removed) return res.status(404).json({ error: "Token not found." });
  return res.json({ ok: true });
});

pushRouter.get("/push/tokens", requireAuth, async (req, res) => {
  const tokens = await getTokensForUser(getActor(req));
  return res.json({ tokens });
});
