# Database Migrations Runbook

## Principles

- **Forward-only in production.** Never edit or delete applied migrations.
- **One source of truth:** `packages/db/prisma/schema.prisma` + `prisma/migrations/`.
- **UUIDv7/ULID** primary keys are generated in the application layer, not via `@default(uuid())` (see SYSTEM_DESIGN §4).
- **RLS is defense-in-depth** (§18.4). NestJS guards/services remain the RBAC authority.

## Local development

```bash
pnpm infra:up          # start Postgres (creates openconferences_api / openconferences_worker)
pnpm db:migrate        # prisma migrate dev
pnpm db:seed           # verify connectivity (owner role OK for seed)
```

Local Docker still exposes the owner role `openconferences` for migrations/seed. Prefer API/worker URLs that use the restricted roles once stage-2 migrations are applied:

```bash
# API / worker runtime (NOBYPASSRLS)
DATABASE_URL=postgresql://openconferences_api:openconferences@localhost:5432/openconferences

# Migrations / seed only
DATABASE_URL=postgresql://openconferences:openconferences@localhost:5432/openconferences
```

## CI / staging / production

```bash
pnpm db:migrate:deploy   # prisma migrate deploy (non-interactive) as OWNER role
```

Run `migrate deploy` as part of the deploy pipeline **before** starting api/worker containers.

Then provision/login-enable restricted roles (passwords never stored in git):

```bash
export DATABASE_URL='postgresql://postgres:...@.../postgres'  # owner / migration URL
export OPENCONFERENCES_API_PASSWORD='...'
export OPENCONFERENCES_WORKER_PASSWORD='...'
./infra/postgres/scripts/provision-app-roles.sh
```

Point Coolify API `DATABASE_URL` at the **session pooler** using `openconferences_api`, and worker at `openconferences_worker`. Keep owner credentials only for migrate/seed one-offs.

## RLS stages

| Stage | Migration                                        | Effect                                                                                                                                                                                    |
| ----- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | `20260723120000_stage1_data_api_lockdown`        | Revokes `anon`/`authenticated`/`service_role` on `public`; enables RLS on previously open tables; hardens helper functions. Runtime may still use owner/`BYPASSRLS`.                      |
| 2     | `20260723130000_stage2_rls_roles_and_policies`   | Creates `openconferences_api` / `openconferences_worker`, FORCE RLS, role-targeted policies, org-inherited conference helpers. Removes `app.bypass_rls` as an authorization escape hatch. |
| 2b    | `20260723140000_grant_set_role_to_owners`        | Grants owner roles permission to `SET ROLE` into API/worker for diagnostics and integration tests.                                                                                        |
| 2c    | `20260723150000_soften_conference_context_match` | Soft-binds conference route context (mismatch still denied; absent context allowed for cross-conference lists).                                                                           |

Production API/worker refuse to start if `current_user` has `rolsuper` or `rolbypassrls` (override with `SKIP_DB_ROLE_CHECK=true` only for intentional owner jobs).

## Baseline migration

The initial migration (`0001_baseline_extensions`) enables:

- `pgcrypto` — cryptographic functions
- `uuid-ossp` — UUID generation helpers
- `pg_stat_statements` — query performance monitoring

No domain tables exist until Phase 1.

## Rollback

Production rollbacks are **application-level** (redeploy previous image / restore previous `DATABASE_URL` role), not schema rollbacks. If a migration must be reversed, ship a new forward migration that undoes the change.

## Test database

Integration tests use a separate database (`openconferences_test`). Reset with:

```bash
DATABASE_URL=postgresql://openconferences:openconferences@localhost:5432/openconferences_test \
  pnpm --filter @openconferences/db migrate:deploy
```

RLS suite (`apps/api/test/integration/rls.test.ts`) uses `SET LOCAL ROLE` to assert API/worker policies while connecting as the owner.
