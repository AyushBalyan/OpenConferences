# syntax=docker/dockerfile:1
#
# Same strategy as api.Dockerfile: prod deploy without lifecycle scripts,
# then explicit prisma generate into the deployed tree.

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
      'prefer-offline=true' \
      'auto-install-peers=true' \
      > .npmrc

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/worker/package.json ./apps/worker/
COPY packages/config/package.json ./packages/config/
COPY packages/db/package.json ./packages/db/
COPY packages/db/prisma ./packages/db/prisma/
COPY packages/schemas/package.json ./packages/schemas/

RUN --mount=type=cache,id=openconferences-pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @openconferences/worker...

FROM deps AS builder

COPY packages/config ./packages/config
COPY packages/schemas ./packages/schemas
COPY packages/db ./packages/db
COPY apps/worker ./apps/worker

RUN pnpm --filter @openconferences/db exec prisma generate

RUN pnpm --filter @openconferences/config build \
 && pnpm --filter @openconferences/schemas build \
 && pnpm --filter @openconferences/db build \
 && pnpm --filter @openconferences/worker build

RUN pnpm --filter @openconferences/worker deploy --prod --ignore-scripts /app/out/worker \
 && SRC="$(find /app/node_modules/.pnpm -type d -path '*/node_modules/.prisma/client' | head -n1)" \
 && test -n "$SRC" && test -f "$SRC/index.js" \
 && DEST_PARENT="$(find /app/out/worker/node_modules/.pnpm -type d -path '*/@prisma+client@*/node_modules/@prisma/client' | head -n1)/.." \
 && test -d "$DEST_PARENT" \
 && rm -rf "$DEST_PARENT/.prisma" \
 && mkdir -p "$DEST_PARENT/.prisma" \
 && cp -a "$SRC" "$DEST_PARENT/.prisma/client"

FROM node:${NODE_VERSION}-alpine AS runner

RUN apk add --no-cache openssl \
 && addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 worker

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder --chown=worker:worker /app/out/worker ./

USER worker

CMD ["node", "dist/main.js"]
