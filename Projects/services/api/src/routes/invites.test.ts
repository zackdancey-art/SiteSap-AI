import assert from "node:assert/strict";
import { test, before, after, beforeEach } from "node:test";
import http from "node:http";
import { createApp } from "../server";
import { resetAuthStoreForTests } from "../storage/authStore";
import { resetProjectStoreForTests } from "../storage/projectsStore";
import { resetRateLimitStoreForTests } from "../middleware/rateLimit";

let server: http.Server;
let baseUrl: string;

async function req<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
  token?: string
): Promise<{ status: number; body: T }> {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : undefined;
    const options: http.RequestOptions = {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(payload ? { "Content-Length": Buffer.byteLength(payload).toString() } : {}),
      },
    };
    const r = http.request(`${baseUrl}/api${path}`, options, (res) => {
      let data = "";
      res.on("data", (chunk: string) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode ?? 0, body: JSON.parse(data) as T });
        } catch {
          reject(new Error(`Non-JSON response (${res.statusCode}): ${data}`));
        }
      });
    });
    r.on("error", reject);
    if (payload) r.write(payload);
    r.end();
  });
}

before(async () => {
  // supervisor@example.com is allowed to register as supervisor
  process.env.SUPERVISOR_SIGNUP_EMAILS = "supervisor@example.com";
  const app = createApp();
  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address() as { port: number };
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
});

