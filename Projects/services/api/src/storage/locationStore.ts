import { Actor } from "./actor";
import { withTenant } from "./tenant";

export type LocationRecord = {
  id: string;
  userEmail: string;
  userName?: string;
  companyId: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  siteId?: string;
  timestamp: string;
};

function useDatabase() {
  return Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim());
}

// Only managers and owners may view the whole-company worker map.
function canViewCompanyLocations(actor: Actor): boolean {
  return actor.companyRole === "manager" || actor.companyRole === "owner";
}

// In-memory store: one current location per user
const memoryLocations = new Map<string, LocationRecord>();

export async function upsertLocation(
  actor: Actor,
  payload: { latitude: number; longitude: number; accuracy?: number; siteId?: string; userName?: string }
): Promise<LocationRecord> {
  const record: LocationRecord = {
    id: actor.email,
    userEmail: actor.email,
    userName: payload.userName,
    companyId: actor.companyId,
    latitude: payload.latitude,
    longitude: payload.longitude,
    accuracy: payload.accuracy,
    siteId: payload.siteId,
    timestamp: new Date().toISOString(),
  };

  if (!useDatabase()) {
    memoryLocations.set(actor.email, record);
    return record;
  }

  await withTenant(actor, (client) =>
    client.query(
      `INSERT INTO worker_locations (user_email, user_name, company_id, latitude, longitude, accuracy, site_id, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (user_email) DO UPDATE SET
         user_name = EXCLUDED.user_name, company_id = EXCLUDED.company_id, latitude = EXCLUDED.latitude,
         longitude = EXCLUDED.longitude, accuracy = EXCLUDED.accuracy,
         site_id = EXCLUDED.site_id, timestamp = NOW()`,
      [actor.email, payload.userName ?? null, actor.companyId, payload.latitude, payload.longitude,
       payload.accuracy ?? null, payload.siteId ?? null]
    )
  );
  return record;
}

export async function getAllWorkerLocations(actor: Actor): Promise<LocationRecord[]> {
  if (!canViewCompanyLocations(actor)) return [];

  if (!useDatabase()) {
    const cutoff = Date.now() - 4 * 60 * 60 * 1000;
    // Company scoping must be enforced here too — the DB path gets it from RLS
    // (migration 020), but the in-memory fallback has no policy, so filter
    // explicitly or it leaks other tenants' locations (found by the isolation matrix).
    return Array.from(memoryLocations.values()).filter(
      (l) => l.companyId === actor.companyId && new Date(l.timestamp).getTime() > cutoff
    );
  }

  // Join to auth_users is kept as belt-and-braces alongside the RLS policy
  // (migration 020), which is the authoritative company filter.
  const result = await withTenant(actor, (client) =>
    client.query(
      `SELECT wl.user_email, wl.user_name, wl.company_id, wl.latitude, wl.longitude,
              wl.accuracy, wl.site_id, wl.timestamp
       FROM worker_locations wl
       JOIN auth_users u ON u.email = wl.user_email
       WHERE u.company_id = $1
         AND wl.timestamp > NOW() - INTERVAL '4 hours'
       ORDER BY wl.timestamp DESC`,
      [actor.companyId]
    )
  );
  return result.rows.map((r) => ({
    id: r.user_email,
    userEmail: r.user_email,
    userName: r.user_name,
    companyId: r.company_id,
    latitude: Number(r.latitude),
    longitude: Number(r.longitude),
    accuracy: r.accuracy ? Number(r.accuracy) : undefined,
    siteId: r.site_id ?? undefined,
    timestamp: r.timestamp instanceof Date ? r.timestamp.toISOString() : String(r.timestamp),
  }));
}
