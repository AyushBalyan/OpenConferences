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
      'shamefully-hoist=true' \
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

# --ignore-scripts: --prod omits prisma CLI; db postinstall would fail with "prisma: not found".
# pnpm deploy often leaves workspace pkgs as symlinks into /app/packages/* — those break in the
# runner image. Replace them with real copies of the built package.json + dist.
# Also copy the already-generated Prisma client next to @prisma/client.
RUN pnpm --filter @openconferences/api deploy --prod --ignore-scripts /app/out/api \
 && mkdir -p /app/out/api/node_modules/@openconferences \
 && for pkg in config contracts db schemas; do \
      rm -rf "/app/out/api/node_modules/@openconferences/${pkg}" \
      && mkdir -p "/app/out/api/node_modules/@openconferences/${pkg}" \
      && cp -a "/app/packages/${pkg}/package.json" "/app/out/api/node_modules/@openconferences/${pkg}/" \
      && cp -a "/app/packages/${pkg}/dist" "/app/out/api/node_modules/@openconferences/${pkg}/dist" \
      && test -f "/app/out/api/node_modules/@openconferences/${pkg}/dist/index.js" \
         -o -f "/app/out/api/node_modules/@openconferences/${pkg}/dist/env/index.js"; \
    done \
 && SRC="$(find /app/node_modules/.pnpm -type d -path '*/node_modules/.prisma/client' | head -n1)" \
 && test -n "$SRC" && test -f "$SRC/index.js" \
 && DEST_PARENT="$(find /app/out/api/node_modules/.pnpm -type d -path '*/@prisma+client@*/node_modules/@prisma/client' | head -n1)/.." \
 && test -d "$DEST_PARENT" \
 && rm -rf "$DEST_PARENT/.prisma" \
 && mkdir -p "$DEST_PARENT/.prisma" \
 && cp -a "$SRC" "$DEST_PARENT/.prisma/client" \
 && cd /app/out/api \
 && # Copy (not symlink) deps to top-level — absolute symlinks break when this tree
    # is COPY'd to /app in the runner stage.
    hoist() { \
      dep="$1"; \
      src="$(find node_modules/.pnpm -type d -path "*/node_modules/${dep}" | head -n1)"; \
      test -n "$src"; \
      dest="node_modules/${dep}"; \
      rm -rf "$dest"; \
      mkdir -p "$(dirname "$dest")"; \
      cp -a "$src" "$dest"; \
    } \
 && for dep in dotenv zod uuid tslib; do hoist "$dep"; done \
 && for dep in @prisma/client @ts-rest/core; do hoist "$dep"; done \
 && mkdir -p node_modules/@openconferences/config/node_modules \
 && cp -a node_modules/dotenv node_modules/zod \
      node_modules/@openconferences/config/node_modules/ \
 && mkdir -p /tmp/runtime-check \
 && cp -a /app/out/api/. /tmp/runtime-check/ \
 && cd /tmp/runtime-check \
 && node -e "require('@openconferences/config/env'); require('@openconferences/db'); require('@openconferences/schemas'); require('@openconferences/contracts'); console.log('workspace ok')"

# -----------------------------------------------------------------------------
# runner: minimal runtime
# -----------------------------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS runner

RUN apk add --no-cache openssl \
 && addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nestjs

WORKDIR /app

ENV NODE_ENV=production \
    API_HOST=0.0.0.0 \
    API_PORT=3001

COPY --from=builder --chown=nestjs:nodejs /app/out/api ./

USER nestjs
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3001/api/v1/healthz').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/main.js"]
