/**
 * In-memory (no-Postgres) tests for the inspection-signature feature
 * (`storage/signatureStore.ts`, wired into `storage/inspectionStore.ts`'s
 * `updateInspection` auto-void path, migration 024).
 *
 * These exercise the store functions directly — no HTTP layer — against the
 * in-memory branch that runs when neither DATABASE_URL nor TEST_DATABASE_URL
 * is set under NODE_ENV=test (`useDatabase()` in both stores). Postgres/RLS
 * behaviour for this feature is covered separately and is out of scope here.
 *
 * Coverage:
 *  1. Sign → round-trips through listSignatures with the exact fields/hash.
 *  2. Editing a *signable* field (e.g. overallOutcome) auto-voids the
 *     existing signature with a non-empty reason.
 *  3. Editing only `status` (excluded from the content hash) does NOT void.
 *  4. A no-op edit (patch value identical to the current value) does NOT
 *     void, because the recomputed hash is unchanged.
 *  5. voidSignature is one-way: voiding an already-voided signature returns
 *     null instead of re-voiding it.
 *  6. Company isolation on the in-memory path: another company can neither
 *     list nor void a signature that isn't theirs, and doing so leaves the
 *     owning company's signature untouched.
 *  7. computeInspectionContentHash is deterministic, changes when a signable
 *     field changes, and is stable when only a non-signable field (status,
 *     id) changes.
 *
 * Part B (checklist-photo content hash) additions:
 *  8. Adding a photo to a checklist result DOES void an active signature.
 *  9. Swapping only a photo's uri (the local -> remote upload rewrite) does
 *     NOT void — this is the anti-false-void guarantee the hash's stable-
 *     identity design exists to provide.
 * 10. Appending an annotated derivative photo DOES void.
 * 11. Pure-hash assertions (no store): computeInspectionContentHash is
 *     invariant to a photo's uri/base64, and changes when a photo's
 *     id/kind/derivedFromId/annotationVector differs or a photo is
 *     added/removed.
 * 12. Round-trip: photos survive createInspection -> getInspection intact.
 *
 * The module-level `memorySignatures`/`memoryInspections` Maps in the two
 * stores are never reset between tests (no `resetXForTests` helper exists
 * for this feature), so every test uses a fresh, unique companyId/site via
 * `uniq()` to avoid cross-test interference.
 */

delete process.env.DATABASE_URL;
delete process.env.TEST_DATABASE_URL;
process.env.NODE_ENV = "test";
process.env.AUTH_TOKEN_SECRET = "signature-store-test-secret";

import assert from "node:assert/strict";
import { test } from "node:test";
import { Actor } from "./actor";
import { createInspection, updateInspection, getInspection, InspectionRecord } from "./inspectionStore";
import {
  createSignature,
  listSignatures,
  voidSignature,
  computeInspectionContentHash,
  SignableInspection,
} from "./signatureStore";

let n = 0;
const uniq = () => `${Date.now()}-${n++}`;

const actor = (companyId: string, email = `u-${companyId}@t`): Actor => ({
  email,
  role: "supervisor",
  companyId,
  companyRole: "owner",
});

async function makeInspection(a: Actor, overrides: Partial<Parameters<typeof createInspection>[1]> = {}) {
  return createInspection(a, {
    siteId: "site-" + a.companyId,
    templateId: null,
    name: "Weekly",
    date: "2026-02-01",
    results: [{ item: "PPE", passed: true, notes: "" }],
    status: "pending",
    scope: "site-wide",
    areaInspected: "Level 2",
    time: "09:00",
    inspectorName: "Ada",
    inspectorRole: "H&S",
    inspectorCompany: "Acme",
    defects: [],
    overallOutcome: "pass",
    followUpRequired: false,
    ...overrides,
  });
}

async function sign(a: Actor, insp: InspectionRecord) {
  const { hash, snapshot } = computeInspectionContentHash(insp);
  return createSignature(a, {
    inspectionId: insp.id,
    role: "inspector",
    signerName: "Ada",
    path: "M0 0 L5 5",
    viewBox: "0 0 100 40",
    contentHash: hash,
    snapshot,
  });
}

