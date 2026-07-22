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

All commands below are run from the repo root unless noted.

#### App & quality

| Command             | Description                                    |
| ------------------- | ---------------------------------------------- |
| `pnpm dev`          | Start web, api, and worker in parallel (Turbo) |
| `pnpm build`        | Build all packages and apps                    |
| `pnpm lint`         | Lint all packages                              |
| `pnpm typecheck`    | Typecheck all packages                         |
| `pnpm test`         | Run unit and integration tests                 |
| `pnpm test:e2e`     | Run Playwright smoke tests                     |
| `pnpm format`       | Format files with Prettier                     |
| `pnpm format:check` | Check Prettier formatting without writing      |

#### Infrastructure

| Command           | Description                                    |
| ----------------- | ---------------------------------------------- |
| `pnpm infra:up`   | Start Docker services (Postgres, Redis, MinIO) |
| `pnpm infra:down` | Stop Docker services                           |

#### Database

DB scripts load `DATABASE_URL` from the root `.env` via `packages/db`.

| Command                  | Description                                                   |
| ------------------------ | ------------------------------------------------------------- |
| `pnpm db:migrate`        | Create/apply migrations in development (`prisma migrate dev`) |
| `pnpm db:migrate:deploy` | Apply existing migrations (`prisma migrate deploy`)           |
| `pnpm db:seed`           | Run the database seed script                                  |
| `pnpm db:studio`         | Open Prisma Studio at http://localhost:5555                   |

Package-level DB helpers (from `packages/db`, or via `pnpm --filter @openconferences/db <script>`):

| Command         | Description                                |
| --------------- | ------------------------------------------ |
| `migrate:reset` | Reset the database and re-apply migrations |
| `generate`      | Regenerate the Prisma client               |
| `studio`        | Same as `pnpm db:studio`                   |

#### Worker / mail

| Command             | Description                           |
| ------------------- | ------------------------------------- |
| `pnpm mail:test`    | Send a test email via the worker      |
| `pnpm easydmrctest` | Run the EasyDMARC-related worker test |

### Architecture

See [docs/SYSTEM_DESIGN.md](docs/SYSTEM_DESIGN.md) and [docs/IMPLEMENTATION_ROADMAP.md](docs/IMPLEMENTATION_ROADMAP.md).

### Deployment

See [infra/RUNBOOK.md](infra/RUNBOOK.md) for deployment:

- **Web** → Vercel (`app.fresi.org`)
- **API / worker** → GitHub Actions builds images → GHCR → Coolify pulls on EC2 (`api.fresi.org`)
