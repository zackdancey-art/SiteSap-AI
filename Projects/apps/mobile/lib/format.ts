/**
 * Shared display formatters. Centralised so cards and exports render dates the
 * same way instead of each screen inlining its own toLocaleDateString call.
 */

/** Format an ISO date ("YYYY-MM-DD" or a full ISO timestamp) as e.g. "5 Aug 2025". */
export function formatDate(iso: string): string {
  if (!iso) return "—";
  const d = iso.length <= 10 ? new Date(`${iso}T00:00:00`) : new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}
