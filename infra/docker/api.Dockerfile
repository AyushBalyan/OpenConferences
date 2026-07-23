# syntax=docker/dockerfile:1
#
# API image for GHCR → Coolify pulls (no compile on the small EC2 host).
#
# Strategy:
#   1. inject-workspace-packages so pnpm deploy can ship workspace deps
#   2. sync-injected-deps-after-scripts=build so dist is copied into injects
#   3. pnpm deploy --prod --ignore-scripts (avoid prisma CLI in prod graph)
#   4. finalize-deploy.sh keeps @openconferences/* inside the deploy tree and
#      copies the generated Prisma client next to @prisma/client
#
# Do NOT flatten workspace packages or hoist their deps — that breaks pnpm's
# dependency graph (dotenv / Prisma export bugs).

ARG NODE_VERSION=22
ARG PNPM_VERSION=9.15.0

FROM node:${NODE_VERSION}-alpine AS base
ARG PNPM_VERSION=9.15.0

ENV PNPM_HOME="/pnpm" \
    PATH="/pnpm:$PATH" \
    CI=1 \
    HUSKY=0 \
    NODE_OPTIONS="--max-old-space-size=768"

RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
WORKDIR /app

FROM base AS fetch
COPY pnpm-lock.yaml ./
RUN --mount=type=cache,id=openconferences-pnpm,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store \
 && pnpm fetch

FROM base AS deps
RUN printf '%s\n' \
      'store-dir=/pnpm/store' \
      'inject-workspace-packages=true' \
      'sync-injected-deps-after-scripts[]=build' \
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

FROM deps AS builder

COPY packages/config ./packages/config
COPY packages/schemas ./packages/schemas
COPY packages/contracts ./packages/contracts
COPY packages/db ./packages/db
COPY apps/api ./apps/api
COPY infra/docker/finalize-deploy.sh /usr/local/bin/finalize-deploy.sh
RUN chmod +x /usr/local/bin/finalize-deploy.sh

RUN pnpm --filter @openconferences/db exec prisma generate

# Build in dependency order. sync-injected-deps-after-scripts refreshes injects.
RUN pnpm --filter @openconferences/config build \
 && pnpm --filter @openconferences/schemas build \
 && pnpm --filter @openconferences/contracts build \
 && pnpm --filter @openconferences/db build \
 && pnpm --filter @openconferences/api build

# Re-link after COPY/build so injects definitely include dist/ before deploy.
RUN --mount=type=cache,id=openconferences-pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --offline --filter @openconferences/api...

RUN pnpm --filter @openconferences/api deploy --prod --ignore-scripts /app/out/api \
 && finalize-deploy.sh /app/out/api config contracts db schemas \
 && mkdir -p /tmp/runtime-check \
 && cp -a /app/out/api/. /tmp/runtime-check/ \
 && cd /tmp/runtime-check \
 && node -e "const p=require('@prisma/client'); if(!p.Prisma) throw new Error('Prisma namespace missing'); require('@openconferences/config/env'); require('@openconferences/db'); require('@openconferences/schemas'); require('@openconferences/contracts'); console.log('workspace ok')"

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
