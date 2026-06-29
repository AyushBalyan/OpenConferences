# OpenConferences

Multi-conference management platform — internal operating system for academic conferences.

## Phase 0 — Project Foundation

This repository contains the monorepo skeleton: web (Next.js), api (NestJS), worker (pg-boss), and shared packages.

### Prerequisites

- Node.js 20+
- pnpm 9
- Docker & Docker Compose

### Quick start

```bash
# Copy environment template
cp .env.example .env

# Start infrastructure (Postgres, Redis, MinIO)
pnpm infra:up

# Install dependencies
pnpm install

# Run database migrations
pnpm db:migrate:deploy

# Start all apps in dev mode
pnpm dev
```

- Web: http://localhost:3000
- API: http://localhost:3001/api/v1
- Health: http://localhost:3001/api/v1/healthz
- Readiness: http://localhost:3001/api/v1/readyz

### Scripts

| Command           | Description                        |
| ----------------- | ---------------------------------- |
| `pnpm dev`        | Start web, api, worker in parallel |
| `pnpm build`      | Build all packages and apps        |
| `pnpm test`       | Run unit and integration tests     |
| `pnpm test:e2e`   | Run Playwright smoke tests         |
| `pnpm lint`       | Lint all packages                  |
| `pnpm infra:up`   | Start Docker services              |
| `pnpm db:migrate` | Run Prisma migrate dev             |
| `pnpm db:seed`    | Verify DB connectivity             |

### Architecture

See [docs/SYSTEM_DESIGN.md](docs/SYSTEM_DESIGN.md) and [docs/IMPLEMENTATION_ROADMAP.md](docs/IMPLEMENTATION_ROADMAP.md).

### Deployment

See [infra/RUNBOOK.md](infra/RUNBOOK.md) for Coolify/Cloudflare staging setup.
