# Database Migrations Runbook

## Principles

- **Forward-only in production.** Never edit or delete applied migrations.
- **One source of truth:** `packages/db/prisma/schema.prisma` + `prisma/migrations/`.
- **UUIDv7/ULID** primary keys are generated in the application layer, not via `@default(uuid())` (see SYSTEM_DESIGN §4).

## Local development

```bash
pnpm infra:up          # start Postgres
pnpm db:migrate        # prisma migrate dev
pnpm db:seed           # verify connectivity
```

## CI / staging / production

```bash
pnpm db:migrate:deploy   # prisma migrate deploy (non-interactive)
```

Run `migrate deploy` as part of the deploy pipeline **before** starting api/worker containers.

## Baseline migration

The initial migration (`0001_baseline_extensions`) enables:

- `pgcrypto` — cryptographic functions
- `uuid-ossp` — UUID generation helpers
- `pg_stat_statements` — query performance monitoring

No domain tables exist until Phase 1.

## Rollback

Production rollbacks are **application-level** (redeploy previous image), not schema rollbacks. If a migration must be reversed, ship a new forward migration that undoes the change.

## Test database

Integration tests use a separate database (`openconferences_test`). Reset with:

```bash
DATABASE_URL=postgresql://openconferences:openconferences@localhost:5432/openconferences_test \
  pnpm --filter @openconferences/db migrate:deploy
```
