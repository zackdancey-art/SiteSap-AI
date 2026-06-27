import { Router } from "express";
import { Sentry } from "../instrument";

export const healthRouter: Router = Router();

healthRouter.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Intentionally throws an error so you can verify Sentry receives events.
// Only available outside production. Hit GET /api/debug-sentry, then check
// your Sentry project's "Issues" tab — an event should arrive within ~30 s.
if (process.env.NODE_ENV !== "production") {
  healthRouter.get("/debug-sentry", (_req, res) => {
    const err = new Error("SiteSnap Sentry test event — safe to resolve");
    Sentry.captureException(err);
    res.json({
      ok: true,
      message: "Test event sent to Sentry. Check your project Issues tab.",
    });
  });
}
