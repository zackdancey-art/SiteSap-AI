import * as Sentry from "@sentry/node";

// Must be imported before anything else — Sentry instruments at require-time
export function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    if (process.env.NODE_ENV === "production") {
      console.warn("[sentry] SENTRY_DSN not set — error tracking disabled");
    }
    return;
  }
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || "development",
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,
    sendDefaultPii: false,
  });
  console.log("[sentry] initialised");
}

export { Sentry };
