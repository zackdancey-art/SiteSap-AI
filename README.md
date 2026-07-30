# SiteSnap AI

Construction site diary platform for field crews and supervisors. Captures photos, entries, incidents, and generates AI-enhanced reports.

---

## Quick Start

Prerequisite: `pnpm` (workspace package manager).

```bash
# Install all dependencies
pnpm -C Projects install

# Run API in development (listens on http://localhost:4000)
pnpm -C Projects --filter ./services/api run dev

# Run mobile app
pnpm -C Projects --filter ./apps/mobile start

# Run supervisor web portal
pnpm -C Projects --filter ./apps/supervisor-web dev

# Typecheck all packages
pnpm -C Projects run typecheck

# Run API tests
pnpm -C Projects --filter ./services/api run test

# Lint
pnpm -C Projects run lint
```

---

## Monorepo Structure

```
Projects/
├── services/
│   └── api/              Express + TypeScript backend (port 4000)
│       ├── src/routes/   All API endpoints enumerated in docs/api-contracts.md
│       └── src/storage/  SQL stores (Postgres or JSON fallback)
├── apps/
│   ├── mobile/           Expo / React Native field app (React 19, SDK 54)
│   └── supervisor-web/   Next.js web portal (port 3001, app router, React 18)
└── shared/
    └── @sitesnap/shared  Zod schemas + TypeScript types (build before API/clients)
```

**Important:** All `pnpm` commands must include `-C Projects`. Do not `cd Projects && …` — the shell environment does not persist across tool invocations.

### The Three Deployables

| Name | Type | Port | Client | Auth |
|------|------|------|--------|------|
| **API** | Express backend | 4000 | Both mobile & web | Bearer token (mobile), httpOnly cookie (web) |
| **Mobile** | Expo / React Native | — | Field crews | Bearer token from signup/login |
| **Supervisor Web** | Next.js portal | 3001 | Project managers/supervisors | httpOnly cookie from login |

### Shared Package

`Projects/shared` exports Zod schemas and TypeScript types. Must build before API and clients can resolve types:

```bash
pnpm -C Projects --filter ./shared run build:types
```

---

## Database

**Production:** Postgres (via `DATABASE_URL` env var).

**Development & Tests:** Automatic JSON/in-memory fallback when `DATABASE_URL` is absent.

Migrations live in `Projects/services/api/src/storage/migrations/` and run automatically at API startup.

---

## Key Docs

- **[API Contracts](Projects/docs/api-contracts.md)** — Every endpoint, method, auth requirement, request/response shape, error cases. Regenerated from code.
- **[Architecture](Projects/docs/ARCHITECTURE.md)** — System design, multi-tenancy, auth model, role hierarchy.
- **[Audit](Projects/docs/AUDIT.md)** — Phase 2 security/quality findings, prioritized backlog, known issues (H1–L6).
- **[CLAUDE.md](CLAUDE.md)** — Agent working instructions: directory rules, worktree caveats, test conventions, multi-tenancy scoping rules.

---

## Development Notes

### Testing

- **API tests:** 8 test files under `Projects/services/api/src/` using Node's built-in `test` runner (no Jest/Vitest).
- **Mobile & Web:** No test files yet (finding H3).
- **Run tests:** `pnpm -C Projects --filter ./services/api run test` — compiles TS to `dist/` first.

### Role Model

Company roles: `owner > manager > viewer > crew` (viewer+ access dashboard; crew can only create field entries).

Legacy roles (`admin`, `supervisor`, `worker`) coexist during transition; deprecated but not removed.

### Multi-Tenancy

Isolation enforced **by hand in every store query** using `WHERE company_id = $1` filters or `canAccessRow` checks. No database-level RLS yet (finding H1). A missed filter is a silent cross-tenant data leak.

### Auth

- Mobile sends `Authorization: Bearer <jwt>` with every request.
- Web uses httpOnly `sitesnap.session` cookie (not accessible to JS).
- Both token and cookie formats validated by `requireAuth` middleware in `Projects/services/api/src/middleware/auth.ts`.

### Rate Limiting

Per-account and per-IP limits on auth, signup, invites, and some mutations. In-memory only (single instance); becomes real at 2+ instances (finding L5). Redis support exists behind `REDIS_URL` env var.

---

## Environment Variables

**Required (fail at boot if absent):**
- `AUTH_TOKEN_SECRET` — for JWT signing
- `DATABASE_URL` — Postgres connection string (or omit for JSON fallback in dev)
- Email provider (Resend or SMTP) for account verification / password reset
- Twilio for SMS verification (or both SMS + email provider needed in production)
- S3 or R2 bucket for media storage (or local disk fallback in dev)

**Optional but recommended:**
- `OPENAI_API_KEY` — if absent, AI diary generation silently degrades to rule-based fallback (finding C1)
- `REDIS_URL` — if absent, rate limits stored in-memory (single instance only)

---

## Deployment

API deployed via root `Dockerfile` to Render. Migrations run at startup. Mobile and web are deployed separately (Expo and Vercel respectively).

---

## Known Findings

See `docs/AUDIT.md` for full details. Highlights:

- **C1:** Generated diaries carry no provenance; AI→fallback downgrade is silent.
- **H1:** Multi-tenancy enforced by convention only (no database-level RLS).
- **H2:** Offline diary save is rolled back and lost on network failure.
- **H3:** Zero tests on both client apps; offline/sync logic is untested.
- **L3:** This README and API contract doc regenerated from code (prior doc was stale).
