# Deployment Runbook

External provisioning for staging/production. **Images for api/worker are built in GitHub Actions and pulled by Coolify** — the EC2 host does not compile Docker images from Git.

## Target hostnames

| Surface  | Host                 | Platform                      |
| -------- | -------------------- | ----------------------------- |
| Frontend | `app.fresi.org`      | Vercel (Next.js)              |
| API      | `api.fresi.org`      | EC2 + Coolify (prebuilt GHCR) |
| Worker   | (no public hostname) | Same EC2 (prebuilt GHCR)      |

## Image registry (GHCR)

Workflow: [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml)

| Service | Image                           | Tags                                     |
| ------- | ------------------------------- | ---------------------------------------- |
| API     | `ghcr.io/<owner>/<repo>/api`    | `<full-sha>`, `main`, `latest` (on main) |
| Worker  | `ghcr.io/<owner>/<repo>/worker` | `<full-sha>`, `main`, `latest` (on main) |

Example (replace with your GitHub owner/repo, **lowercase**):

```text
ghcr.io/ayushbalyan/openconferences/api:latest
ghcr.io/ayushbalyan/openconferences/worker:latest
```

Owner/repo in the image path is always lowercase (GHCR requirement). The workflow lowercases `github.repository` automatically.

## Prerequisites

- Vercel project for `apps/web` → `app.fresi.org`
- Amazon EC2 + Coolify (runtime only for api/worker)
- Managed PostgreSQL with PITR
- Redis (Upstash or container on EC2)
- Cloudflare in front of `api.fresi.org`
- Cloudflare R2 for files
- GitHub Actions enabled; GHCR packages for this repo

## Vercel (frontend)

1. Import the monorepo; configure for `apps/web`.
2. Domain `app.fresi.org`.
3. Env (minimum):

| Variable              | Value                          |
| --------------------- | ------------------------------ |
| `NEXT_PUBLIC_API_URL` | `https://api.fresi.org/api/v1` |
| `WEB_URL`             | `https://app.fresi.org`        |

## GitHub Actions → GHCR

### What the workflow does

1. On push to `main` (paths under api/worker/packages/docker) or `workflow_dispatch`.
2. Builds `api` and `worker` in parallel on `ubuntu-latest` (not on your 2 GiB EC2).
3. Pushes to GHCR with Buildx + GHA layer cache.
4. Optionally GETs Coolify deploy webhooks (if secrets are set).

### GitHub settings (manual)

1. **Actions permissions**  
   Repo → Settings → Actions → General → Workflow permissions → **Read and write permissions** (needed for `packages: write` via `GITHUB_TOKEN`), or keep restricted and rely on the workflow’s `permissions:` block (preferred; already set).

2. **Package visibility**  
   After the first successful run:  
   GitHub → Packages → each of `api` / `worker` → Package settings →
   - Link to the repository
   - **Private** recommended for a solo prod app (or Public if you accept public pulls)

3. **If packages are private — Coolify pull credentials**  
   Create a classic PAT (or fine-grained token) with `read:packages` (and `repo` if the package is linked to a private repo, as required by GitHub).  
   In Coolify: add a **Docker Registry** (or Private Registry) for `ghcr.io`:
   - Username: your GitHub username
   - Password: the PAT
   - Registry: `ghcr.io`

4. **Optional auto-redeploy secrets**  
   Repo → Settings → Secrets and variables → Actions:

   | Secret                   | Value                                    |
   | ------------------------ | ---------------------------------------- |
   | `COOLIFY_WEBHOOK_API`    | Coolify “Deploy Webhook” URL for API app |
   | `COOLIFY_WEBHOOK_WORKER` | Coolify “Deploy Webhook” URL for worker  |

   No other secrets are required for push; login uses `GITHUB_TOKEN`.

## Coolify: deploy from GHCR (not from Git build)

Create/replace the two applications as **Docker Image** resources (not Dockerfile/Git build).

