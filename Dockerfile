# Build context must be the repo root (not Projects/) because the API
# depends on the shared workspace package.
#
# Build:  docker build -t sitesnap-api .
# Run:    docker run -p 4000:4000 --env-file .env.production sitesnap-api

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.30.3 --activate

# ── Install stage (prod deps only) ───────────────────────────────────────────
FROM base AS deps
WORKDIR /repo
# Workspace manifests live under Projects/, not at the repo root.
COPY Projects/pnpm-lock.yaml Projects/pnpm-workspace.yaml Projects/package.json Projects/tsconfig.json ./Projects/
COPY Projects/shared ./Projects/shared
COPY Projects/services/api/package.json ./Projects/services/api/package.json
# pnpm must run from the workspace root.
WORKDIR /repo/Projects
RUN pnpm install --frozen-lockfile --filter ./services/api... --prod

# ── Build stage ──────────────────────────────────────────────────────────────
FROM base AS build
WORKDIR /repo
COPY Projects/pnpm-lock.yaml Projects/pnpm-workspace.yaml Projects/package.json Projects/tsconfig.json ./Projects/
COPY Projects/shared ./Projects/shared
COPY Projects/services/api ./Projects/services/api
WORKDIR /repo/Projects
RUN pnpm install --frozen-lockfile
# shared only emits .d.ts files; build it before the API so project references resolve.
RUN pnpm --filter ./shared run build:types
RUN pnpm --filter ./services/api run build

# ── Runtime stage ────────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /repo/Projects

COPY --from=deps /repo/Projects/node_modules ./node_modules
COPY --from=deps /repo/Projects/services/api/node_modules ./services/api/node_modules
COPY --from=build /repo/Projects/services/api/dist ./services/api/dist
COPY --from=build /repo/Projects/services/api/src/storage/migrations ./services/api/dist/storage/migrations
# Brand assets (email logo) — tsc doesn't copy non-.ts files, same as migrations above.
COPY --from=build /repo/Projects/services/api/src/assets ./services/api/dist/assets
COPY --from=build /repo/Projects/services/api/package.json ./services/api/package.json

EXPOSE 4000
CMD ["node", "services/api/dist/server.js"]
