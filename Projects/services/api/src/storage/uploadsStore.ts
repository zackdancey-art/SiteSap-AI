import { Actor } from "./actor";
import { withTenant } from "./tenant";

/**
 * Ownership record for uploaded media (finding H7). The owning company is bound
 * at UPLOAD time from the authenticated uploader's identity — a place the
 * requester cannot forge — NOT inferred from caller-writable entry photo JSON.
 * The `uploads` table is FORCE-RLS'd (migration 023), so `uploadBelongsToActor
 * Company` returns true only when the row's company matches the caller's.
 */
type UploadMeta = {
  id: string;
  companyId: string;
  ownerEmail: string;
  filename: string;
  createdAt: string;
};

function useDatabase() {
  return Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim());
}

const memoryUploads = new Map<string, UploadMeta>();

/** Record the owning company of an upload at upload time (unforgeable). */
export async function recordUpload(actor: Actor, id: string, filename: string): Promise<void> {
  if (!useDatabase()) {
    if (!memoryUploads.has(id)) {
      memoryUploads.set(id, {
        id,
        companyId: actor.companyId,
        ownerEmail: actor.email,
        filename,
        createdAt: new Date().toISOString(),
      });
    }
    return;
  }
  await withTenant(actor, (client) =>
    client.query(
      `INSERT INTO uploads (id, filename, company_id, owner_email)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO NOTHING`,
      [id, filename, actor.companyId, actor.email]
    )
  );
}

/** True iff the upload was recorded as belonging to the actor's company. */
export async function uploadBelongsToActorCompany(
  actor: Pick<Actor, "companyId">,
  id: string
): Promise<boolean> {
  const uploadId = String(id || "").trim();
  if (!uploadId) return false;
  if (!useDatabase()) {
    const meta = memoryUploads.get(uploadId);
    return Boolean(meta && meta.companyId === actor.companyId);
  }
  // RLS (migration 023) scopes the row to the caller's company, so a row is
  // returned only when the upload's recorded company matches — unforgeable.
  const result = await withTenant(actor, (client) =>
    client.query(`SELECT 1 FROM uploads WHERE id = $1 LIMIT 1`, [uploadId])
  );
  return (result.rowCount ?? 0) > 0;
}

export function resetUploadsStoreForTests() {
  memoryUploads.clear();
}
