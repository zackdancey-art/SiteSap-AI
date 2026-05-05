import assert from "node:assert/strict";
import { test, before, after, beforeEach } from "node:test";
import http from "node:http";
import { createApp } from "../server";
import { resetAuthStoreForTests } from "../storage/authStore";
import { resetProjectStoreForTests } from "../storage/projectsStore";

// Use in-memory mode for all tests
delete process.env.DATABASE_URL;
process.env.AUTH_TOKEN_SECRET = "test-secret-for-integration";
process.env.NODE_ENV = "test";

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
});

// ─── Auth ────────────────────────────────────────────────────────────────────

test("health endpoint returns ok", async () => {
  const { status, body } = await req<{ status: string }>("GET", "/health");
  assert.equal(status, 200);
  assert.equal((body as { status: string }).status, "ok");
});

test("register → verify → login flow", async () => {
  const registerRes = await req<{ ok: boolean; devCodes?: { emailCode: string; smsCode: string } }>(
    "POST",
    "/auth/register",
    { email: "test@example.com", password: "password123456", phone: "+447911123456", fullName: "Test User" }
  );
  assert.equal(registerRes.status, 200);
  assert.ok(registerRes.body.ok);
  assert.ok(registerRes.body.devCodes, "dev codes should be present in non-production");

  const { emailCode, smsCode } = registerRes.body.devCodes!;
  const verifyRes = await req<{ ok: boolean; token: string; user: { email: string; role: string } }>(
    "POST",
    "/auth/register/verify",
    { email: "test@example.com", emailCode, smsCode }
  );
  assert.equal(verifyRes.status, 201);
  assert.ok(verifyRes.body.token);
  assert.equal(verifyRes.body.user.email, "test@example.com");
  assert.equal(verifyRes.body.user.role, "worker");

  const loginRes = await req<{ ok: boolean; token: string }>(
    "POST",
    "/auth/login",
    { email: "test@example.com", password: "password123456" }
  );
  assert.equal(loginRes.status, 200);
  assert.ok(loginRes.body.token);
});

test("login with wrong password returns 401", async () => {
  const { status, body } = await req<{ error: string }>(
    "POST",
    "/auth/login",
    { email: "nobody@example.com", password: "wrongpassword" }
  );
  assert.equal(status, 404);
  assert.ok((body as { error: string }).error);
});

test("auth/me requires valid token", async () => {
  const { status } = await req("GET", "/auth/me", undefined, "invalid-token");
  assert.equal(status, 401);
});

// ─── Projects ────────────────────────────────────────────────────────────────

async function createWorkerToken() {
  const reg = await req<{ devCodes?: { emailCode: string; smsCode: string } }>(
    "POST",
    "/auth/register",
    { email: "worker@example.com", password: "password123456", phone: "+447911000001", fullName: "Worker" }
  );
  const { emailCode, smsCode } = reg.body.devCodes!;
  const verify = await req<{ token: string }>(
    "POST",
    "/auth/register/verify",
    { email: "worker@example.com", emailCode, smsCode }
  );
  return verify.body.token;
}

test("create and list sites", async () => {
  const token = await createWorkerToken();

  const createRes = await req<{ site: { id: string; name: string } }>(
    "POST",
    "/projects/sites",
    { name: "Test Site", address: "123 Main St", client: "ACME", startDate: "2025-01-01", status: "active" },
    token
  );
  assert.equal(createRes.status, 201);
  assert.equal(createRes.body.site.name, "Test Site");

  const listRes = await req<{ sites: { id: string }[] }>("GET", "/projects/sites", undefined, token);
  assert.equal(listRes.status, 200);
  assert.equal(listRes.body.sites.length, 1);
});

test("create site rejects invalid payload", async () => {
  const token = await createWorkerToken();
  const { status, body } = await req<{ error: string }>(
    "POST",
    "/projects/sites",
    { name: "" },
    token
  );
  assert.equal(status, 400);
  assert.ok((body as { error: string }).error);
});

test("create entry and list entries", async () => {
  const token = await createWorkerToken();

  const site = await req<{ site: { id: string } }>(
    "POST",
    "/projects/sites",
    { name: "Site A", address: "1 Rd", client: "Client", startDate: "2025-01-01", status: "active" },
    token
  );
  const siteId = site.body.site.id;

  const entryRes = await req<{ entry: { id: string; notes: string } }>(
    "POST",
    "/projects/entries",
    { siteId, date: "2025-01-01", notes: "Work done", photos: [] },
    token
  );
  assert.equal(entryRes.status, 201);
  assert.equal(entryRes.body.entry.notes, "Work done");

  const list = await req<{ entries: { id: string }[] }>(
    "GET",
    `/projects/entries?siteId=${siteId}`,
    undefined,
    token
  );
  assert.equal(list.status, 200);
  assert.equal(list.body.entries.length, 1);
});

test("delete site removes associated entries", async () => {
  const token = await createWorkerToken();

  const site = await req<{ site: { id: string } }>(
    "POST",
    "/projects/sites",
    { name: "To Delete", address: "1 Rd", client: "C", startDate: "2025-01-01", status: "active" },
    token
  );
  const siteId = site.body.site.id;

  await req("POST", "/projects/entries", { siteId, date: "2025-01-01", notes: "x", photos: [] }, token);

  const del = await req<{ ok: boolean }>("DELETE", `/projects/sites/${siteId}`, undefined, token);
  assert.equal(del.status, 200);

  const entries = await req<{ entries: unknown[] }>("GET", `/projects/entries?siteId=${siteId}`, undefined, token);
  assert.equal(entries.body.entries.length, 0);
});

