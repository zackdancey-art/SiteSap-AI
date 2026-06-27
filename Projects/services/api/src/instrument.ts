// instrument.ts — must be the FIRST import in server.ts.
// Sentry v8+ uses OpenTelemetry and patches Node built-ins (http, net, etc.)
// at init time, so Sentry.init() must run before express or any other
// instrumented module is loaded.
import * as Sentry from "@sentry/node";
import { config as loadEnv } from "dotenv";

// Load .env before reading SENTRY_DSN so local dev works without
// pre-exporting vars. Production platforms inject vars directly; calling
// loadEnv() there is a safe no-op (it won't override already-set vars).
loadEnv();

const dsn = process.env.SENTRY_DSN?.trim();

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || "development",
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,
    sendDefaultPii: false,
    beforeSend(event) {
      // Strip credentials and sensitive query params from every event.
      // Never send auth tokens, cookies, or signing keys to Sentry.
      if (event.request?.headers) {
        delete event.request.headers["authorization"];
        delete event.request.headers["cookie"];
      }
      if (typeof event.request?.query_string === "string") {
        event.request.query_string = event.request.query_string.replace(
          /\b(sig|token|key)=[^&]*/gi,
          "$1=[redacted]"
        );
      }
      return event;
    },
  });
  console.log(`[sentry] initialised (${process.env.NODE_ENV ?? "development"})`);
} else if (process.env.NODE_ENV === "production") {
  console.warn("[sentry] SENTRY_DSN not set — error tracking disabled in production");
}

export { Sentry };
