/**
 * Regression tests for AUDIT.md findings H4/H6 — "writes into push_tokens,
 * entry_templates, and worker_locations never populated company_id".
 *
 * These three stores are exercised directly (no HTTP layer) because the bug
 * being guarded against is entirely internal to the store's write path: does
 * the record the store constructs/returns carry `companyId: actor.companyId`,
 * or does it silently drop tenant context the way the pre-X1 code did?
 *
 * Each test asserts the *exact* companyId value against a distinctive,
 * hand-picked constant (not just `=== actor.companyId` by reference) so that
 * reverting the fix — whether by deleting the field assignment, hardcoding a
 * wrong value, or defaulting to `undefined` — is guaranteed to fail the
 * assertion rather than accidentally still matching.
 *
 * Runs against the in-memory branch of each store (DATABASE_URL is "" under
 * NODE_ENV=test — see test-setup.ts), which is exactly the branch H6
 * identified as broken.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { Actor } from "./actor";
import { upsertPushToken } from "./pushStore";
import { createTemplate } from "./templateStore";
import { upsertLocation } from "./locationStore";

test("upsertPushToken (pushStore): returned record.companyId matches the acting user's company (H6 regression)", async () => {
  const actor: Actor = {
    email: "pushtoken-owner@co-id-write.test",
    role: "worker",
    companyId: "company-alpha-1234",
    companyRole: "owner",
  };
  const token = `ExponentPushToken[company-id-write-test-${Date.now()}-${Math.random().toString(16).slice(2)}]`;

  const record = await upsertPushToken(actor, token, "expo");

  assert.equal(
    record.companyId,
    actor.companyId,
    "upsertPushToken must stamp the returned record with the acting user's companyId"
  );
  assert.equal(record.companyId, "company-alpha-1234", "companyId must be the exact value from the actor, not dropped/defaulted");
  assert.equal(record.ownerEmail, actor.email);
  assert.equal(record.token, token);
});

test("createTemplate (templateStore, entry-templates): returned record.companyId matches the acting user's company (H6 regression)", async () => {
  const actor: Actor = {
    email: "template-owner@co-id-write.test",
    role: "worker",
    companyId: "company-beta-5678",
    companyRole: "owner",
  };

  const record = await createTemplate(actor, { name: "Company-ID Write Test Template", notes: "", crewCount: "", weather: "" });

  assert.equal(
    record.companyId,
    actor.companyId,
    "createTemplate must stamp the returned entry-template with the acting user's companyId"
  );
  assert.equal(record.companyId, "company-beta-5678", "companyId must be the exact value from the actor, not dropped/defaulted");
  assert.equal(record.ownerEmail, actor.email);
});

test("upsertLocation (locationStore): returned record.companyId matches the acting user's company (H4/H6 regression)", async () => {
  const actor: Actor = {
    email: "location-owner@co-id-write.test",
    role: "worker",
    companyId: "company-gamma-9999",
    companyRole: "crew",
  };

  const record = await upsertLocation(actor, { latitude: -33.8688, longitude: 151.2093 });

  assert.equal(
    record.companyId,
    actor.companyId,
    "upsertLocation must stamp the returned worker-location record with the acting user's companyId"
  );
  assert.equal(record.companyId, "company-gamma-9999", "companyId must be the exact value from the actor, not dropped/defaulted");
  assert.equal(record.userEmail, actor.email);
});
