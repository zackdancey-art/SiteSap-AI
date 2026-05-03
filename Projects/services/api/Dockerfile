FROM node:20-alpine AS base
RUN corepack enable pnpm

# ── deps ───────────────────────────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY services/api/package.json ./services/api/
COPY shared/ ./shared/
RUN pnpm install --frozen-lockfile --filter ./services/api --filter ./shared

# ── build ──────────────────────────────────────────────────────────────────────
FROM deps AS build
COPY services/api/ ./services/api/
COPY tsconfig.json ./
COPY shared/ ./shared/
RUN pnpm --filter ./services/api run build

# ── runtime ────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime
RUN corepack enable pnpm
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

COPY --from=build /app/services/api/dist/ ./dist/
COPY --from=build /app/node_modules/ ./node_modules/
COPY --from=build /app/services/api/node_modules/ ./services/api/node_modules/
COPY --from=build /app/services/api/package.json ./package.json
COPY services/api/src/storage/migrations/ ./dist/storage/migrations/

RUN mkdir -p /app/data /app/storage/uploads

EXPOSE 4000

CMD ["node", "dist/server.js"]