test("round-trip: signing an inspection is visible via listSignatures with matching fields and hash", async () => {
  const companyId = "sig-roundtrip-" + uniq();
  const a = actor(companyId);
  const insp = await makeInspection(a);
  const sig = await sign(a, insp);

  const list = await listSignatures(a, insp.id);
  assert.equal(list.length, 1);
  const [got] = list;

  assert.equal(got.id, sig.id);
  assert.equal(got.status, "active");
  assert.equal(got.role, "inspector");
  assert.equal(got.signerName, "Ada");
  assert.equal(got.path, "M0 0 L5 5");
  assert.equal(got.viewBox, "0 0 100 40");
  assert.equal(got.contentHash, computeInspectionContentHash(insp).hash);
});

test("auto-void: editing a signable field (overallOutcome) voids the existing signature", async () => {
  const companyId = "sig-autovoid-" + uniq();
  const a = actor(companyId);
  const insp = await makeInspection(a);
  const sig = await sign(a, insp);

  const updated = await updateInspection(a, insp.id, { overallOutcome: "fail" });
  assert.ok(updated, "expected updateInspection to return the updated record");

  const list = await listSignatures(a, insp.id);
  const got = list.find((s) => s.id === sig.id);
  assert.ok(got, "expected the original signature to still be listed");
  assert.equal(got!.status, "voided");
  assert.ok(got!.voidedReason && got!.voidedReason.length > 0, "expected a non-empty voidedReason");
});

test("no auto-void on a status-only edit (status is excluded from the content hash)", async () => {
  const companyId = "sig-statusonly-" + uniq();
  const a = actor(companyId);
  const insp = await makeInspection(a);
  const sig = await sign(a, insp);

  const updated = await updateInspection(a, insp.id, { status: "complete" });
  assert.ok(updated);
  assert.equal(updated!.status, "complete");

  const list = await listSignatures(a, insp.id);
  const got = list.find((s) => s.id === sig.id);
  assert.ok(got);
  assert.equal(got!.status, "active", "a status-only edit must not void an existing signature");
});

test("no auto-void on a no-op edit (patched value equals the current value)", async () => {
  const companyId = "sig-noop-" + uniq();
  const a = actor(companyId);
  const insp = await makeInspection(a); // overallOutcome: "pass"
  const sig = await sign(a, insp);

  const updated = await updateInspection(a, insp.id, { overallOutcome: "pass" });
  assert.ok(updated);

  const list = await listSignatures(a, insp.id);
  const got = list.find((s) => s.id === sig.id);
  assert.ok(got);
  assert.equal(got!.status, "active", "re-submitting the same value must not void an existing signature");
});

test("voidSignature is one-way: a second void attempt on an already-voided signature returns null", async () => {
  const companyId = "sig-oneway-" + uniq();
  const a = actor(companyId);
  const insp = await makeInspection(a);
  const sig = await sign(a, insp);

  const firstVoid = await voidSignature(a, sig.id, "superseded");
  assert.ok(firstVoid);
  assert.equal(firstVoid!.status, "voided");
  assert.equal(firstVoid!.voidedReason, "superseded");

  const secondVoid = await voidSignature(a, sig.id, "again");
  assert.equal(secondVoid, null, "voiding an already-voided signature must return null, not re-void it");
});

test("company isolation (in-memory path): another company can neither list nor void a signature that isn't theirs", async () => {
  const companyA = "sig-iso-a-" + uniq();
  const companyB = "sig-iso-b-" + uniq();
  const a = actor(companyA);
  const b = actor(companyB);

  const insp = await makeInspection(a);
  const sig = await sign(a, insp);

  const listAsB = await listSignatures(b, insp.id);
  assert.deepEqual(listAsB, [], "company B must not see company A's signature");

  const voidAsB = await voidSignature(b, sig.id, "cross-tenant attempt");
  assert.equal(voidAsB, null, "company B must not be able to void company A's signature");

  const listAsA = await listSignatures(a, insp.id);
  const stillActive = listAsA.find((s) => s.id === sig.id);
  assert.ok(stillActive, "company A's signature must still be listed");
  assert.equal(stillActive!.status, "active", "cross-tenant void attempt must not have affected company A's signature");
});

