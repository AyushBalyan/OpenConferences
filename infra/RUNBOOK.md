# Deployment Runbook (Phase 0)

This runbook documents external provisioning steps for staging/production. **These are not automated in Phase 0** — execute manually when ready to deploy.

## Prerequisites

- Hetzner VPS (or similar) with Coolify installed
- Managed PostgreSQL with PITR (Neon, Supabase, etc.)
- Redis instance (Upstash or container)
- Cloudflare account (WAF, CDN, Turnstile)
- Cloudflare R2 bucket for production file storage

## Coolify project setup

1. Create a Coolify project: `openconferences-staging`
2. Add three services from Docker images built by `.github/workflows/deploy.yml`:
   - `openconferences-api` — port 3001, health check `GET /api/v1/healthz`
   - `openconferences-web` — port 3000
   - `openconferences-worker` — no public port
3. Configure environment variables from `.env.example` (never commit secrets)
4. Wire health/readiness probes:
   - Liveness: `/api/v1/healthz`
   - Readiness: `/api/v1/readyz`

## Secrets (injected via Coolify, never in git)

| Variable       | Source                             |
| -------------- | ---------------------------------- |
| `DATABASE_URL` | Managed Postgres connection string |
| `REDIS_URL`    | Upstash or Redis container         |
| `S3_*`         | Cloudflare R2 credentials          |
| `SENTRY_DSN`   | Sentry project DSN                 |
| `CORS_ORIGINS` | Staging/prod web URL               |

## Cloudflare staging

1. Add DNS record pointing to Coolify VPS
2. Enable proxy (orange cloud) for WAF + CDN
3. Configure SSL/TLS (Full strict)
4. Add rate limiting rules on `/api/v1/auth/*` (Phase 1+)

## Database migrations in deploy pipeline

Before starting api/worker containers:

```bash
pnpm db:migrate:deploy
```

Run this as a Coolify pre-deploy hook or CI step.

## Rollback

1. Redeploy previous image tag in Coolify
2. Do **not** roll back migrations — ship forward fixes instead

## Verification checklist

- [ ] `GET /api/v1/healthz` returns 200
- [ ] `GET /api/v1/readyz` returns 200 (postgres + redis healthy)
- [ ] Web loads behind Cloudflare
- [ ] Worker logs show pg-boss job consumed
- [ ] No secrets in repository or image layers
