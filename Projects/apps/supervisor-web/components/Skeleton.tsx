export function SkeletonCard({ rows = 3 }: { rows?: number }) {
  return (
    <div className="skeleton-card">
      <div className="skeleton skeleton-title" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton skeleton-text" style={{ width: i % 2 === 0 ? "100%" : "75%" }} />
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{
          display: "flex", alignItems: "center", gap: 16,
          padding: "14px 20px",
          borderBottom: i < rows - 1 ? "1px solid var(--border)" : "none",
        }}>
          <div className="skeleton" style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0 }} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
            <div className="skeleton skeleton-text" style={{ width: "40%" }} />
            <div className="skeleton skeleton-text" style={{ width: "60%", height: 11 }} />
          </div>
          <div className="skeleton skeleton-badge" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonMetrics({ count = 4 }: { count?: number }) {
  return (
    <div className="metrics-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="metric-card">
          <div className="skeleton skeleton-text" style={{ width: "50%", height: 11, marginBottom: 8 }} />
          <div className="skeleton" style={{ height: 32, width: "60%" }} />
        </div>
      ))}
    </div>
  );
}