beforeEach(async () => {
  await resetAuthStoreForTests();
  await resetProjectStoreForTests();
  resetRateLimitStoreForTests();
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function registerAndLogin(email: string, phone: string, fullName: string): Promise<string> {
  const reg = await req<{ devCodes?: { emailCode: string; smsCode: string } }>(
    "POST", "/auth/register",
    { email, password: "Password123!", phone, fullName }
  );
  const { emailCode, smsCode } = reg.body.devCodes!;
  const verify = await req<{ token: string }>(
    "POST", "/auth/register/verify",
    { email, emailCode, smsCode }
  );
  return verify.body.token;
}

async function createSite(token: string, name = "Test Site"): Promise<string> {
  const r = await req<{ site: { id: string } }>(
    "POST", "/projects/sites",
    { name, address: "1 Main St", client: "ACME", startDate: "2025-01-01", status: "active" },
    token
  );
  assert.equal(r.status, 201);
  return r.body.site.id;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test("supervisor can create an invite", async () => {
  const supToken = await registerAndLogin("supervisor@example.com", "+447911000010", "Supervisor");
  const siteId = await createSite(supToken);

  const r = await req<{ results: Array<{ email: string; status: string }> }>(
    "POST",
    `/projects/sites/${siteId}/invites`,
    { emails: ["worker1@example.com"], role: "worker" },
    supToken
  );
  assert.equal(r.status, 201);
  assert.equal(r.body.results.length, 1);
  assert.equal(r.body.results[0].email, "worker1@example.com");
  assert.equal(r.body.results[0].status, "sent");
});

test("worker (non-supervisor, non-owner) gets 403 when creating invite", async () => {
  const supToken = await registerAndLogin("supervisor@example.com", "+447911000010", "Supervisor");
  const workerToken = await registerAndLogin("worker1@example.com", "+447911000011", "Worker");
  const siteId = await createSite(supToken);

  const r = await req<{ error: string }>(
    "POST",
    `/projects/sites/${siteId}/invites`,
    { emails: ["other@example.com"], role: "worker" },
    workerToken
  );
  assert.equal(r.status, 403);
});

test("site owner (worker role) can create invite for their own site", async () => {
  const ownerToken = await registerAndLogin("owner@example.com", "+447911000020", "Owner");
  const siteId = await createSite(ownerToken);

  const r = await req<{ results: Array<{ email: string; status: string }> }>(
    "POST",
    `/projects/sites/${siteId}/invites`,
    { emails: ["invited@example.com"], role: "worker" },
    ownerToken
  );
  assert.equal(r.status, 201);
  assert.equal(r.body.results[0].status, "sent");
});

test("accepted invite registers user as member; token cannot be reused", async () => {
  const supToken = await registerAndLogin("supervisor@example.com", "+447911000010", "Supervisor");
  const siteId = await createSite(supToken, "Invite Site");

  // Send invite
  await req(
    "POST", `/projects/sites/${siteId}/invites`,
    { emails: ["joiner@example.com"], role: "worker" },
    supToken
  );

  // List invites to get the token
  const listR = await req<{ invites: Array<{ token: string }> }>(
    "GET", `/projects/sites/${siteId}/invites`, undefined, supToken
  );
  assert.equal(listR.body.invites.length, 1);
  const token = listR.body.invites[0].token;
  assert.ok(token, "token should be present");

  // Register the invitee
  const joinerToken = await registerAndLogin("joiner@example.com", "+447911000030", "Joiner");

  // Accept the invite
  const acceptR = await req<{ siteId: string; siteName: string; role: string }>(
    "POST", "/projects/invites/accept",
    { token },
    joinerToken
  );
  assert.equal(acceptR.status, 200);
  assert.equal(acceptR.body.siteId, siteId);
  assert.equal(acceptR.body.siteName, "Invite Site");
  assert.equal(acceptR.body.role, "worker");

  // Verify the joiner appears in members list
  const membersR = await req<{ members: Array<{ memberEmail: string }> }>(
    "GET", `/projects/sites/${siteId}/members`, undefined, supToken
  );
  assert.equal(membersR.status, 200);
  assert.ok(membersR.body.members.some((m) => m.memberEmail === "joiner@example.com"));

  // Reuse the same token → should fail (token was consumed)
  const reuse = await req<{ error: string }>(
    "POST", "/projects/invites/accept",
    { token },
    joinerToken
  );
  assert.equal(reuse.status, 404, "reused token must be rejected");
});

test("expired or unknown token is rejected", async () => {
  const joinerToken = await registerAndLogin("joiner2@example.com", "+447911000040", "Joiner2");
  const r = await req<{ error: string }>(
    "POST", "/projects/invites/accept",
    { token: "0000000000000000000000000000000000000000000000000000000000000000" },
    joinerToken
  );
  assert.equal(r.status, 404, "unknown/expired token must return 404");
});

test("wrong-user token is rejected", async () => {
  const supToken = await registerAndLogin("supervisor@example.com", "+447911000010", "Supervisor");
  const siteId = await createSite(supToken);

  await req("POST", `/projects/sites/${siteId}/invites`,
    { emails: ["target@example.com"], role: "worker" }, supToken);

  const listR = await req<{ invites: Array<{ token: string }> }>(
    "GET", `/projects/sites/${siteId}/invites`, undefined, supToken
  );
  const token = listR.body.invites[0].token;

  // Different user tries to accept
  const otherToken = await registerAndLogin("other@example.com", "+447911000050", "Other");
  const r = await req<{ error: string }>(
    "POST", "/projects/invites/accept",
    { token },
    otherToken
  );
  assert.equal(r.status, 403, "wrong-user token must return 403");
  // Original token must still be valid (wasn't consumed)
  const targetToken = await registerAndLogin("target@example.com", "+447911000060", "Target");
  const r2 = await req<{ siteId: string }>(
    "POST", "/projects/invites/accept",
    { token },
    targetToken
  );
  assert.equal(r2.status, 200, "original invitee can still accept");
});

test("invited member sees the site in their sites list", async () => {
  const supToken = await registerAndLogin("supervisor@example.com", "+447911000010", "Supervisor");
  const siteId = await createSite(supToken, "Member Site");

  await req("POST", `/projects/sites/${siteId}/invites`,
    { emails: ["member@example.com"], role: "worker" }, supToken);

  const listR = await req<{ invites: Array<{ token: string }> }>(
    "GET", `/projects/sites/${siteId}/invites`, undefined, supToken
  );
  const token = listR.body.invites[0].token;

  const memberToken = await registerAndLogin("member@example.com", "+447911000070", "Member");
  await req("POST", "/projects/invites/accept", { token }, memberToken);

  const sitesR = await req<{ sites: Array<{ id: string; name: string }> }>(
    "GET", "/projects/sites", undefined, memberToken
  );
  assert.equal(sitesR.status, 200);
  assert.ok(sitesR.body.sites.some((s) => s.id === siteId && s.name === "Member Site"),
    "member should see the invited site");
});

test("supervisor can revoke an invite", async () => {
  const supToken = await registerAndLogin("supervisor@example.com", "+447911000010", "Supervisor");
  const siteId = await createSite(supToken);

  await req("POST", `/projects/sites/${siteId}/invites`,
    { emails: ["revoked@example.com"], role: "worker" }, supToken);

  const listR = await req<{ invites: Array<{ id: string; token: string }> }>(
    "GET", `/projects/sites/${siteId}/invites`, undefined, supToken
  );
  const invite = listR.body.invites[0];

  const delR = await req("DELETE", `/projects/sites/${siteId}/invites/${invite.id}`, undefined, supToken);
  assert.equal(delR.status, 200);

  // Token should now be invalid
  const joinerToken = await registerAndLogin("revoked@example.com", "+447911000080", "Revoked");
  const acceptR = await req<{ error: string }>(
    "POST", "/projects/invites/accept",
    { token: invite.token },
    joinerToken
  );
  assert.equal(acceptR.status, 404, "revoked invite token should not be accepted");
});

test("already_member status returned for existing member", async () => {
  const supToken = await registerAndLogin("supervisor@example.com", "+447911000010", "Supervisor");
  const siteId = await createSite(supToken);

  // Invite and accept once
  await req("POST", `/projects/sites/${siteId}/invites`,
    { emails: ["repeat@example.com"], role: "worker" }, supToken);
  const listR = await req<{ invites: Array<{ token: string }> }>(
    "GET", `/projects/sites/${siteId}/invites`, undefined, supToken
  );
  const memberToken = await registerAndLogin("repeat@example.com", "+447911000090", "Repeat");
  await req("POST", "/projects/invites/accept", { token: listR.body.invites[0].token }, memberToken);

  // Invite again → should return already_member
  const r2 = await req<{ results: Array<{ email: string; status: string }> }>(
    "POST", `/projects/sites/${siteId}/invites`,
    { emails: ["repeat@example.com"], role: "worker" },
    supToken
  );
  assert.equal(r2.status, 201);
  assert.equal(r2.body.results[0].status, "already_member");
});

test("supervisor can remove a member", async () => {
  const supToken = await registerAndLogin("supervisor@example.com", "+447911000010", "Supervisor");
  const siteId = await createSite(supToken);

  await req("POST", `/projects/sites/${siteId}/invites`,
    { emails: ["leaveme@example.com"], role: "worker" }, supToken);
  const listR = await req<{ invites: Array<{ token: string }> }>(
    "GET", `/projects/sites/${siteId}/invites`, undefined, supToken
  );
  const memberToken = await registerAndLogin("leaveme@example.com", "+447911000095", "Leave");
  await req("POST", "/projects/invites/accept", { token: listR.body.invites[0].token }, memberToken);

  const removeR = await req(
    "DELETE", `/projects/sites/${siteId}/members/leaveme@example.com`,
    undefined, supToken
  );
  assert.equal(removeR.status, 200);

  // Member should no longer see the site
  const sitesR = await req<{ sites: Array<{ id: string }> }>(
    "GET", "/projects/sites", undefined, memberToken
  );
  assert.ok(!sitesR.body.sites.some((s) => s.id === siteId), "removed member should not see the site");
});
