# CLAUDE.md — SiteSnap AI

Orientation for any agent working in this repo. Read this fully before touching code. Two companion documents are the source of truth for *what* and *why*: `docs/ARCHITECTURE.md` (how the system is built) and `docs/AUDIT.md` (findings, each with an ID like C1/H2/M4). When a task names a finding ID, open that section of `docs/AUDIT.md` yourself — do not act on a paraphrase.

---

## 1. Working directory — read this first, it will bite you otherwise

Claude Code (and therefore every subagent) is launched from the **git repo root**: `/Users/zackdancey/Dev/SiteSnap/`. That is where `CLAUDE.md`, `docs/`, and `.claude/` live.

The **pnpm workspace is one level down**, in `Projects/`. That is where `pnpm-workspace.yaml`, the root `package.json`, and the three deployables live.

**All pnpm commands must use `pnpm -C Projects <cmd>`.** For example:

```
pnpm -C Projects run typecheck
pnpm -C Projects --filter ./services/api run test
```

**Do NOT `cd Projects && …`.** The `cd` does not persist between separate Bash tool calls — each call starts a fresh shell at the repo root — so a `cd` in one call is gone by the next. Always pass `-C Projects` (or `--filter` from the workspace) instead. This applies to typecheck, test, lint, install — everything pnpm.

Paths to `docs/`, `.claude/`, and `CLAUDE.md` are relative to the repo root (no `Projects/` prefix). Paths to source code are under `Projects/`.

---

## 2. Monorepo layout and the three deployables

pnpm workspace (`Projects/pnpm-workspace.yaml`) with packages `apps/*`, `services/*`, `shared`.

| Package | Path | What it is |
|---|---|---|
| **API** | `Projects/services/api` | Express 4 + TypeScript backend. The only server. Auth, projects/entries/diaries, AI diary generation, uploads, RBAC. Runs on port **4000**. |
| **Mobile** | `Projects/apps/mobile` | Expo / React Native field app (expo-router, SDK 54, React 19). The primary capture client. Sends `Authorization: Bearer <token>`. |
| **Supervisor web** | `Projects/apps/supervisor-web` | Next.js 14 (app router, React 18) portal on port **3001**. Auth via **httpOnly cookie**, not bearer token. |
| **Shared** | `Projects/shared` | Zod schemas + shared TS types, published to the workspace as `@sitesnap/shared`. Emits `.d.ts` only — build it before the API (`pnpm -C Projects --filter ./shared run build:types`) or project references won't resolve. |

Data layer: **Postgres** in production (via `DATABASE_URL`), with a **file-backed / in-memory JSON fallback** used automatically when `DATABASE_URL` is unset (dev and tests). No ORM — stores are hand-written SQL modules in `Projects/services/api/src/storage/`. Photos go to S3/R2 in prod, local disk in dev (`storage/mediaStorage.ts`). Deployed to Render via the root `Dockerfile`; migrations run at API boot.

---

## 3. Multi-tenancy: `company_id` is a CONVENTION, not an enforced boundary

Every operational table carries a `company_id TEXT` column (migrations 014–018). There are **no foreign keys** back to `companies` (deliberate — soft-cancel + 7-year retention compliance), and there is currently **no database-level enforcement** (no RLS) that a query stays within one company.

Isolation is enforced **by hand, in every store query**, by:
- filtering `WHERE company_id = $1` on the caller's company, and/or
- a `canAccessRow` / `canAccess` / `assertSameCompany` check (see `storage/actor.ts`, `utils/companyScope.ts`).

An `Actor` (`{ email, role, companyId, companyRole }`, defined in `storage/actor.ts`) is threaded into every store call and carries the caller's company. **The correctness of tenant isolation depends entirely on each query remembering to filter.** This is exactly why finding **H1** exists. If you write or edit any store query, it MUST scope by `actor.companyId`. If you are unsure whether a query is properly scoped, stop and flag it — a missed filter is a silent cross-tenant data leak, not a visible bug.

Company roles rank `owner > manager > viewer > crew` (`utils/authToken.ts`, `middleware/auth.ts` → `requireAtLeast`, `requireCompanyRole`). A legacy `role` (`worker/supervisor/admin`) still exists in parallel and is deprecated — do not add new logic keyed on it.

---

## 4. Database migrations — ONLY THE ORCHESTRATOR ASSIGNS NUMBERS

Migrations live in `Projects/services/api/src/storage/migrations/` as `NNN_description.sql`, applied in filename order at API boot by `storage/migrate.ts`. The version string recorded in `schema_migrations` is the filename minus `.sql` (e.g. `018_company_invites`). Current highest migration is **018**.

**If you are a subagent: do not create, rename, or renumber a migration unless your task explicitly hands you a specific number.** Multiple agents working in parallel will collide on `019` otherwise, and a duplicate/misordered migration corrupts the boot sequence. The orchestrator owns the numbering. If your change seems to need a new migration and none was assigned, STOP and report that — do not invent a number.

Migrations must be additive and idempotent (`IF NOT EXISTS` / guarded `DO` blocks) — they run against databases at varying states.

