import { initSentry, Sentry } from "./instrument";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { httpLogger } from "./middleware/logger";
import { requestId } from "./middleware/requestId";
import { apiRouter } from "./routes";
import { initAuthSchema } from "./storage/authStore";
import { isProductionMediaStorageReady } from "./storage/mediaStorage";
import { initProjectSchema } from "./storage/projectsStore";
import { initPushSchema } from "./storage/pushStore";
import { initDeliveriesSchema } from "./storage/deliveriesStore";
import { initTemplateSchema } from "./storage/templateStore";
import { runMigrations } from "./storage/migrate";

dotenv.config();

function isConfigured(value?: string) {
  return Boolean(value && value.trim());
}

function validateProviderConfig() {
  const isProd = process.env.NODE_ENV === "production";
  const hasDatabase = isConfigured(process.env.DATABASE_URL);
  const hasAuthSecret = isConfigured(process.env.AUTH_TOKEN_SECRET);
  const hasEmailProvider =
    (isConfigured(process.env.RESEND_API_KEY) || isConfigured(process.env.SENDGRID_API_KEY)) &&
    isConfigured(process.env.EMAIL_FROM);
  const hasSmsProvider =
    isConfigured(process.env.TWILIO_ACCOUNT_SID) &&
    isConfigured(process.env.TWILIO_AUTH_TOKEN) &&
    isConfigured(process.env.TWILIO_FROM_NUMBER);
  const hasMediaStorage = isProductionMediaStorageReady();

  if (isProd) {
    const missing = [
      !hasAuthSecret ? "AUTH_TOKEN_SECRET" : null,
      !hasDatabase ? "PostgreSQL DATABASE_URL" : null,
      !hasEmailProvider ? "email provider (RESEND/SENDGRID + EMAIL_FROM)" : null,
      !hasSmsProvider ? "Twilio SMS provider (SID, TOKEN, FROM_NUMBER)" : null,
      !hasMediaStorage ? "S3-compatible media storage (MEDIA_STORAGE_PROVIDER=s3 + S3_* env vars)" : null,
    ].filter(Boolean);
    if (missing.length > 0) {
      throw new Error(`Missing production configuration: ${missing.join(", ")}`);
    }
    console.warn(
      "[auth] Production mode: rate limiting is in-memory and will reset on restart. " +
      "Use a reverse proxy (nginx/Cloudflare) or external rate limiter for multi-instance deployments."
    );
    return;
  }

  if (!hasAuthSecret) {
    console.warn("[auth] Dev mode warning: AUTH_TOKEN_SECRET is not set. Using insecure default — never use in production.");
  }
  if (!hasDatabase) {
    console.warn("[auth] Dev mode warning: DATABASE_URL is not set. Using in-memory auth fallback (data resets on restart).");
  }
  if (!hasMediaStorage) {
    console.warn("[uploads] Dev mode warning: media storage provider is not configured. Using local disk uploads.");
  }
  if (!hasEmailProvider || !hasSmsProvider) {
    console.warn(
      "[auth] Dev mode provider warning: using local code fallback. Configure RESEND/SENDGRID + EMAIL_FROM and TWILIO vars for real delivery."
    );
  }
}

const rawPort = process.env.PORT;
const PORT = rawPort && !isNaN(Number(rawPort)) ? Number(rawPort) : 4000;
const allowedOrigins = String(process.env.CORS_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

export function createApp(): express.Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(requestId);
  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });
  const isProdMode = process.env.NODE_ENV === "production";
  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin) return cb(null, true); // same-origin or server-to-server
        if (allowedOrigins.length === 0) {
          if (isProdMode) return cb(new Error("CORS origin blocked: no CORS_ALLOWED_ORIGINS configured"));
          return cb(null, true); // dev: allow all
        }
        if (allowedOrigins.includes(origin)) return cb(null, true);
        return cb(new Error("CORS origin blocked"));
      },
    })
  );
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    res.setHeader("Cross-Origin-Resource-Policy", "same-site");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    if (isProdMode) {
      // HSTS: trust this domain for 1 year, include subdomains
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
    }
    next();
  });
  app.use(express.json({ limit: "25mb" }));
  app.use(httpLogger);
  app.use("/api", apiRouter);
  // Sentry error handler must come after routes and before any other error handler
  Sentry.setupExpressErrorHandler(app);
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (typeof err === "object" && err !== null && "type" in err) {
      const kind = String((err as { type?: string }).type || "");
      if (kind === "entity.too.large") {
        return res.status(413).json({
          error: "Request payload is too large. Reduce photo count/size and retry.",
        });
      }
      if (kind === "entity.parse.failed") {
        return res.status(400).json({ error: "Malformed JSON request body." });
      }
    }
    console.error("[server] Unhandled request error", { reqId: _req.headers["x-request-id"], err });
    return res.status(500).json({ error: "Internal server error." });
  });
  return app;
}

export async function bootstrap() {
  initSentry();
  validateProviderConfig();
  await runMigrations();
  await initAuthSchema();
  await initProjectSchema();
  await initPushSchema();
  await initDeliveriesSchema();
  await initTemplateSchema();
  const app = createApp();

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`✅ API running on http://0.0.0.0:${PORT}`);
  });

  let shuttingDown = false;
  async function shutdown(signal: string) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[server] ${signal} received — shutting down gracefully`);
    server.close(async (err) => {
      if (err) console.error("[server] error closing HTTP server", err);
      try {
        const { getPgPool } = await import("./storage/postgres");
        await getPgPool().end();
        console.log("[server] database pool closed");
      } catch {
        // Pool may not be open in file-backed mode
      }
      process.exit(err ? 1 : 0);
    });
    // Force-exit if requests don't drain within 10 seconds
    setTimeout(() => {
      console.error("[server] force exit after 10s drain timeout");
      process.exit(1);
    }, 10_000).unref();
  }

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("uncaughtException", (err) => {
    console.error("[server] uncaughtException", err);
    void shutdown("uncaughtException");
  });
  process.on("unhandledRejection", (reason) => {
    console.error("[server] unhandledRejection", reason);
  });

  return server;
}

if (require.main === module) {
  bootstrap().catch((error) => {
    console.error("❌ API startup failed", error);
    process.exit(1);
  });
}
