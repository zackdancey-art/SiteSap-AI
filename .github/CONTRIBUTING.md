# Contributing to SiteSnap AI

## Branch Strategy

- `main` — production-ready. Protected; requires passing CI and an approved PR.
- `feature/<short-name>` — all feature development.
- `fix/<short-name>` — bug fixes.
- `chore/<short-name>` — dependency bumps, tooling, docs.

**Never commit directly to `main`.**

## First-Time Setup

```bash
git clone <repo>
cd SiteSnap/Projects
pnpm install
pnpm run setup-hooks   # installs the pre-commit test hook
cp services/api/.env.example services/api/.env  # fill in your secrets
```

## Development

```bash
pnpm run dev:api       # API on http://localhost:4000
pnpm run dev:mobile    # Expo dev server (scan QR with Expo Go)
```

## Before You Commit

The pre-commit hook runs automatically. To run checks manually:

```bash
pnpm run typecheck     # TypeScript across all packages
pnpm run test          # unit + integration + e2e tests
pnpm run lint          # ESLint
```

All three must pass. Fix any failures before opening a PR.

## Opening a Pull Request

1. Branch off `main` with a descriptive name: `feature/job-numbers`, `fix/auth-refresh-bug`
2. Keep PRs focused — one feature or fix per PR
3. Fill out the PR template (pre-populated when you open a PR on GitHub)
4. Request review from at least one other person
5. Squash-merge after approval

## Workflow Overview

See [WORKFLOW.md](WORKFLOW.md) for the full product workflow (AI diary generation, roles, data flow).

## Code Conventions

- **TypeScript everywhere** — no `any` without a comment explaining why
- **Zod for validation** at API boundaries
- **No comments** unless the WHY is non-obvious
- **No `console.log`** in production paths — use the logger or remove before commit
- Tests live alongside routes in `services/api/src/routes/*.test.ts`

## Adding a New Feature Checklist

- [ ] Backend: route + Zod schema + storage layer
- [ ] DB migration: add column/table in the migration function
- [ ] Shared types: update `shared/types/index.ts` if needed
- [ ] Mobile UI: screen or component update
- [ ] Tests: at least one integration test covering the happy path
- [ ] WORKFLOW.md: update if the user journey changes