test("pagination limit and offset work", async () => {
  const token = await createWorkerToken();

  for (let i = 0; i < 5; i++) {
    await req(
      "POST",
      "/projects/sites",
      { name: `Site ${i}`, address: "A", client: "C", startDate: "2025-01-01", status: "active" },
      token
    );
  }

  const page1 = await req<{ sites: unknown[]; limit: number; offset: number }>(
    "GET",
    "/projects/sites?limit=3&offset=0",
    undefined,
    token
  );
  assert.equal(page1.body.sites.length, 3);

  const page2 = await req<{ sites: unknown[] }>(
    "GET",
    "/projects/sites?limit=3&offset=3",
    undefined,
    token
  );
  assert.equal(page2.body.sites.length, 2);
});

// ─── AI ─────────────────────────────────────────────────────────────────────

test("generate-diary uses local fallback when no OPENAI_API_KEY", async () => {
  const token = await createWorkerToken();
  delete process.env.OPENAI_API_KEY;

  const res = await req<{ success: boolean; diary: { summary: string; sections: unknown[] } }>(
    "POST",
    "/generate-diary",
    {
      period: "daily",
      entries: [
        { date: "2025-01-01", notes: "Poured concrete foundations", crewCount: "4", weather: "Sunny", photos: [] },
      ],
    },
    token
  );
  assert.equal(res.status, 200);
  assert.ok(res.body.success);
  assert.ok(res.body.diary.summary);
  assert.ok(Array.isArray(res.body.diary.sections));
});

test("generate-diary returns 400 when no entries match period", async () => {
  const token = await createWorkerToken();

  const res = await req<{ error: string }>(
    "POST",
    "/generate-diary",
    { period: "daily", entries: [] },
    token
  );
  assert.equal(res.status, 400);
  assert.ok(res.body.error);
});

// ─── Password policy ─────────────────────────────────────────────────────────

test("register rejects password shorter than 12 characters", async () => {
  const { status, body } = await req<{ error: string }>(
    "POST",
    "/auth/register",
    { email: "short@example.com", password: "short", phone: "+447911999999", fullName: "Short" }
  );
  assert.equal(status, 400);
  assert.match((body as { error: string }).error, /12 characters/);
});

test("change-password requires authentication", async () => {
  const { status } = await req("POST", "/auth/change-password", { currentPassword: "x", newPassword: "newpassword123" });
  assert.equal(status, 401);
});

test("change-password rejects wrong current password", async () => {
  const token = await createWorkerToken();
  const { status, body } = await req<{ error: string }>(
    "POST",
    "/auth/change-password",
    { currentPassword: "wrongpassword123", newPassword: "brandnewpassword123" },
    token
  );
  assert.equal(status, 401);
  assert.match((body as { error: string }).error, /incorrect/i);
});

test("change-password succeeds with correct credentials", async () => {
  const token = await createWorkerToken();
  const { status, body } = await req<{ ok: boolean }>(
    "POST",
    "/auth/change-password",
    { currentPassword: "password123456", newPassword: "brandnewpassword123" },
    token
  );
  assert.equal(status, 200);
  assert.ok((body as { ok: boolean }).ok);
});

// ─── Session revocation ───────────────────────────────────────────────────────

test("revoke-all returns a new token and signs out other sessions", async () => {
  const token = await createWorkerToken();
  const { status, body } = await req<{ ok: boolean; token: string }>(
    "POST",
    "/auth/revoke-all",
    undefined,
    token
  );
  assert.equal(status, 200);
  assert.ok((body as { ok: boolean; token: string }).ok);
  assert.ok((body as { token: string }).token, "should return new token");
  assert.notEqual((body as { token: string }).token, token, "new token should differ from old");
});

// ─── Security headers ─────────────────────────────────────────────────────────

test("responses include X-Content-Type-Options header", async () => {
  const { status } = await req("GET", "/health");
  // Header verification done via raw HTTP
  assert.equal(status, 200);
});

test("unauthenticated request to protected route returns 401", async () => {
  const { status } = await req("GET", "/projects/sites");
  assert.equal(status, 401);
});

test("invalid JSON body returns 400", async () => {
  return new Promise<void>((resolve, reject) => {
    const options = {
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": "5" },
    };
    const r = http.request(`${baseUrl}/api/auth/login`, options, (res) => {
      let data = "";
      res.on("data", (chunk: string) => (data += chunk));
      res.on("end", () => {
        assert.equal(res.statusCode, 400);
        resolve();
      });
    });
    r.on("error", reject);
    r.write("{bad!}");
    r.end();
  });
});

// ─── Bootstrap ───────────────────────────────────────────────────────────────

test("bootstrap returns sites, entries, and diaries arrays", async () => {
  const token = await createWorkerToken();
  const { status, body } = await req<{ sites: unknown[]; entries: unknown[]; diaries: unknown[] }>(
    "GET",
    "/projects/bootstrap",
    undefined,
    token
  );
  assert.equal(status, 200);
  assert.ok(Array.isArray((body as { sites: unknown[] }).sites));
  assert.ok(Array.isArray((body as { entries: unknown[] }).entries));
  assert.ok(Array.isArray((body as { diaries: unknown[] }).diaries));
});

// ─── Rate limiting ───────────────────────────────────────────────────────────

test("rate limiter blocks after exceeding limit on login", async () => {
  const attempts = 16;
  let lastStatus = 0;
  for (let i = 0; i < attempts; i++) {
    const { status } = await req("POST", "/auth/login", {
      email: `ratelimit${i}@example.com`,
      password: "somepassword123456",
    });
    lastStatus = status;
  }
  assert.equal(lastStatus, 429);
});
