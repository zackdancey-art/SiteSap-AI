import { getPgPool } from "./postgres";
import { Actor } from "./actor";

export type LocationRecord = {
  id: string;
  userEmail: string;
  userName?: string;
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

  await getPgPool().query(
    `INSERT INTO worker_locations (user_email, user_name, latitude, longitude, accuracy, site_id, timestamp)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (user_email) DO UPDATE SET
       user_name = EXCLUDED.user_name, latitude = EXCLUDED.latitude,
       longitude = EXCLUDED.longitude, accuracy = EXCLUDED.accuracy,
       site_id = EXCLUDED.site_id, timestamp = NOW()`,
    [actor.email, payload.userName ?? null, payload.latitude, payload.longitude,
     payload.accuracy ?? null, payload.siteId ?? null]
  );
  return record;
}

export async function getAllWorkerLocations(actor: Actor): Promise<LocationRecord[]> {
  if (!canViewCompanyLocations(actor)) return [];

  if (!useDatabase()) {
    const cutoff = Date.now() - 4 * 60 * 60 * 1000;
    return Array.from(memoryLocations.values()).filter(
      (l) => new Date(l.timestamp).getTime() > cutoff
    );
  }

  // Join to auth_users to enforce company scoping — worker_locations has no
  // company_id column (schema-drift issue tracked separately).
  const result = await getPgPool().query(
    `SELECT wl.user_email, wl.user_name, wl.latitude, wl.longitude,
            wl.accuracy, wl.site_id, wl.timestamp
     FROM worker_locations wl
     JOIN auth_users u ON u.email = wl.user_email
     WHERE u.company_id = $1
       AND wl.timestamp > NOW() - INTERVAL '4 hours'
     ORDER BY wl.timestamp DESC`,
    [actor.companyId]
  );
  return result.rows.map((r) => ({
    id: r.user_email,
    userEmail: r.user_email,
    userName: r.user_name,
    latitude: Number(r.latitude),
    longitude: Number(r.longitude),
    accuracy: r.accuracy ? Number(r.accuracy) : undefined,
    siteId: r.site_id ?? undefined,
    timestamp: r.timestamp instanceof Date ? r.timestamp.toISOString() : String(r.timestamp),
  }));
}
