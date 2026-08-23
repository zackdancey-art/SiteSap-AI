import { createHash } from "crypto";
import { v4 as uuidv4 } from "uuid";
import { PoolClient } from "pg";
import { Actor } from "./actor";
import { withTenant } from "./tenant";
import type { InspectionResultItem, InspectionDefectItem } from "./inspectionStore";

export type InspectionSignatureRole = "inspector" | "manager" | "client";

export type InspectionSignature = {
  id: string;
  inspectionId: string;
  companyId: string;
  role: InspectionSignatureRole;
  signerName: string;
  signedAt: string;
  path: string;
  viewBox: string;
  contentHash: string;
  snapshot: Record<string, unknown>;
  status: "active" | "voided";
  voidedAt: string | null;
  voidedReason: string | null;
  createdAt: string;
};

// Structural param type for the fields that are actually signed. Kept as a
// separate `import type` from inspectionStore (not a value import) to avoid a
// module cycle, since inspectionStore imports from this file for the
// auto-void on update.
export type SignableInspection = {
  name: string;
  date: string;
  scope: string;
  areaInspected: string;
  time: string;
  inspectorName: string;
  inspectorRole: string;
  inspectorCompany: string;
  results: InspectionResultItem[];
  defects: InspectionDefectItem[];
  overallOutcome: string;
  followUpRequired: boolean;
};

function useDatabase() {
  // In test mode DATABASE_URL is deliberately unset (the harness forbids it), so
  // an explicit TEST_DATABASE_URL selects the Postgres path. Without this the
  // store's DB code is never exercised by any test.
  if (process.env.NODE_ENV === "test") return Boolean(process.env.TEST_DATABASE_URL?.trim());
  return Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim());
}

// Signature records carry no owner_email (unlike inspections), so — matching
// the DB query below, which scopes on company_id only, with no crew clause —
// access here is company-scoped only.
function canAccess(actor: Actor, companyId: string) {
  return companyId === actor.companyId;
}

export function computeInspectionContentHash(insp: SignableInspection): {
  hash: string;
  snapshot: Record<string, unknown>;
} {
  const snapshot = {
    name: insp.name,
    date: insp.date,
    scope: insp.scope,
    areaInspected: insp.areaInspected,
    time: insp.time,
    inspectorName: insp.inspectorName,
    inspectorRole: insp.inspectorRole,
    inspectorCompany: insp.inspectorCompany,
    results: (insp.results || []).map((r) => ({
      item: r.item,
      passed: r.passed,
      notes: r.notes,
      na: r.na ?? false,
    })),
    defects: (insp.defects || []).map((d) => ({
      description: d.description,
      severity: d.severity,
      owner: d.owner,
      dueDate: d.dueDate,
      status: d.status,
    })),
    overallOutcome: insp.overallOutcome,
    followUpRequired: insp.followUpRequired,
  };
  const hash = createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
  return { hash, snapshot };
}

const memorySignatures = new Map<string, InspectionSignature>();

function mapSignature(row: {
  id: string;
  inspection_id: string;
  company_id: string;
  role: InspectionSignatureRole;
  signer_name: string;
  signed_at: Date;
  path: string;
  view_box: string;
  content_hash: string;
  snapshot: unknown;
  status: "active" | "voided";
  voided_at: Date | null;
  voided_reason: string | null;
  created_at: Date;
}): InspectionSignature {
  return {
    id: row.id,
    inspectionId: row.inspection_id,
    companyId: row.company_id,
    role: row.role,
    signerName: row.signer_name,
    signedAt: row.signed_at.toISOString(),
    path: row.path,
    viewBox: row.view_box,
    contentHash: row.content_hash,
    snapshot: row.snapshot && typeof row.snapshot === "object" ? (row.snapshot as Record<string, unknown>) : {},
    status: row.status,
    voidedAt: row.voided_at ? row.voided_at.toISOString() : null,
    voidedReason: row.voided_reason,
    createdAt: row.created_at.toISOString(),
  };
}