test("computeInspectionContentHash: deterministic, changes on signable-field edits, stable on non-signable-field edits", async () => {
  const companyId = "sig-hash-" + uniq();
  const a = actor(companyId);
  const insp = await makeInspection(a);

  const first = computeInspectionContentHash(insp);
  const second = computeInspectionContentHash(insp);
  assert.equal(first.hash, second.hash, "hashing the same record twice must produce the same hash");

  const changedSignable = { ...insp, overallOutcome: "different" };
  const changedHash = computeInspectionContentHash(changedSignable);
  assert.notEqual(changedHash.hash, first.hash, "changing a signable field (overallOutcome) must change the hash");

  const changedStatus = { ...insp, status: "complete" as const };
  const statusHash = computeInspectionContentHash(changedStatus);
  assert.equal(statusHash.hash, first.hash, "changing only status must not change the hash");

  const changedId = { ...insp, id: "some-other-id" };
  const idHash = computeInspectionContentHash(changedId);
  assert.equal(idHash.hash, first.hash, "changing only id must not change the hash");
});

// ─── Part B: checklist-photo content hash ───────────────────────────────────

test("Part B / photo add: adding a photo to a checklist result DOES void an active signature", async () => {
  const companyId = "sig-photo-add-" + uniq();
  const a = actor(companyId);
  const insp = await makeInspection(a, {
    results: [{ item: "PPE", passed: true, notes: "" }],
  });
  const sig = await sign(a, insp);

  const updated = await updateInspection(a, insp.id, {
    results: [
      {
        item: "PPE",
        passed: true,
        notes: "",
        photos: [{ id: "p1", uri: "file:///local.jpg", kind: "original" }],
      },
    ],
  });
  assert.ok(updated, "expected updateInspection to return the updated record");

  const list = await listSignatures(a, insp.id);
  const got = list.find((s) => s.id === sig.id);
  assert.ok(got, "expected the original signature to still be listed");
  assert.equal(got!.status, "voided", "adding a photo to a checklist result must void the signature");
});

test("Part B / photo uri swap: local -> remote uri rewrite on the SAME photo does NOT void (anti-false-void guarantee)", async () => {
  const companyId = "sig-photo-uri-" + uniq();
  const a = actor(companyId);
  const insp = await makeInspection(a, {
    results: [
      {
        item: "PPE",
        passed: true,
        notes: "",
        photos: [{ id: "p1", uri: "file:///local.jpg", kind: "original" }],
      },
    ],
  });
  const sig = await sign(a, insp);

  // Simulate the upload pipeline swapping the local file:// uri for the
  // uploaded remote path, leaving id/kind (and derivedFromId/annotationVector)
  // untouched — this is the exact rewrite that must NOT be treated as content
  // change, or every photo upload would silently destroy trust in a signature.
  const updated = await updateInspection(a, insp.id, {
    results: [
      {
        item: "PPE",
        passed: true,
        notes: "",
        photos: [{ id: "p1", uri: "/uploads/abc-local.jpg", kind: "original" }],
      },
    ],
  });
  assert.ok(updated);
  assert.equal(
    (updated!.results[0].photos as Array<Record<string, unknown>>)[0].uri,
    "/uploads/abc-local.jpg",
    "sanity: the uri really did change in storage"
  );

  const list = await listSignatures(a, insp.id);
  const got = list.find((s) => s.id === sig.id);
  assert.ok(got, "expected the original signature to still be listed");
  assert.equal(
    got!.status,
    "active",
    "a local->remote uri swap on an unchanged photo identity must NOT void the signature"
  );
});

