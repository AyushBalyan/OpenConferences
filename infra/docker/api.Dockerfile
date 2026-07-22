# syntax=docker/dockerfile:1
#
# Optimized for Coolify on ~2 GiB EC2 hosts.
# - BuildKit cache mounts for the pnpm store (avoids re-download; less disk churn)
# - NODE_OPTIONS caps V8 heap during compile so the OOM killer is less likely
# - Sequential package builds (lower peak RAM than turbo parallel)
# - pnpm deploy --prod → final image has production deps only
# - No full-monorepo COPY . . (smaller context, better layer cache)

ARG NODE_VERSION=20
ARG PNPM_VERSION=9.15.0

# -----------------------------------------------------------------------------
# Base: toolchain only (shared cache across stages)
# -----------------------------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS base

ENV PNPM_HOME="/pnpm" \
    PATH="/pnpm:$PATH" \
    CI=1 \
    HUSKY=0 \
    # Cap compile heap on small builders; leave RAM for OS + dockerd + tsc/swc
    NODE_OPTIONS="--max-old-space-size=768"

RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
WORKDIR /app

# -----------------------------------------------------------------------------
# fetch: download tarballs into a BuildKit-cached store (lockfile-only layer)
# -----------------------------------------------------------------------------
FROM base AS fetch
COPY pnpm-lock.yaml ./
RUN --mount=type=cache,id=openconferences-pnpm,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store \
 && pnpm fetch

# -----------------------------------------------------------------------------
# deps: install workspace graph for API (devDeps included for nest/tsc build)
# -----------------------------------------------------------------------------
FROM base AS deps
# Docker-only settings — do not commit inject-workspace-packages for local DX
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

# prefer-offline uses the fetch/cache mount when warm; falls back to network if cold
RUN --mount=type=cache,id=openconferences-pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @openconferences/api...

# -----------------------------------------------------------------------------
# builder: copy only sources needed for API, build, then prune via deploy
# -----------------------------------------------------------------------------
FROM deps AS builder

COPY packages/config ./packages/config
COPY packages/schemas ./packages/schemas
COPY packages/contracts ./packages/contracts
COPY packages/db ./packages/db
COPY apps/api ./apps/api

# Ensure Prisma client matches the schema copied above (postinstall may have run earlier)
RUN pnpm --filter @openconferences/db exec prisma generate

# Sequential builds keep peak RSS lower than `turbo run build` on 2 GiB hosts
RUN pnpm --filter @openconferences/config build \
 && pnpm --filter @openconferences/schemas build \
 && pnpm --filter @openconferences/contracts build \
 && pnpm --filter @openconferences/db build \
 && pnpm --filter @openconferences/api build

# Portable prod tree: workspace packages injected + only production dependencies
RUN pnpm --filter @openconferences/api --prod deploy /prod/api

# -----------------------------------------------------------------------------
# runner: minimal runtime (no pnpm, no toolchain, no sources, no devDeps)
# -----------------------------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS runner

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nestjs

WORKDIR /app

# Do not inherit build-time NODE_OPTIONS — runtime can use default heap
ENV NODE_ENV=production \
    API_HOST=0.0.0.0 \
    API_PORT=3001

COPY --from=builder --chown=nestjs:nodejs /prod/api ./

USER nestjs
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3001/api/v1/healthz').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/main.js"]
