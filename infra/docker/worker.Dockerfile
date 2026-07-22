# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/worker/package.json ./apps/worker/
COPY packages/config/package.json ./packages/config/
COPY packages/db/package.json ./packages/db/
COPY packages/db/prisma ./packages/db/prisma/
COPY packages/schemas/package.json ./packages/schemas/
RUN pnpm install --frozen-lockfile --filter @openconferences/worker...

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/worker/node_modules ./apps/worker/node_modules
COPY --from=deps /app/packages ./packages
COPY . .
RUN pnpm --filter @openconferences/config build \
 && pnpm --filter @openconferences/schemas build \
 && pnpm --filter @openconferences/db build \
 && pnpm --filter @openconferences/worker build

FROM node:20-alpine AS runner
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 worker
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder --chown=worker:worker /app/apps/worker/dist ./dist
COPY --from=builder --chown=worker:worker /app/node_modules ./node_modules
COPY --from=builder --chown=worker:worker /app/apps/worker/node_modules ./apps/worker/node_modules
COPY --from=builder --chown=worker:worker /app/packages ./packages
USER worker
CMD ["node", "dist/main.js"]