test("Part B / annotation: appending an annotated derivative photo DOES void", async () => {
  const companyId = "sig-photo-annotate-" + uniq();
  const a = actor(companyId);
  const insp = await makeInspection(a, {
    results: [
      {
        item: "PPE",
        passed: true,
        notes: "",
        photos: [{ id: "p1", uri: "file:///local.jpg", kind: "original" }],
      },
    ],
  });
  const sig = await sign(a, insp);

  const updated = await updateInspection(a, insp.id, {
    results: [
      {
        item: "PPE",
        passed: true,
        notes: "",
        photos: [
          { id: "p1", uri: "file:///local.jpg", kind: "original" },
          {
            id: "p2",
            uri: "/uploads/abc.jpg",
            kind: "annotated",
            derivedFromId: "p1",
            annotationVector: { viewBox: "0 0 100 100", strokes: [] },
          },
        ],
      },
    ],
  });
  assert.ok(updated);

  const list = await listSignatures(a, insp.id);
  const got = list.find((s) => s.id === sig.id);
  assert.ok(got, "expected the original signature to still be listed");
  assert.equal(got!.status, "voided", "appending an annotated derivative photo must void the signature");
});

test("Part B / pure hash: computeInspectionContentHash is invariant to a photo's uri/base64 but sensitive to id/kind/derivedFromId/annotationVector and add/remove", () => {
  const base: SignableInspection = {
    name: "Weekly",
    date: "2026-02-01",
    scope: "site-wide",
    areaInspected: "Level 2",
    time: "09:00",
    inspectorName: "Ada",
    inspectorRole: "H&S",
    inspectorCompany: "Acme",
    results: [
      {
        item: "PPE",
        passed: true,
        notes: "",
        photos: [{ id: "p1", uri: "file:///local.jpg", kind: "original", base64: "AAAA" }],
      },
    ],
    defects: [],
    overallOutcome: "pass",
    followUpRequired: false,
  };
  const baseHash = computeInspectionContentHash(base).hash;

  // uri AND base64 both change: hash must be unaffected (uri changes on
  // upload, base64 is stripped before persistence — neither is stable
  // identity and neither should be able to void a signature on its own).
  const uriAndBase64Changed: SignableInspection = {
    ...base,
    results: [
      {
        ...base.results[0],
        photos: [{ id: "p1", uri: "/uploads/abc-local.jpg", kind: "original" }],
      },
    ],
  };
  assert.equal(
    computeInspectionContentHash(uriAndBase64Changed).hash,
    baseHash,
    "changing only uri/base64 on a photo must not change the hash"
  );

  // id differs: hash must change.
  const idChanged: SignableInspection = {
    ...base,
    results: [
      {
        ...base.results[0],
        photos: [{ id: "p1-different", uri: "file:///local.jpg", kind: "original", base64: "AAAA" }],
      },
    ],
  };
  assert.notEqual(computeInspectionContentHash(idChanged).hash, baseHash, "changing a photo's id must change the hash");

  // kind differs: hash must change.
  const kindChanged: SignableInspection = {
    ...base,
    results: [
      {
        ...base.results[0],
        photos: [{ id: "p1", uri: "file:///local.jpg", kind: "annotated", base64: "AAAA" }],
      },
    ],
  };
  assert.notEqual(computeInspectionContentHash(kindChanged).hash, baseHash, "changing a photo's kind must change the hash");

  // derivedFromId differs: hash must change.
  const derivedFromIdChanged: SignableInspection = {
    ...base,
    results: [
      {
        ...base.results[0],
        photos: [{ id: "p1", uri: "file:///local.jpg", kind: "original", derivedFromId: "some-parent", base64: "AAAA" }],
      },
    ],
  };
  assert.notEqual(
    computeInspectionContentHash(derivedFromIdChanged).hash,
    baseHash,
    "changing a photo's derivedFromId must change the hash"
  );

  // annotationVector differs: hash must change.
  const annotationVectorChanged: SignableInspection = {
    ...base,
    results: [
      {
        ...base.results[0],
        photos: [
          {
            id: "p1",
            uri: "file:///local.jpg",
            kind: "original",
            annotationVector: { viewBox: "0 0 10 10", strokes: [] },
            base64: "AAAA",
          },
        ],
      },
    ],
  };
  assert.notEqual(
    computeInspectionContentHash(annotationVectorChanged).hash,
    baseHash,
    "changing a photo's annotationVector must change the hash"
  );

  // Photo removed: hash must change.
  const photoRemoved: SignableInspection = {
    ...base,
    results: [{ ...base.results[0], photos: [] }],
  };
  assert.notEqual(computeInspectionContentHash(photoRemoved).hash, baseHash, "removing a photo must change the hash");

  // Photo added: hash must change.
  const photoAdded: SignableInspection = {
    ...base,
    results: [
      {
        ...base.results[0],
        photos: [
          { id: "p1", uri: "file:///local.jpg", kind: "original", base64: "AAAA" },
          { id: "p2", uri: "file:///local2.jpg", kind: "original" },
        ],
      },
    ],
  };
  assert.notEqual(computeInspectionContentHash(photoAdded).hash, baseHash, "adding a photo must change the hash");
});