export async function createSignature(
  actor: Actor,
  input: {
    inspectionId: string;
    role: InspectionSignatureRole;
    signerName: string;
    path: string;
    viewBox: string;
    contentHash: string;
    snapshot: Record<string, unknown>;
  }
): Promise<InspectionSignature> {
  const now = new Date().toISOString();
  const record: InspectionSignature = {
    id: uuidv4(),
    inspectionId: input.inspectionId,
    companyId: actor.companyId,
    role: input.role,
    signerName: input.signerName,
    signedAt: now,
    path: input.path,
    viewBox: input.viewBox,
    contentHash: input.contentHash,
    snapshot: input.snapshot,
    status: "active",
    voidedAt: null,
    voidedReason: null,
    createdAt: now,
  };
  if (!useDatabase()) {
    memorySignatures.set(record.id, record);
    return record;
  }
  const result = await withTenant(actor, (client) =>
    client.query(
      `INSERT INTO inspection_signatures (
         id, inspection_id, company_id, role, signer_name, path, view_box, content_hash, snapshot
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb) RETURNING *`,
      [
        record.id,
        input.inspectionId,
        actor.companyId,
        input.role,
        input.signerName,
        input.path,
        input.viewBox,
        input.contentHash,
        JSON.stringify(input.snapshot),
      ]
    )
  );
  return mapSignature(result.rows[0]);
}

export async function listSignatures(actor: Actor, inspectionId: string): Promise<InspectionSignature[]> {
  if (!useDatabase()) {
    return Array.from(memorySignatures.values())
      .filter((s) => s.inspectionId === inspectionId && canAccess(actor, s.companyId))
      .sort((a, b) => a.signedAt.localeCompare(b.signedAt));
  }
  const result = await withTenant(actor, (client) =>
    client.query(
      `SELECT * FROM inspection_signatures WHERE inspection_id = $1 AND company_id = $2 ORDER BY signed_at ASC`,
      [inspectionId, actor.companyId]
    )
  );
  return result.rows.map(mapSignature);
}

export async function voidSignature(actor: Actor, sigId: string, reason: string): Promise<InspectionSignature | null> {
  if (!useDatabase()) {
    const existing = memorySignatures.get(sigId);
    if (!existing || !canAccess(actor, existing.companyId) || existing.status !== "active") return null;
    const updated: InspectionSignature = {
      ...existing,
      status: "voided",
      voidedAt: new Date().toISOString(),
      voidedReason: reason,
    };
    memorySignatures.set(sigId, updated);
    return updated;
  }
  const result = await withTenant(actor, (client) =>
    client.query(
      `UPDATE inspection_signatures SET status = 'voided', voided_at = NOW(), voided_reason = $3
       WHERE id = $1 AND company_id = $2 AND status = 'active' RETURNING *`,
      [sigId, actor.companyId, reason]
    )
  );
  if (result.rowCount === 0) return null;
  return mapSignature(result.rows[0]);
}

// Runs on a caller-supplied PoolClient so it shares the caller's withTenant
// transaction — do NOT open its own connection/transaction here.
export async function voidStaleSignaturesOnClient(
  client: PoolClient,
  companyId: string,
  inspectionId: string,
  currentHash: string,
  reason: string
): Promise<number> {
  const result = await client.query(
    `UPDATE inspection_signatures SET status = 'voided', voided_at = NOW(), voided_reason = $4
     WHERE inspection_id = $1 AND company_id = $2 AND status = 'active' AND content_hash <> $3`,
    [inspectionId, companyId, currentHash, reason]
  );
  return result.rowCount ?? 0;
}

// In-memory equivalent used by the memory path of updateInspection.
export function voidStaleSignaturesInMemory(
  companyId: string,
  inspectionId: string,
  currentHash: string,
  reason: string
): number {
  let count = 0;
  for (const [id, sig] of memorySignatures.entries()) {
    if (
      sig.inspectionId === inspectionId &&
      sig.companyId === companyId &&
      sig.status === "active" &&
      sig.contentHash !== currentHash
    ) {
      memorySignatures.set(id, {
        ...sig,
        status: "voided",
        voidedAt: new Date().toISOString(),
        voidedReason: reason,
      });
      count += 1;
    }
  }
  return count;
}
