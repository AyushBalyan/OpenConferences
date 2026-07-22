# syntax=docker/dockerfile:1
#
# Optimized for GHCR builds (GitHub Actions) + Coolify image pulls.
# - BuildKit cache mounts for the pnpm store
# - NODE_OPTIONS caps V8 heap during compile
# - Sequential package builds (lower peak RAM)
# - pnpm deploy --prod --ignore-scripts, then explicit prisma generate
#   (prod deploy omits the prisma CLI; postinstall would fail otherwise)

ARG NODE_VERSION=22
ARG PNPM_VERSION=9.15.0

# -----------------------------------------------------------------------------
# Base: toolchain only
# -----------------------------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS base
ARG PNPM_VERSION=9.15.0

ENV PNPM_HOME="/pnpm" \
    PATH="/pnpm:$PATH" \
    CI=1 \
    HUSKY=0 \
    NODE_OPTIONS="--max-old-space-size=768"

RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
WORKDIR /app

# -----------------------------------------------------------------------------
# fetch: lockfile-only layer → BuildKit-cached store
# -----------------------------------------------------------------------------
FROM base AS fetch
COPY pnpm-lock.yaml ./
RUN --mount=type=cache,id=openconferences-pnpm,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store \
 && pnpm fetch

# -----------------------------------------------------------------------------
# deps: install workspace graph for API (includes build-time devDeps)
# -----------------------------------------------------------------------------
FROM base AS deps
RUN printf '%s\n' \
      'store-dir=/pnpm/store' \
      'inject-workspace-packages=true' \
      'prefer-offline=true' \
      'auto-install-peers=true' \
      > .npmrc

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/config/package.json ./packages/config/
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/db/package.json ./packages/db/
COPY packages/db/prisma ./packages/db/prisma/
COPY packages/schemas/package.json ./packages/schemas/

RUN --mount=type=cache,id=openconferences-pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @openconferences/api...

# -----------------------------------------------------------------------------
# builder: compile, deploy prod tree, generate Prisma into that tree
# -----------------------------------------------------------------------------
FROM deps AS builder

COPY packages/config ./packages/config
COPY packages/schemas ./packages/schemas
COPY packages/contracts ./packages/contracts
COPY packages/db ./packages/db
COPY apps/api ./apps/api

RUN pnpm --filter @openconferences/db exec prisma generate

RUN pnpm --filter @openconferences/config build \
 && pnpm --filter @openconferences/schemas build \
 && pnpm --filter @openconferences/contracts build \
 && pnpm --filter @openconferences/db build \
 && pnpm --filter @openconferences/api build

# --ignore-scripts: --prod omits prisma CLI; db postinstall would fail with "prisma: not found"
# Then generate the client into the deployed node_modules using the builder's prisma binary.
RUN pnpm --filter @openconferences/api --prod deploy --ignore-scripts /prod/api \
 && mkdir -p /prod/api/prisma \
 && cp /app/packages/db/prisma/schema.prisma /prod/api/prisma/schema.prisma \
 && /app/node_modules/.bin/prisma generate --schema=/prod/api/prisma/schema.prisma \
 && rm -rf /prod/api/prisma

# -----------------------------------------------------------------------------
# runner: minimal runtime
# -----------------------------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS runner

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nestjs

WORKDIR /app

ENV NODE_ENV=production \
    API_HOST=0.0.0.0 \
    API_PORT=3001

COPY --from=builder --chown=nestjs:nodejs /prod/api ./

USER nestjs
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3001/api/v1/healthz').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/main.js"]