test("Part B / round-trip: checklist-result photos survive createInspection -> read-back intact", async () => {
  const companyId = "sig-photo-roundtrip-" + uniq();
  const a = actor(companyId);
  const photo = {
    id: "p1",
    uri: "file:///local.jpg",
    kind: "original",
    caption: "Fire extinguisher tag",
  };
  const insp = await makeInspection(a, {
    results: [{ item: "PPE", passed: true, notes: "all good", photos: [photo] }],
  });

  const readBack = await getInspection(a, insp.id);
  assert.ok(readBack, "expected the created inspection to be readable back");
  assert.equal(readBack!.results.length, 1);
  const readPhotos = readBack!.results[0].photos as Array<Record<string, unknown>> | undefined;
  assert.ok(readPhotos, "expected photos to survive the round-trip");
  assert.equal(readPhotos!.length, 1);
  assert.equal(readPhotos![0].id, "p1");
  assert.equal(readPhotos![0].uri, "file:///local.jpg");
  assert.equal(readPhotos![0].kind, "original");
  assert.equal(readPhotos![0].caption, "Fire extinguisher tag");
});

test("Part B / server-side guard: base64 is stripped from result photos on create AND update, identity preserved", async () => {
  const companyId = "sig-photo-b64strip-" + uniq();
  const a = actor(companyId);

  // A client that (wrongly) sends base64 image data in a checklist photo.
  const withB64 = {
    id: "p1",
    uri: "/uploads/abc-tag.jpg",
    kind: "original",
    base64: "AAAABBBBCCCCDDDD-pretend-image-bytes",
  };
  const insp = await makeInspection(a, {
    results: [{ item: "PPE", passed: true, notes: "", photos: [withB64] }],
  });
  const created = (await getInspection(a, insp.id))!.results[0].photos as Array<Record<string, unknown>>;
  assert.equal("base64" in created[0], false, "base64 must NOT be persisted into results_json on create");
  assert.equal(created[0].id, "p1", "identity (id) is preserved");
  assert.equal(created[0].uri, "/uploads/abc-tag.jpg", "uri/storageKey ref is preserved");

  // And on update, too.
  await updateInspection(a, insp.id, {
    results: [{ item: "PPE", passed: true, notes: "", photos: [{ id: "p2", uri: "/uploads/def.jpg", kind: "original", base64: "MORE-fake-bytes" }] }],
  });
  const updated = (await getInspection(a, insp.id))!.results[0].photos as Array<Record<string, unknown>>;
  assert.equal("base64" in updated[0], false, "base64 must NOT be persisted into results_json on update");
  assert.equal(updated[0].id, "p2", "updated photo identity preserved");
});