### API

1. New Resource → **Docker Image** (name may vary slightly by Coolify version: “Docker Image”, “Prebuilt image”, etc.).
2. Image: `ghcr.io/<owner>/<repo>/api:latest`  
   (or pin `:main` / a specific sha for safer rollbacks).
3. Registry credentials: the `ghcr.io` registry you added (if private).
4. Ports: container **3001** → public domain `api.fresi.org`.
5. Health checks:
   - Liveness: `/api/v1/healthz`
   - Readiness: `/api/v1/readyz`
6. Env vars from the Secrets table below (never bake into the image).
7. Copy the **Deploy Webhook** URL into GitHub secret `COOLIFY_WEBHOOK_API` if you want auto-redeploy.

### Worker

1. Docker Image: `ghcr.io/<owner>/<repo>/worker:latest`
2. Same GHCR credentials.
3. **No** public port/domain.
4. Same app env as API (DB/Redis/S3/auth as needed).
5. Webhook → `COOLIFY_WEBHOOK_WORKER`.

### Important

- Turn **off** Git-based Dockerfile builds for these services so Coolify never compiles on the EC2 box.
- Redeploy = pull new tag + recreate container (cheap on RAM).
- Stagger API vs worker restarts on 2 GiB hosts (the workflow sleeps 15s between webhooks).

## Secrets (Coolify / Vercel — never in git or image layers)

| Variable                | Source / value                          |
| ----------------------- | --------------------------------------- |
| `DATABASE_URL`          | Managed Postgres connection string      |
| `REDIS_URL`             | Upstash or Redis container              |
| `S3_*`                  | Cloudflare R2 credentials               |
| `SENTRY_DSN`            | Sentry project DSN                      |
| `WEB_URL`               | `https://app.fresi.org`                 |
| `CORS_ORIGINS`          | `https://app.fresi.org`                 |
| `BETTER_AUTH_URL`       | `https://api.fresi.org`                 |
| `BETTER_AUTH_SECRET`    | Strong random secret (≥32 chars)        |
| `NEXT_PUBLIC_API_URL`   | `https://api.fresi.org/api/v1` (Vercel) |
| `NODE_ENV`              | `production`                            |
| `API_HOST` / `API_PORT` | `0.0.0.0` / `3001`                      |

Session cookies must work across `app.fresi.org` and `api.fresi.org` (Secure, domain `.fresi.org` where applicable).

## Cloudflare (API)

1. DNS: `api` → EC2 Elastic IP, proxied (orange).
2. SSL/TLS: **Full (strict)** once Coolify has a cert.
3. Rate limit `/api/v1/auth/*` (Phase 1+).

## Database migrations

Apply **before** new api/worker start using new schema:

```bash
pnpm db:migrate:deploy
```

Run from a trusted machine or a Coolify pre-deploy / one-off job with `DATABASE_URL`. Do **not** roll back migrations; fix forward.

## Rollback

1. In Coolify, set image tag to a previous digest/sha and redeploy.
2. Or re-run Actions on an older commit (rebuild) and pull.
3. Web: previous Vercel deployment.
4. Never roll back Prisma migrations.

## Verification

- [ ] Actions run green; packages visible under GitHub → Packages
- [ ] Coolify API/worker show image pull (not Dockerfile build logs)
- [ ] `GET https://api.fresi.org/api/v1/healthz` → 200
- [ ] `GET https://api.fresi.org/api/v1/readyz` → 200
- [ ] `https://app.fresi.org` loads; sign-in works
- [ ] Worker logs show pg-boss activity
- [ ] No secrets in git or image layers

## First-time migration checklist

See the end of the agent response / PR description; summary:

1. Push workflow to `main` and run **Build and Push Images**.
2. Configure GHCR package visibility + Coolify registry auth.
3. Recreate Coolify apps as Docker Image pulls.
4. Wire optional webhooks.
5. Verify healthz/readyz.
