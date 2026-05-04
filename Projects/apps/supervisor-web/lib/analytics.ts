// Analytics placeholder — swap `sendEvent` implementation for PostHog, Mixpanel,
// or your preferred provider. All product events are routed through this module
// so the integration point is a single file change.

type EventProperties = Record<string, string | number | boolean | null | undefined>;

declare global {
  interface Window {
    posthog?: {
      capture: (event: string, properties?: EventProperties) => void;
      identify: (id: string, properties?: EventProperties) => void;
      reset: () => void;
    };
  }
}

function sendEvent(event: string, properties?: EventProperties) {
  if (typeof window === "undefined") return;
  if (window.posthog) {
    window.posthog.capture(event, properties);
    return;
  }
  // Dev-mode console logging so events are visible without a provider
  if (process.env.NODE_ENV !== "production") {
    console.debug(`[analytics] ${event}`, properties ?? {});
  }
}

export const analytics = {
  page(name: string) {
    sendEvent("$pageview", { page: name });
  },
  identify(email: string, role: string) {
    if (typeof window !== "undefined" && window.posthog) {
      window.posthog.identify(email, { role });
    }
  },
  reset() {
    if (typeof window !== "undefined" && window.posthog) {
      window.posthog.reset();
    }
  },
  reportExported(format: string, siteId: string) {
    sendEvent("report_exported", { format, siteId });
  },
  reportViewed(diaryId: string, siteId: string) {
    sendEvent("report_viewed", { diaryId, siteId });
  },
  loginSuccess(role: string) {
    sendEvent("login_success", { role });
  },
  logoutTriggered() {
    sendEvent("logout");
  },
};
