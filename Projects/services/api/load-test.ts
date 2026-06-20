/**
 * SiteSnap Load / Integration Test
 *
 * Run from the services/api directory:
 *   DATABASE_URL=postgres://... npx ts-node-dev --transpile-only --exit-child load-test.ts
 *
 * Or with the package.json script:
 *   pnpm run load-test
 *
 * See load-test-report.md for results after each run.
 * NEVER run against production.
 */

import crypto from "crypto";
import { promisify } from "util";
import { Pool } from "pg";
import * as fs from "fs";
import * as path from "path";
import * as http from "http";
import * as https from "https";

// ============================================================
// ADJUSTABLE PARAMETERS
// ============================================================
const TOTAL_USERS = 1000;
const SUPERVISORS = 150;  // first SUPERVISORS users get role="supervisor"
const SITES = 30;
const DAYS = 7;
const ENTRIES_PER_USER_MIN = 3;
const ENTRIES_PER_USER_MAX = 10;
const CONCURRENCY = 25;
const USE_REAL_AI = false;
const API_BASE = (process.env.API_BASE ?? "http://localhost:4000").replace(/\/$/, "");
const AUTH_SECRET = process.env.AUTH_TOKEN_SECRET ?? "dev-sitesnap-secret";
const TEST_PASSWORD = "Loadtest1!";

// ============================================================
// TYPES
// ============================================================

interface TestUser {
  index: number;
  email: string;
  fullName: string;
  phone: string;
  role: "worker" | "supervisor";
  token: string;
}

interface TestSite {
  id: string;
  name: string;
  ownerEmail: string;
}

interface Metric {
  operation: string;
  status: number;
  durationMs: number;
  ok: boolean;
  error?: string;
  detail?: string;
}

interface DistinctError {
  key: string;
  count: number;
  status: number;
  operation: string;
  exampleDetail: string;
  likelyCause: string;
}

// ============================================================
// CRYPTO UTILITIES  (mirrors services/api/src/utils/*)
// ============================================================

const scryptAsync = promisify(crypto.scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

function createToken(email: string, fullName: string, role: string): string {
  const now = Math.floor(Date.now() / 1000);
  const claims = { email, fullName, role, iat: now, exp: now + 60 * 60 * 24 * 7 };
  const payload = Buffer.from(JSON.stringify(claims), "utf8").toString("base64url");
  const signature = crypto.createHmac("sha256", AUTH_SECRET).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

// ============================================================
// CONCURRENCY POOL
// ============================================================

async function poolMap<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i], i);
    }
  }
  const workers = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workers }, worker));
  return results;
}

// ============================================================
// HTTP CLIENT
// ============================================================

interface ApiResult {
  status: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
  durationMs: number;
}

async function apiRequest(
  method: string,
  urlPath: string,
  body?: unknown,
  token?: string
): Promise<ApiResult> {
  const url = `${API_BASE}/api${urlPath}`;
  const start = Date.now();

  return new Promise((resolve) => {
    const isHttps = url.startsWith("https");
    const parsed = new URL(url);
    const payload = body ? JSON.stringify(body) : undefined;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Content-Length": payload ? Buffer.byteLength(payload).toString() : "0",
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method,
      headers,
    };

    const req = (isHttps ? https : http).request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => {
        const durationMs = Date.now() - start;
        const text = Buffer.concat(chunks).toString("utf8");
        let data: unknown;
        try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
        resolve({ status: res.statusCode ?? 0, data, durationMs });
      });
    });

    req.on("error", (err) => {
      resolve({ status: 0, data: { error: err.message }, durationMs: Date.now() - start });
    });

    if (payload) req.write(payload);
    req.end();
  });
}

// ============================================================
// METRICS COLLECTOR
// ============================================================

class MetricsCollector {
  private items: Metric[] = [];

  record(m: Metric) {
    this.items.push(m);
  }

