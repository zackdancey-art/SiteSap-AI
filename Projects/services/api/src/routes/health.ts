import { Router } from "express";

export const healthRouter: Router = Router();

healthRouter.get("/health", async (_req, res) => {
  const startMs = Date.now();
  const checks: Record<string, "ok" | "warn" | "error"> = {};

  // Database connectivity
  const hasDatabase = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim());
  if (hasDatabase) {
    try {
      const { getPgPool } = await import("../storage/postgres");
      await getPgPool().query("SELECT 1");
      checks.database = "ok";
    } catch {
      checks.database = "error";
    }
  } else {
    checks.database = "warn"; // file-backed dev mode
  }

  // Third-party provider availability (non-blocking, best-effort)
  checks.openai = process.env.OPENAI_API_KEY ? "ok" : "warn";
  checks.email  = (process.env.RESEND_API_KEY || process.env.SENDGRID_API_KEY) ? "ok" : "warn";
  checks.sms    = process.env.TWILIO_ACCOUNT_SID ? "ok" : "warn";

  const hasError = Object.values(checks).some((v) => v === "error");
  const status = hasError ? "degraded" : "ok";

  res.status(hasError ? 503 : 200).json({
    status,
    uptimeSeconds: Math.floor(process.uptime()),
    responseMs: Date.now() - startMs,
    checks,
    version: process.env.npm_package_version ?? "unknown",
    nodeEnv: process.env.NODE_ENV ?? "development",
  });
});
