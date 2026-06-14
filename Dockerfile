# Build context must be the repo root (not Projects/) because the API
# depends on the shared workspace package.
#
# Build:  docker build -t sitesnap-api .
# Run:    docker run -p 4000:4000 --env-file .env.production sitesnap-api

FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /repo

# ── Install stage ────────────────────────────────────────────────────────────
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.json ./
COPY Projects/shared ./Projects/shared
COPY Projects/services/api/package.json ./Projects/services/api/package.json
RUN pnpm install --frozen-lockfile --filter ./Projects/services/api... --prod

# ── Build stage ──────────────────────────────────────────────────────────────
FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.json ./
COPY Projects/shared ./Projects/shared
COPY Projects/services/api ./Projects/services/api
RUN pnpm install --frozen-lockfile
RUN pnpm --filter ./Projects/shared run build 2>/dev/null || true
RUN pnpm --filter ./Projects/services/api run build

# ── Runtime stage ────────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /repo

COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/Projects/shared ./Projects/shared

COPY --from=build /repo/Projects/services/api/dist ./Projects/services/api/dist
COPY --from=build /repo/Projects/services/api/package.json ./Projects/services/api/package.json

EXPOSE 4000
CMD ["node", "Projects/services/api/dist/server.js"]