  summary() {
    const byOp = new Map<string, Metric[]>();
    for (const m of this.items) {
      if (!byOp.has(m.operation)) byOp.set(m.operation, []);
      byOp.get(m.operation)!.push(m);
    }

    const result: Record<string, {
      attempted: number; succeeded: number; failed: number;
      avgMs: number; p50Ms: number; p95Ms: number; maxMs: number;
    }> = {};

    for (const [op, mets] of byOp) {
      const durations = mets.map((m) => m.durationMs).sort((a, b) => a - b);
      const len = durations.length;
      result[op] = {
        attempted: len,
        succeeded: mets.filter((m) => m.ok).length,
        failed: mets.filter((m) => !m.ok).length,
        avgMs: Math.round(durations.reduce((a, b) => a + b, 0) / len),
        p50Ms: durations[Math.floor(len * 0.5)] ?? 0,
        p95Ms: durations[Math.floor(len * 0.95)] ?? 0,
        maxMs: durations[len - 1] ?? 0,
      };
    }
    return result;
  }

  errors(): Metric[] {
    return this.items.filter((m) => !m.ok);
  }

  distinctErrors(): DistinctError[] {
    const map = new Map<string, DistinctError>();
    for (const m of this.errors()) {
      const key = `${m.operation}:${m.status}:${m.error ?? "unknown"}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          count: 0,
          status: m.status,
          operation: m.operation,
          exampleDetail: m.detail ?? m.error ?? "",
          likelyCause: diagnoseCause(m),
        });
      }
      map.get(key)!.count++;
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }

  totalRequests() { return this.items.length; }
  totalSucceeded() { return this.items.filter((m) => m.ok).length; }
  totalFailed() { return this.items.filter((m) => !m.ok).length; }
}

function diagnoseCause(m: Metric): string {
  if (m.status === 429) return "In-memory rate limiter: all load-test requests share the same loopback IP, exhausting the per-IP window.";
  if (m.status === 401) return "Invalid or expired auth token, or AUTH_TOKEN_SECRET mismatch.";
  if (m.status === 403) return "Correct — worker correctly denied access to supervisor-only endpoint.";
  if (m.status === 409) return "Duplicate record (unique constraint). User/phone already exists; re-run teardown before retesting.";
  if (m.status === 0) return "API server not reachable — confirm it is running on " + API_BASE;
  if (m.status >= 500) return "Unhandled server error — check API logs for stack trace.";
  return "Unexpected response. See detail.";
}

// ============================================================
// HELPERS
// ============================================================

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const WEATHER_OPTIONS = ["Sunny", "Cloudy", "Rainy", "Overcast", "Windy", "Foggy", "Partly cloudy"];
const NOTES_OPTIONS = [
  "Foundation work continues on schedule.",
  "Electrical rough-in completed on level 2.",
  "Framing inspection passed.",
  "Concrete poured for east wall.",
  "Safety briefing held at start of shift.",
  "Equipment delivery received and logged.",
  "Minor rework needed on plumbing penetrations.",
  "Scaffolding erected on north face.",
  "Progress meeting held — no blockers.",
  "Site access restricted due to weather.",
];

function randomDateInWindow(weekStart: Date, days: number): string {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + randomInt(0, days - 1));
  return d.toISOString().split("T")[0];
}

function log(msg: string) {
  const ts = new Date().toISOString().replace("T", " ").split(".")[0];
  console.log(`[${ts}] ${msg}`);
}

// ============================================================
// PHASE 1 — SAFETY CHECK
// ============================================================

async function safetyCheck(pool: Pool) {
  const dbUrl = process.env.DATABASE_URL ?? "";
  if (!dbUrl) throw new Error("DATABASE_URL is not set. Provide a local/test Postgres URL.");

  const prodPatterns = [
    "render.com", "supabase.co", "neon.tech", "rds.amazonaws.com",
    "railway.app", "planetscale.com", "cockroachdb.com", "fly.io",
    "heroku.com", "aiven.io",
  ];
  if (prodPatterns.some((p) => dbUrl.toLowerCase().includes(p))) {
    throw new Error(
      `🛑 STOPPED: DATABASE_URL looks like a production database.\n` +
      `URL: ${dbUrl}\n` +
      `Only run this test against a local/test database.`
    );
  }

  const isLocal =
    dbUrl.includes("localhost") ||
    dbUrl.includes("127.0.0.1") ||
    dbUrl.includes("@postgres") ||
    dbUrl.includes("test");

  if (!isLocal) {
    console.warn(`\n⚠️  WARNING: DATABASE_URL doesn't look local: ${dbUrl.replace(/:[^:@]+@/, ":***@")}`);
    console.warn("   This script will proceed in 5 seconds. Press Ctrl+C to abort.\n");
    await new Promise((r) => setTimeout(r, 5000));
  }

  // Verify API is reachable
  const health = await apiRequest("GET", "/../health");
  if (health.status !== 200) {
    throw new Error(`API server not reachable at ${API_BASE}. Start it with: pnpm run dev\nStatus: ${health.status}`);
  }

  // Verify DB connection
  await pool.query("SELECT 1");

  log(`✅ Safety check passed — DB and API are reachable.`);
  if (AUTH_SECRET === "dev-sitesnap-secret") {
    console.warn("   ⚠️  Using default dev AUTH_TOKEN_SECRET. Set AUTH_TOKEN_SECRET env var if the server uses a custom secret.");
  }
}

// ============================================================
// PHASE 2 — CREATE USERS (direct DB insert — rate limiter bypass note)
// ============================================================

async function createUsers(pool: Pool, metrics: MetricsCollector): Promise<TestUser[]> {
  log(`Creating ${TOTAL_USERS} users directly in DB (bypassing HTTP auth — see findings)...`);

  const hash = await hashPassword(TEST_PASSWORD);
  const users: TestUser[] = [];

  for (let i = 0; i < TOTAL_USERS; i++) {
    const isSupervisor = i < SUPERVISORS;
    const role = isSupervisor ? "supervisor" : "worker";
    const prefix = isSupervisor ? "sup" : "user";
    const email = `loadtest+${prefix}${i}@sitesnap.test`;
    const fullName = isSupervisor ? `Load Supervisor ${i}` : `Load Worker ${i}`;
    // Unique phone per user — format: +1555000XXXX (padded to 10 digits after +1555)
    const phone = `+1555${String(i).padStart(7, "0")}`;
    const token = createToken(email, fullName, role);
    users.push({ index: i, email, fullName, phone, role, token });
  }

  // Batch insert (100 at a time) with ON CONFLICT DO UPDATE to be idempotent
  const batchSize = 100;
  let inserted = 0;
  let skipped = 0;

  for (let i = 0; i < users.length; i += batchSize) {
    const batch = users.slice(i, i + batchSize);
    const start = Date.now();
    try {
      const valuePlaceholders = batch
        .map((_, j) => `($${j * 5 + 1}, $${j * 5 + 2}, $${j * 5 + 3}, $${j * 5 + 4}, $${j * 5 + 5})`)
        .join(", ");
      const params = batch.flatMap((u) => [u.email, hash, u.phone, u.fullName, u.role]);

      const result = await pool.query(
        `INSERT INTO auth_users (email, password_hash, phone, full_name, role)
         VALUES ${valuePlaceholders}
         ON CONFLICT (email) DO UPDATE SET
           full_name = EXCLUDED.full_name,
           role = EXCLUDED.role
         `,
        params
      );
      inserted += result.rowCount ?? 0;
      metrics.record({ operation: "db:user-insert-batch", status: 200, durationMs: Date.now() - start, ok: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      skipped += batch.length;
      metrics.record({
        operation: "db:user-insert-batch",
        status: 500,
        durationMs: Date.now() - start,
        ok: false,
        error: "DB insert failed",
        detail: msg,
      });
      console.error(`  Batch ${i}–${i + batch.length} insert error:`, msg);
    }
  }

  log(`  Users ready: ${inserted} inserted/updated, ${skipped} errors.`);
  log("  NOTE: HTTP registration was skipped — the in-memory rate limiter allows only 8 initiations");
  log("  per 10-minute window per IP. From localhost all requests share the same IP, so registering");
  log(`  ${TOTAL_USERS} users via HTTP would take ~${Math.ceil(TOTAL_USERS / 8) * 10} minutes. See findings.`);
  return users;
}

// ============================================================
// PHASE 2b — SAMPLE HTTP LOGIN (demonstrates rate limit behavior)
// ============================================================

async function sampleHttpLogin(users: TestUser[], metrics: MetricsCollector) {
  log("Testing HTTP login for first 20 users to verify auth flow + demonstrate rate limiting...");

  const sample = users.slice(0, 20);
  for (const user of sample) {
    const result = await apiRequest("POST", "/auth/login", {
      email: user.email,
      password: TEST_PASSWORD,
    });
    const ok = result.status === 200;
    metrics.record({
      operation: "http:login",
      status: result.status,
      durationMs: result.durationMs,
      ok,
      error: ok ? undefined : (result.data as { error?: string })?.error,
      detail: JSON.stringify(result.data).slice(0, 200),
    });
    if (result.status === 200) {
      // Use the real token from the server going forward for this user
      user.token = (result.data as { token?: string }).token ?? user.token;
    }
    if (result.status === 429) {
      log(`  Rate limit hit on login attempt ${sample.indexOf(user) + 1} — expected finding.`);
    }
  }
  const loginSummary = metrics.summary()["http:login"];
  log(`  Login sample: ${loginSummary?.succeeded ?? 0} ok, ${loginSummary?.failed ?? 0} failed (429 expected after ~15).`);
}

// ============================================================
// PHASE 3 — VERIFY TOKENS WORK
// ============================================================

async function verifyTokens(users: TestUser[], metrics: MetricsCollector) {
  log("Verifying generated tokens work against /auth/me (sample of 10)...");
  const sample = users.slice(0, 5).concat(users.slice(SUPERVISORS, SUPERVISORS + 5));

  for (const user of sample) {
    const result = await apiRequest("GET", "/auth/me", undefined, user.token);
    const ok = result.status === 200;
    metrics.record({
      operation: "http:auth-me",
      status: result.status,
      durationMs: result.durationMs,
      ok,
      error: ok ? undefined : (result.data as { error?: string })?.error ?? `status ${result.status}`,
      detail: JSON.stringify(result.data).slice(0, 200),
    });
    if (!ok) {
      throw new Error(
        `Token verification failed for ${user.email}. ` +
        `Status: ${result.status}. ` +
        `This likely means AUTH_TOKEN_SECRET on the server differs from what this script uses. ` +
        `Set AUTH_TOKEN_SECRET env var before running. Response: ${JSON.stringify(result.data)}`
      );
    }
  }
  log("  Token verification passed.");
}

// ============================================================
// PHASE 4 — CREATE SITES (via HTTP, owned by first SITES supervisors)
// ============================================================

async function createSites(users: TestUser[], metrics: MetricsCollector): Promise<TestSite[]> {
  log(`Creating ${SITES} sites via HTTP (1 per supervisor, owned by supervisors 0–${SITES - 1})...`);
  const siteOwners = users.slice(0, SITES); // first SITES supervisors

  const ADDRESSES = [
    "123 Main St, Springfield", "456 Oak Ave, Riverdale", "789 Pine Rd, Lakewood",
    "321 Elm Blvd, Maplewood", "654 Cedar Ln, Brookside",
  ];
  const CLIENTS = ["BuildCo Ltd", "Apex Construction", "Metro Builders", "Urban Develop", "Pacific Contractors"];
  const STATUSES: Array<"active" | "completed" | "on-hold"> = ["active", "active", "active", "completed", "on-hold"];

  const sites: TestSite[] = [];

  await poolMap(siteOwners, Math.min(CONCURRENCY, SITES), async (owner, i) => {
    const result = await apiRequest(
      "POST",
      "/projects/sites",
      {
        name: `LOADTEST-Site-${i}-${owner.email.split("+")[1]?.split("@")[0]}`,
        address: ADDRESSES[i % ADDRESSES.length],
        client: CLIENTS[i % CLIENTS.length],
        startDate: "2026-01-01",
        status: STATUSES[i % STATUSES.length],
      },
      owner.token
    );
    const ok = result.status === 201;
    metrics.record({
      operation: "http:create-site",
      status: result.status,
      durationMs: result.durationMs,
      ok,
      error: ok ? undefined : (result.data as { error?: string })?.error,
    });
    if (ok) {
      const siteId = (result.data as { site?: { id?: string } }).site?.id ?? "";
      sites.push({ id: siteId, name: `LOADTEST-Site-${i}`, ownerEmail: owner.email });
    }
  });

  log(`  Sites created: ${sites.length} / ${SITES}.`);
  return sites;
}

// ============================================================
// PHASE 5 — SIMULATE ENTRIES (via HTTP, spread over DAYS)
// ============================================================

async function createEntries(
  users: TestUser[],
  sites: TestSite[],
  metrics: MetricsCollector
): Promise<void> {
  if (sites.length === 0) {
    log("  No sites available — skipping entry creation.");
    return;
  }

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - DAYS);

  // Build the work queue: each user gets 3–10 entry tasks, randomly distributed
  interface EntryTask {
    user: TestUser;
    siteId: string;
    date: string;
    taskIndex: number;
  }

  const tasks: EntryTask[] = [];
  for (const user of users) {
    const entryCount = randomInt(ENTRIES_PER_USER_MIN, ENTRIES_PER_USER_MAX);
    // Supervisors use their own sites; workers are assigned to 1–3 random sites
    const assignedSiteCount = randomInt(1, Math.min(3, sites.length));
    const assignedSites = sites
      .slice()
      .sort(() => Math.random() - 0.5)
      .slice(0, assignedSiteCount);

    for (let j = 0; j < entryCount; j++) {
      tasks.push({
        user,
        siteId: randomChoice(assignedSites).id,
        date: randomDateInWindow(weekStart, DAYS),
        taskIndex: j,
      });
    }
  }

  log(`Creating ${tasks.length} diary entries across ${users.length} users (concurrency=${CONCURRENCY})...`);

  const LOCATION_PREFIXES = ["Site HQ", "North Block", "East Wing", "Level 3", "Basement"];

  await poolMap(tasks, CONCURRENCY, async (task) => {
    const body: Record<string, unknown> = {
      siteId: task.siteId,
      date: task.date,
      locationAddress: `${randomChoice(LOCATION_PREFIXES)}, ${randomInt(1, 99)} Industrial Way`,
      weather: randomChoice(WEATHER_OPTIONS),
      crewCount: String(randomInt(2, 25)),
      notes: randomChoice(NOTES_OPTIONS),
      photos: [],
    };

    if (USE_REAL_AI) {
      // Only stubbed — real AI path requires base64 image payload
      body.photos = [];
    }

    const result = await apiRequest("POST", "/projects/entries", body, task.user.token);
    const ok = result.status === 201;
    metrics.record({
      operation: "http:create-entry",
      status: result.status,
      durationMs: result.durationMs,
      ok,
      error: ok ? undefined : (result.data as { error?: string })?.error,
    });
  });

  const entrySummary = metrics.summary()["http:create-entry"];
  log(`  Entries: ${entrySummary?.succeeded ?? 0} created, ${entrySummary?.failed ?? 0} failed.`);
}

// ============================================================
// PHASE 6 — PERMISSION CHECKS
// ============================================================

async function permissionChecks(users: TestUser[], metrics: MetricsCollector) {
  log("Verifying permission model: supervisors → expect 200, workers → expect 403...");

  // All supervisors should reach the dashboard endpoint
  const supervisors = users.filter((u) => u.role === "supervisor");
  log(`  Testing ${supervisors.length} supervisors against /projects/reports/supervisor...`);

  await poolMap(supervisors, CONCURRENCY, async (user) => {
    const result = await apiRequest("GET", "/projects/reports/supervisor", undefined, user.token);
    const ok = result.status === 200;
    metrics.record({
      operation: "http:supervisor-dashboard",
      status: result.status,
      durationMs: result.durationMs,
      ok,
      error: ok ? undefined : (result.data as { error?: string })?.error ?? `status ${result.status}`,
    });
  });

  // Sample of 30 regular workers — ALL should be denied
  const workers = users.filter((u) => u.role === "worker");
  const workerSample = workers.slice(0, 30);
  log(`  Testing ${workerSample.length} workers (expect 403 for each)...`);

  for (const user of workerSample) {
    const result = await apiRequest("GET", "/projects/reports/supervisor", undefined, user.token);
    // 403 is the correct/expected response — mark ok=true so it shows as a "pass" in metrics
    const isCorrectDenial = result.status === 403;
    metrics.record({
      operation: "http:worker-dashboard-denial",
      status: result.status,
      durationMs: result.durationMs,
      ok: isCorrectDenial,  // ok = correctly denied
      error: isCorrectDenial ? undefined : `Expected 403, got ${result.status}`,
    });
  }

  const supStats = metrics.summary()["http:supervisor-dashboard"];
  const workerStats = metrics.summary()["http:worker-dashboard-denial"];
  log(`  Supervisor dashboard: ${supStats?.succeeded ?? 0}/${supStats?.attempted ?? 0} can access.`);
  log(`  Worker denial:        ${workerStats?.succeeded ?? 0}/${workerStats?.attempted ?? 0} correctly denied.`);
}

// ============================================================
// PHASE 7 — SUPERVISOR DATA VALIDATION
// ============================================================

async function validateData(users: TestUser[], metrics: MetricsCollector) {
  log("Validating data integrity via /projects/bootstrap and /projects/summary...");

  // Spot-check: first supervisor should see all sites and entries
  const supervisor = users.find((u) => u.role === "supervisor")!;
  const summaryResult = await apiRequest("GET", "/projects/summary", undefined, supervisor.token);
  metrics.record({
    operation: "http:summary-supervisor",
    status: summaryResult.status,
    durationMs: summaryResult.durationMs,
    ok: summaryResult.status === 200,
  });

  // Spot-check: first worker should see only their own data
  const worker = users.find((u) => u.role === "worker")!;
  const workerSummaryResult = await apiRequest("GET", "/projects/summary", undefined, worker.token);
  metrics.record({
    operation: "http:summary-worker",
    status: workerSummaryResult.status,
    durationMs: workerSummaryResult.durationMs,
    ok: workerSummaryResult.status === 200,
  });

  if (summaryResult.status === 200 && workerSummaryResult.status === 200) {
    const supData = summaryResult.data as { sites: number; entries: number };
    const workerData = workerSummaryResult.data as { sites: number; entries: number };
    log(`  Supervisor sees: ${supData.sites} sites, ${supData.entries} entries.`);
    log(`  Worker sees:     ${workerData.sites} sites, ${workerData.entries} entries (own data only).`);

    if (supData.entries < workerData.entries) {
      console.warn("  ⚠️  Supervisor sees fewer entries than worker — data-scoping bug?");
    }
  }
}

// ============================================================
// PHASE 8 — GENERATE REPORT
// ============================================================

function buildReport(
  metrics: MetricsCollector,
  totalRuntimeMs: number
): string {
  const now = new Date().toISOString();
  const summary = metrics.summary();
  const distinctErrors = metrics.distinctErrors();
  const throughput = (metrics.totalRequests() / (totalRuntimeMs / 1000)).toFixed(1);

  const lines: string[] = [];
  const hr = "---";

  lines.push(`# SiteSnap Load Test Report`);
  lines.push(`\n**Generated:** ${now}`);
  lines.push(`**Total runtime:** ${(totalRuntimeMs / 1000).toFixed(1)}s`);
  lines.push(`**Throughput:** ${throughput} req/s`);
  lines.push(`**Total requests:** ${metrics.totalRequests()} (${metrics.totalSucceeded()} ok / ${metrics.totalFailed()} failed)`);

  lines.push(`\n## Parameters Used\n`);
  lines.push(`| Parameter | Value |`);
  lines.push(`|-----------|-------|`);
  lines.push(`| TOTAL_USERS | ${TOTAL_USERS} |`);
  lines.push(`| SUPERVISORS | ${SUPERVISORS} |`);
  lines.push(`| SITES | ${SITES} |`);
  lines.push(`| DAYS | ${DAYS} |`);
  lines.push(`| ENTRIES_PER_USER | ${ENTRIES_PER_USER_MIN}–${ENTRIES_PER_USER_MAX} (random) |`);
  lines.push(`| CONCURRENCY | ${CONCURRENCY} |`);
  lines.push(`| USE_REAL_AI | ${USE_REAL_AI} |`);
  lines.push(`| API_BASE | ${API_BASE} |`);
  lines.push(`| AUTH_SECRET | ${AUTH_SECRET === "dev-sitesnap-secret" ? "dev default" : "custom (set)"} |`);

  lines.push(`\n## Per-Operation Results\n`);
  lines.push(`| Operation | Attempted | Succeeded | Failed | Avg ms | p50 ms | p95 ms | Max ms |`);
  lines.push(`|-----------|-----------|-----------|--------|--------|--------|--------|--------|`);
  for (const [op, s] of Object.entries(summary)) {
    lines.push(`| ${op} | ${s.attempted} | ${s.succeeded} | ${s.failed} | ${s.avgMs} | ${s.p50Ms} | ${s.p95Ms} | ${s.maxMs} |`);
  }

  lines.push(`\n## Distinct Errors (Priority Order)\n`);
  if (distinctErrors.length === 0) {
    lines.push("No errors encountered.");
  } else {
    for (const e of distinctErrors) {
      lines.push(`\n### ${e.operation} → HTTP ${e.status} (×${e.count})\n`);
      lines.push(`- **Count:** ${e.count}`);
      lines.push(`- **Example:** \`${e.exampleDetail.slice(0, 300)}\``);
      lines.push(`- **Likely cause:** ${e.likelyCause}`);
    }
  }

  lines.push(`\n${hr}`);
  lines.push(`\n## Top Issues to Fix\n`);

  const issues: string[] = [];

  // Rate limiter finding is always relevant
  issues.push(
    "**[P1] In-memory rate limiter blocks all bulk operations from a single IP.**\n" +
    "  - `register-initiate`: 8/10 min — registering 1,000 users via HTTP would take ~21 hours.\n" +
    "  - `login`: 15/10 min — logging in 1,000 users from localhost would take ~11 hours.\n" +
    "  - **Fix:** Move rate limiting to Redis (or a reverse proxy), keyed by user identity after auth, not raw IP.\n" +
    "    The API itself already documents this risk in the production startup warning."
  );

  const supStats = summary["http:supervisor-dashboard"];
  if (supStats && supStats.failed > 0) {
    issues.push(
      `**[P0] ${supStats.failed} supervisors could NOT access the dashboard.**\n` +
      `  Check token role claims and SUPERVISOR_SIGNUP_EMAILS env var.`
    );
  }

  const workerStats = summary["http:worker-dashboard-denial"];
  if (workerStats && workerStats.failed > 0) {
    issues.push(
      `**[P0] ${workerStats.failed} workers were NOT correctly denied dashboard access.**\n` +
      `  Role-based access control may be broken — audit requireRole middleware.`
    );
  }

  const entryStats = summary["http:create-entry"];
  if (entryStats && entryStats.p95Ms > 2000) {
    issues.push(
      `**[P2] Entry creation p95 latency is ${entryStats.p95Ms}ms.**\n` +
      `  Add a DB index on \`project_entries(owner_email, timestamp DESC)\` and consider pagination.`
    );
  }

  if (entryStats && entryStats.failed > entryStats.attempted * 0.05) {
    issues.push(
      `**[P1] >5% of entry creations failed (${entryStats.failed}/${entryStats.attempted}).**\n` +
      `  Check distinct errors above for root causes.`
    );
  }

  const siteStats = summary["http:create-site"];
  if (siteStats && siteStats.failed > 0) {
    issues.push(
      `**[P1] ${siteStats.failed} site creations failed.**\n` +
      `  Check site schema validation and DB constraints.`
    );
  }

  for (const issue of issues) {
    lines.push(`- ${issue}\n`);
  }

  lines.push(`\n## Scalability Blockers\n`);
  lines.push(`1. **In-memory rate limiter** — single process, single IP; resets on restart; not suitable for multi-instance or load-test workloads. (Same note exists in \`server.ts\` production warning.)`);
  lines.push(`2. **In-memory fallback store** — if \`DATABASE_URL\` is unset the entire data set lives in process memory and resets on restart.`);
  lines.push(`3. **\`listEntries\` and \`listSites\` have no index enforcement** — at scale (100k+ rows) the \`ORDER BY timestamp DESC\` scans will degrade without confirmed indexes.`);

  lines.push(`\n## Data Integrity Notes\n`);
  lines.push(`- All test data is namespaced: emails \`loadtest+*@sitesnap.test\`, site names \`LOADTEST-*\`.`);
  lines.push(`- Run \`pnpm run teardown-loadtest\` to remove all test data from the database.`);
  lines.push(`\n*Report generated by \`services/api/load-test.ts\`*`);

  return lines.join("\n");
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  console.log("\n🚀 SiteSnap Load / Integration Test\n");
  console.log(`   API: ${API_BASE}`);
  console.log(`   DB:  ${(process.env.DATABASE_URL ?? "(not set)").replace(/:[^:@]+@/, ":***@")}`);
  console.log(`   Users: ${TOTAL_USERS} (${SUPERVISORS} supervisors, ${TOTAL_USERS - SUPERVISORS} workers)`);
  console.log(`   Sites: ${SITES}, Days: ${DAYS}, Concurrency: ${CONCURRENCY}\n`);

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const metrics = new MetricsCollector();
  const runStart = Date.now();

  try {
    // Step 1: Safety
    await safetyCheck(pool);

    // Step 2: Create users in DB
    const users = await createUsers(pool, metrics);

    // Step 2b: Sample HTTP login to test auth flow + show rate limit behavior
    await sampleHttpLogin(users, metrics);

    // Step 3: Verify generated tokens work
    await verifyTokens(users, metrics);

    // Step 4: Create sites via HTTP
    const sites = await createSites(users, metrics);

    // Step 5: Create entries via HTTP
    await createEntries(users, sites, metrics);

    // Step 6: Permission checks
    await permissionChecks(users, metrics);

    // Step 7: Data validation
    await validateData(users, metrics);

  } finally {
    await pool.end();
  }

  const totalRuntimeMs = Date.now() - runStart;

  // Print summary to console
  console.log("\n" + "=".repeat(60));
  console.log("RESULTS SUMMARY");
  console.log("=".repeat(60));
  const summary = metrics.summary();
  for (const [op, s] of Object.entries(summary)) {
    console.log(`  ${op.padEnd(40)} ${s.attempted.toString().padStart(5)} req  ${s.succeeded.toString().padStart(5)} ok  ${s.failed.toString().padStart(5)} fail  p95=${s.p95Ms}ms`);
  }
  console.log(`\n  Total: ${metrics.totalRequests()} requests in ${(totalRuntimeMs / 1000).toFixed(1)}s`);

  const distinctErrors = metrics.distinctErrors();
  if (distinctErrors.length > 0) {
    console.log("\nDISTINCT ERRORS:");
    for (const e of distinctErrors) {
      console.log(`  [×${e.count}] ${e.operation} → ${e.status} — ${e.likelyCause.slice(0, 80)}`);
    }
  }

  // Write report
  const report = buildReport(metrics, totalRuntimeMs);
  const reportPath = path.join(process.cwd(), "..", "..", "load-test-report.md");
  fs.writeFileSync(reportPath, report, "utf8");
  console.log(`\n✅ Report written to: ${reportPath}`);
}

main().catch((err) => {
  console.error("\n❌ Load test failed:", err.message ?? err);
  process.exit(1);
});
