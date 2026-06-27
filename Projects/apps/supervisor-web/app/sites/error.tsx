"use client";

import { useEffect } from "react";

export default function SitesError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => { console.error("[sites] error:", error); }, [error]);
  return (
    <div className="app-shell">
      <div className="main">
        <div style={{ padding: 48, textAlign: "center" }}>
          <p style={{ fontSize: 32, marginBottom: 8 }}>⚠️</p>
          <p style={{ fontWeight: 700, fontSize: 16, color: "var(--text)", marginBottom: 8 }}>Sites failed to load</p>
          <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 20 }}>
            {error.message || "An unexpected error occurred."}
          </p>
          <button className="btn-primary" onClick={reset}>Retry</button>
        </div>
      </div>
    </div>
  );
}