---

## 5. How to run typecheck, tests, and lint

From the repo root, always with `-C Projects`. **Filter by package NAME, not path** — under `-C Projects`, path filters like `--filter ./services/api` match nothing; use the package name from each `package.json`:

| Package | `--filter` name |
|---|---|
| API | `services-api` |
| Mobile | `apps-mobile` |
| Web | `sitesnap-supervisor-web` |
| Shared | `@sitesnap/shared` |

```
# Typecheck one package (fast, no build):
pnpm -C Projects --filter services-api run typecheck

# Typecheck everything:
pnpm -C Projects run typecheck

# API tests — NOTE: this compiles TS to dist/ first, then runs node --test:
pnpm -C Projects --filter services-api run test

# Lint:
pnpm -C Projects run lint
```

Because the API `test` script is `pnpm run build && node --test dist/**/*.test.js`, tests run against **compiled output in `dist/`**, not the `.ts` source. A test file that doesn't compile won't run. Always typecheck before assuming a test failure is a logic problem.

Mobile and web currently have **zero tests** and no meaningful `test` script. The 8 real test files all live under `Projects/services/api/src/`.

---

## 6. API test conventions (follow these exactly — do not invent new patterns)

The existing suite (e.g. `services/api/src/routes/company-rbac.test.ts`, `change-password.test.ts`) is the template:

- **Runner:** `node:test` — `import { test, before, after, beforeEach } from "node:test"` and `import assert from "node:assert/strict"`. No Jest, no Vitest, no supertest.
- **Location:** test files sit next to the code they test, named `*.test.ts`, under `src/`. They compile into `dist/**/*.test.js`.
- **HTTP:** tests boot the real app with `createApp()` from `../server`, listen on an ephemeral port, and drive it with a hand-rolled `http.request` helper (typically named `req`) that returns `{ status, body }`. Copy that helper's shape; don't add a dependency.
- **In-memory mode:** at the top of the file, `delete process.env.DATABASE_URL` (forces the JSON/in-memory store), set `process.env.AUTH_TOKEN_SECRET = "<something>-test-secret"` and `process.env.NODE_ENV = "test"`. **Consequence:** the in-memory suite cannot exercise anything Postgres-only — NOT NULL constraints, foreign keys, or Row-Level Security. Tests that must prove RLS or a DB constraint have to run against a real Postgres via `TEST_DATABASE_URL` and skip when it is unset (this environment has no local Postgres).
- **Isolation between tests:** reset store state with the exported helpers — `resetAuthStoreForTests()`, `resetProjectStoreForTests()`, `resetRateLimitStoreForTests()` — in `before`/`beforeEach`.
- **Unique identities:** phone numbers must be globally unique within a run; use the incrementing `nextPhone()` pattern (`+614` + zero-padded counter). Follow the existing `registerUser(email, name, companyName?)` helper style to get an auth token.
- **No external calls in tests:** never hit real Twilio, real S3, real OpenAI, or any network. Mock at the boundary. (Making this true for SMS/email is finding **H3a** — until it lands, be aware the pre-commit hook can fail on Twilio quota.)

---

## 7. Providers and how absence degrades

`server.ts` → `validateProviderConfig()` hard-fails production boot if `AUTH_TOKEN_SECRET`, `DATABASE_URL`, an email provider, Twilio SMS, or S3 media storage is missing/placeholder. In dev these degrade to warnings + local fallbacks.

**`OPENAI_API_KEY` is the exception** — it is *not* validated at boot, and when absent the AI diary generator silently falls back to a deterministic rule-based generator (`routes/ai.ts`). That silent, unrecorded downgrade is finding **C1**. The deterministic fallback only rearranges user-entered text; it never invents content.

There is exactly **one LLM call site**: `routes/ai.ts` → `tryGenerateWithOpenAI()` (OpenAI Responses API, default model `gpt-4o`). The system prompt is an inline string literal in that file.

---

## 8. Working style for subagents

- You start with a fresh context window: you see this file, git status, and the task prompt — nothing else. Read the files your task names, in full.
- The file list in your task is a **hard boundary**. If doing the job correctly requires editing a file not on the list, STOP and report it — do not expand scope silently.
- The approach in your task has already been decided by the orchestrator. Don't re-litigate it. If it's genuinely unimplementable or contradicts the code, STOP and report the contradiction rather than improvising a different design.
- Match surrounding conventions over general best practice. Prefer deleting code over adding it. Do not add dependencies without being told to.
- Do not edit `docs/AUDIT.md` or `docs/ARCHITECTURE.md`.

## 9. Worktree isolation caveat (mostly for the orchestrator)

A subagent spawned with `isolation: worktree` gets a **fresh checkout with no `node_modules`** — so `pnpm -C Projects … typecheck`/`test` will fail there until dependencies are installed (`pnpm -C Projects install`). Either install first inside the worktree, or don't use worktree isolation for test-running work and serialise it instead. Never spawn parallel worktree agents expected to run tests without accounting for this.
