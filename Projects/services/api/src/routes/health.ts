import { Router } from "express";
import fs from "fs";
import path from "path";
import { Sentry } from "../instrument";
import { getPgPool } from "../storage/postgres";

export const healthRouter: Router = Router();

// Liveness — the process is up. Never touches the DB.
healthRouter.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Readiness — can the app actually serve? Verifies the DB is reachable AND every
// migration file has been applied. This is what would have surfaced the incident
// where migrations silently didn't run (registration failing on a missing
// column) — a plain liveness check stays green through that.
healthRouter.get("/health/ready", async (_req, res) => {
  const usingDb = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim());
  if (!usingDb) {
    // Dev / in-memory mode: no DB to verify; the app is serviceable.
    return res.json({ status: "ready", database: "in-memory" });
  }
  try {
    await getPgPool().query("SELECT 1");

    // Migration completeness: schema_migrations must hold one row per .sql file.
    // Fewer means migrations did not fully apply on this deploy.
    let expected = 0;
    try {
      const dir = path.join(__dirname, "..", "storage", "migrations");
      expected = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).length;
    } catch {
      expected = 0; // migrations dir absent (shouldn't happen in the container) — skip count check
    }
    const appliedRes = await getPgPool().query<{ count: number }>(
      "SELECT COUNT(*)::int AS count FROM schema_migrations"
    );
    const applied = Number(appliedRes.rows[0]?.count ?? 0);

    if (expected > 0 && applied < expected) {
      return res.status(503).json({
        status: "not ready",
        database: "connected",
        migrations: { applied, expected, message: "migrations not fully applied" },
      });
    }
    return res.json({ status: "ready", database: "connected", migrations: { applied, expected } });
  } catch (err) {
    return res.status(503).json({
      status: "not ready",
      database: "unreachable",
      error: err instanceof Error ? err.message : String(err),
    });
  }
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
