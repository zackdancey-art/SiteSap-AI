import { getPgPool } from "./postgres";
import { UserRole, isElevatedRole } from "../utils/authToken";

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

type Actor = { email: string; role: UserRole };

function useDatabase() {
  return Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim());
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
  if (!isElevatedRole(actor.role)) return [];

  if (!useDatabase()) {
    const cutoff = Date.now() - 4 * 60 * 60 * 1000; // 4 hours
    return Array.from(memoryLocations.values()).filter(
      (l) => new Date(l.timestamp).getTime() > cutoff
    );
  }

  const result = await getPgPool().query(
    `SELECT user_email, user_name, latitude, longitude, accuracy, site_id, timestamp
     FROM worker_locations
     WHERE timestamp > NOW() - INTERVAL '4 hours'
     ORDER BY timestamp DESC`
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
