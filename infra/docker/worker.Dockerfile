# syntax=docker/dockerfile:1
#
# Same optimization strategy as api.Dockerfile (BuildKit cache, low-RAM builds,
# pnpm deploy --prod). Worker is tsc-only (lighter than Nest) but still benefits.

ARG NODE_VERSION=20
ARG PNPM_VERSION=9.15.0

FROM node:${NODE_VERSION}-alpine AS base

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

RUN pnpm --filter @openconferences/worker --prod deploy /prod/worker

FROM node:${NODE_VERSION}-alpine AS runner

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 worker

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder --chown=worker:worker /prod/worker ./

USER worker

CMD ["node", "dist/main.js"]
