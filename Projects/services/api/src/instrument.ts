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
    beforeSend(event) {
      // Strip auth headers and sensitive query params from every reported event
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
  console.log("[sentry] initialised");
}

export { Sentry };
