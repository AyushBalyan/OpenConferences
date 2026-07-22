# Deployment Runbook (Phase 0)

This runbook documents external provisioning steps for staging/production. **These are not automated in Phase 0** — execute manually when ready to deploy.

## Target hostnames

| Surface  | Host                 | Platform               |
| -------- | -------------------- | ---------------------- |
| Frontend | `app.fresi.org`      | Vercel (Next.js)       |
| API      | `api.fresi.org`      | EC2 + Coolify (NestJS) |
| Worker   | (no public hostname) | Same EC2 as API        |

## Prerequisites

- Vercel project for `apps/web` with custom domain `app.fresi.org`
- Amazon EC2 instance with Coolify installed (api + worker only)
- Managed PostgreSQL with PITR (Neon, Supabase, etc.)
- Redis instance (Upstash or container on EC2)
- Cloudflare account (WAF, CDN, Turnstile) in front of **`api.fresi.org`**
- Cloudflare R2 bucket for production file storage

## Vercel (frontend)

1. Import the monorepo; set root/app directory to `apps/web` (or use the repo’s documented Vercel project settings).
2. Add domain `app.fresi.org` and complete DNS as Vercel instructs (or CNAME via Cloudflare DNS).
3. Set frontend env (at minimum):

| Variable              | Value                          |
| --------------------- | ------------------------------ |
| `NEXT_PUBLIC_API_URL` | `https://api.fresi.org/api/v1` |
| `WEB_URL`             | `https://app.fresi.org`        |
| Turnstile / Sentry    | as needed                      |

## Coolify project setup (API + worker)

1. Create a Coolify project: `openconferences-staging` (or `…-production`)
2. Add **two** services from Docker images / Dockerfiles:
   - `openconferences-api` — port 3001, health check `GET /api/v1/healthz`
   - `openconferences-worker` — no public port
3. Map public hostname `api.fresi.org` → api service (HTTPS).
4. Configure environment variables from `.env.example` (never commit secrets)
5. Wire health/readiness probes:
   - Liveness: `/api/v1/healthz`
   - Readiness: `/api/v1/readyz`

## Secrets (injected via Coolify / Vercel, never in git)

| Variable              | Source / value                          |
| --------------------- | --------------------------------------- |
| `DATABASE_URL`        | Managed Postgres connection string      |
| `REDIS_URL`           | Upstash or Redis container              |
| `S3_*`                | Cloudflare R2 credentials               |
| `SENTRY_DSN`          | Sentry project DSN                      |
| `WEB_URL`             | `https://app.fresi.org`                 |
| `CORS_ORIGINS`        | `https://app.fresi.org`                 |
| `BETTER_AUTH_URL`     | `https://api.fresi.org`                 |
| `BETTER_AUTH_SECRET`  | Strong random secret (≥32 chars)        |
| `NEXT_PUBLIC_API_URL` | `https://api.fresi.org/api/v1` (Vercel) |

Ensure session cookies work across `app.fresi.org` and `api.fresi.org` (Secure cookie, domain `.fresi.org` where applicable, SameSite appropriate for cross-subdomain auth).

## Cloudflare (API)

1. DNS: `api` A/AAAA (or CNAME) → Coolify EC2 host; enable proxy (orange cloud)
2. SSL/TLS: **Full (strict)** once Coolify has a valid cert
3. Add rate limiting rules on `/api/v1/auth/*` (Phase 1+)
4. Optional: proxy `app.fresi.org` only if you intentionally put Cloudflare in front of Vercel; default is Vercel-managed HTTPS for the frontend

## Database migrations in deploy pipeline

Before starting api/worker containers:

```bash
pnpm db:migrate:deploy
```

Run this as a Coolify pre-deploy hook or CI step.

## Rollback

1. **API/worker:** redeploy previous image tag in Coolify
2. **Web:** revert/redeploy previous Vercel deployment
3. Do **not** roll back migrations — ship forward fixes instead

## Verification checklist

- [ ] `GET https://api.fresi.org/api/v1/healthz` returns 200
- [ ] `GET https://api.fresi.org/api/v1/readyz` returns 200 (postgres + redis healthy)
- [ ] `https://app.fresi.org` loads
- [ ] Browser can sign in (cookie accepted across app ↔ api subdomains)
- [ ] Worker logs show pg-boss job consumed
- [ ] No secrets in repository or image layers
