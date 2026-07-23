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
- DNS for `api.fresi.org` (GoDaddy A record → Elastic IP; Cloudflare optional later)
- Cloudflare R2 for files
- GitHub Actions enabled; GHCR packages for this repo

## Vercel (frontend)

1. Import the monorepo.
2. **Root Directory:** `apps/web` (include files outside root / monorepo mode on).
3. Commands are set in [`apps/web/vercel.json`](../apps/web/vercel.json):
   - Install: `pnpm install --filter @openconferences/web...` from repo root (builds workspace graph without `db`/Prisma).
   - Build: `pnpm --filter @openconferences/web... build` so `@openconferences/schemas` + `contracts` emit `dist/` before Next.js.
4. Domain `app.fresi.org`.
5. Env (minimum):

| Variable                         | Value                          |
| -------------------------------- | ------------------------------ |
| `NEXT_PUBLIC_API_URL`            | `https://api.fresi.org/api/v1` |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare Turnstile site key  |
| `WEB_URL`                        | `https://app.fresi.org`        |

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

Use `sudo` for all `docker` commands on the EC2 host unless your user is in the `docker` group.

Coolify container names are opaque IDs (e.g. `dojpq079ilrbspkscrcgdhkj-…`). Always filter by **image**, not by the string `api` / `worker` in the name:

```bash
sudo docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}\t{{.Image}}'
```

### API (detailed — first-time Coolify setup)

#### Step 1 — Create the resource

1. Coolify → same server/project → **+ New** → **Resource** → **Docker Image**.
2. Name: `fresi-api`.
3. **Docker Image:** `ghcr.io/ayushbalyan/openconferences/api`
4. **Tag:** `latest` (or a git sha for pinned rollbacks).
5. Registry: existing `ghcr.io` credentials.

#### Step 2 — Domain and ports

| Field             | Value                                                                                          |
| ----------------- | ---------------------------------------------------------------------------------------------- |
| **Domains**       | `https://api.fresi.org` (include `https://` — bare `api.fresi.org` breaks Traefik: `Host(``)`) |
| **Ports Exposes** | `3001`                                                                                         |
| **Port Mappings** | leave empty (Traefik routes via the Coolify network)                                           |

#### Step 3 — Healthcheck

- Enable Coolify healthcheck: **GET** `/api/v1/healthz` on port **3001**.
- Start period: at least **120–240s** until the image with `curl` + fast DB connect is deployed.
- If deploy logs show `curl: not found` / `Connection refused` for many minutes, temporarily **disable** healthcheck, fix `DATABASE_URL` (session pooler), redeploy, then re-enable.

#### Step 4 — Environment

Set secrets from the [Secrets](#secrets-coolify--vercel--never-in-git-or-image-layers) table. Critical:

```text
DATABASE_URL=postgresql://openconferences_api:PASSWORD@aws-0-<region>.pooler.supabase.com:5432/postgres?sslmode=require&uselibpqcompat=true
NODE_ENV=production
API_HOST=0.0.0.0
API_PORT=3001
BETTER_AUTH_URL=https://api.fresi.org
WEB_URL=https://app.fresi.org
CORS_ORIGINS=https://app.fresi.org
```

#### Step 5 — Deploy and verify (commands)

```bash
# List containers — look for openconferences/api:latest, Status Up (healthy)
sudo docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}\t{{.Image}}'

# Set the API container name from the table above
API_CTR=$(sudo docker ps -qf 'ancestor=ghcr.io/ayushbalyan/openconferences/api:latest' | head -1)
echo "API_CTR=$API_CTR"

# App logs — expect: API listening on http://0.0.0.0:3001/api/v1
sudo docker logs --tail 100 "$API_CTR"

# In-container health (bypasses Traefik)
sudo docker exec "$API_CTR" wget -qO- http://127.0.0.1:3001/api/v1/healthz
# → {"status":"ok",...}

# Confirm API + Traefik share the coolify network
sudo docker inspect "$API_CTR" --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}'
sudo docker inspect coolify-proxy --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}'
# both should include: coolify

# Traefik enabled?
sudo docker inspect "$API_CTR" --format 'traefik.enable={{index .Config.Labels "traefik.enable"}}'

# Hit Traefik on the host (bypasses public DNS)
curl -sk -H 'Host: api.fresi.org' https://127.0.0.1/api/v1/healthz
curl -s  -H 'Host: api.fresi.org' http://127.0.0.1/api/v1/healthz
# HTTPS → JSON ok; HTTP → "Found" (redirect to HTTPS) is fine

# Public checks (from laptop or EC2)
curl -i https://api.fresi.org/api/v1/healthz
curl -i https://api.fresi.org/api/v1/readyz

# SSL certificate (Let’s Encrypt via Coolify Traefik)
echo | openssl s_client -connect api.fresi.org:443 -servername api.fresi.org 2>/dev/null \
  | openssl x509 -noout -subject -issuer -dates

# Traefik / ACME errors (empty Host = bad domain format without https://)
sudo docker logs coolify-proxy 2>&1 | grep -i -E 'acme|certificate|letsencrypt|Host\(|error' | tail -40
```

#### Step 6 — DNS (GoDaddy) for API only

Worker needs **no** DNS record. For API:

1. GoDaddy → DNS for `fresi.org` → **A** record: name `api`, value = EC2 **Elastic IP**.
2. Verify:

```bash
# From laptop
dig +short api.fresi.org

# From EC2 — public IP of this instance
curl -s ifconfig.me
# dig result should be this Elastic IP (or Cloudflare IPs if you later proxy via Cloudflare)
```

EC2 security group inbound: **80/tcp** and **443/tcp** (Let’s Encrypt + HTTPS).

#### Step 7 — Optional webhook

Copy Coolify **Deploy Webhook** → GitHub Actions secret `COOLIFY_WEBHOOK_API`.

### Worker (detailed — first-time Coolify setup)

The worker is a **background job consumer** (pg-boss). It has **no HTTP server**, **no public hostname**, and **no SSL/DNS**. It runs on the same EC2/Coolify host as the API and shares Redis/S3/mail config, but must use the **`openconferences_worker`** database role.

#### Prerequisites

- [ ] API app (`fresi-api`) already deploys successfully from GHCR
- [ ] GHCR package `worker` exists: `ghcr.io/ayushbalyan/openconferences/worker:latest`
- [ ] Coolify **Docker Registry** for `ghcr.io` already configured (same PAT as API: `read:packages`)
- [ ] Restricted DB roles provisioned (see [Database roles](#database-roles-rls-stage-2)) **or** temporary owner URL only for smoke (not recommended for production)
- [ ] Same production secrets available as for the API (Redis, R2, Zepto, auth, etc.)

Confirm the worker image is pullable (on EC2, after registry login via Coolify):

```bash
sudo docker pull ghcr.io/ayushbalyan/openconferences/worker:latest
```

#### Step 1 — Create the Coolify resource

1. Open Coolify → select the same **server** / project as `fresi-api`.
2. Click **+ New** → **Resource**.
3. Choose **Docker Image** (not Git / Dockerfile build — the EC2 host must not compile).
4. Set **Name** to `fresi-worker` (or similar).
5. Leave description empty or note “pg-boss worker; no public domain”.

#### Step 2 — Point at the GHCR image

1. **Docker Image:** `ghcr.io/ayushbalyan/openconferences/worker`  
   (lowercase owner/repo; no `https://` prefix).
2. **Docker Image Tag or Hash:** `latest`  
   (for production rollbacks, prefer a full git sha tag from Actions).
3. Select the existing **`ghcr.io`** registry credentials (same as API).
4. Do **not** enable “build from Dockerfile” or connect a Git repo for this resource.

#### Step 3 — Domains and networking (intentionally empty)

| Field               | Value     | Why                                      |
| ------------------- | --------- | ---------------------------------------- |
| **Domains**         | _(empty)_ | Worker is not publicly reachable         |
| **Ports Exposes**   | _(empty)_ | No process listens on a port             |
| **Port Mappings**   | _(empty)_ | Traefik must not route to this container |
| **Network Aliases** | _(empty)_ | Not required                             |
| **HTTP Basic Auth** | off       | N/A                                      |

Do **not** set `worker.fresi.org` or any domain. DNS (GoDaddy) needs **no** new record for the worker.

#### Step 4 — Disable HTTP healthcheck

1. Open the resource **Healthcheck** settings.
2. **Turn healthcheck off** (or leave disabled).
3. Reason: the worker image has no `/healthz` HTTP endpoint. An HTTP check will mark the container unhealthy and Coolify may kill/rollback it.

Success is verified via **container status + logs** (Step 7), not via curl.

#### Step 5 — Environment variables

Open **Environment Variables** / **Secrets** for `fresi-worker`.

**Copy from `fresi-api`, then change only what differs.**

##### Required / shared with API

| Variable              | Production value                                                         |
| --------------------- | ------------------------------------------------------------------------ |
| `NODE_ENV`            | `production`                                                             |
| `REDIS_URL`           | Same as API (Upstash or Coolify Redis URL reachable from this container) |
| `S3_ENDPOINT`         | Cloudflare R2 endpoint                                                   |
| `S3_ACCESS_KEY`       | R2 access key                                                            |
| `S3_SECRET_KEY`       | R2 secret key                                                            |
| `S3_BUCKET`           | R2 bucket name                                                           |
| `S3_REGION`           | e.g. `auto` or your R2 region                                            |
| `S3_FORCE_PATH_STYLE` | `true` if required by your R2/client setup                               |
| `WEB_URL`             | `https://app.fresi.org`                                                  |
| `NEXT_PUBLIC_API_URL` | `https://api.fresi.org/api/v1` (required by shared env schema)           |
| `CORS_ORIGINS`        | `https://app.fresi.org` (include if env validation requires it)          |
| `BETTER_AUTH_SECRET`  | Same ≥32-char secret as API                                              |
| `BETTER_AUTH_URL`     | `https://api.fresi.org`                                                  |
| `MAIL_FROM`           | e.g. `Fresi <notifications@mail.fresi.org>`                              |
| `MAIL_FROM_NAME`      | e.g. `Fresi`                                                             |
| `ZEPTO_MAIL_API_KEY`  | Zoho Zepto key (without key, email jobs only log)                        |
| `ZEPTO_MAIL_API_URL`  | Region endpoint (e.g. `https://api.zeptomail.in/v1.1/email`)             |
| `LOG_LEVEL`           | `info` (or `debug` while debugging)                                      |
| `SENTRY_DSN`          | Optional                                                                 |

Optional (match API if used): `ZEPTO_WEBHOOK_SECRET`, `CLAMAV_*`, `RAZORPAY_*`, `NOTIFICATION_RETENTION_DAYS`, Turnstile keys, etc.

##### Must differ from API

| Variable       | Worker value                                                     |
| -------------- | ---------------------------------------------------------------- |
| `DATABASE_URL` | Supabase **session** pooler as role **`openconferences_worker`** |

Example shape (replace password/region; do not commit real secrets):

```text
postgresql://openconferences_worker:PASSWORD@aws-0-<region>.pooler.supabase.com:5432/postgres?sslmode=require&uselibpqcompat=true
```

Notes:

- Prefer `*.pooler.supabase.com` port **`5432` (session mode)** — required for pg-boss.
- Do **not** use `db.<ref>.supabase.co` from EC2 if IPv6 is unavailable (multi-minute connect hang).
- Do **not** reuse the API role URL (`openconferences_api`) for the worker in production.
- Production boot **rejects** superuser / `BYPASSRLS` roles unless `SKIP_DB_ROLE_CHECK=true` (emergency only).

##### Do not set for worker

- `API_HOST` / `API_PORT` — unused by worker (harmless if present; omit for clarity)

#### Step 6 — Deploy

1. Click **Save** (if shown) then **Deploy**.
2. Watch the deploy log: it should **pull** `ghcr.io/.../worker:latest`, not build a Dockerfile.
3. On a 2 GiB host, prefer deploying worker **after** API is stable (avoid pulling/restarting both at once).

#### Step 7 — Verify on the EC2 host

```bash
# List all Coolify-related containers
sudo docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}\t{{.Image}}'

# Resolve worker container ID by image
WORKER_CTR=$(sudo docker ps -qf 'ancestor=ghcr.io/ayushbalyan/openconferences/worker:latest' | head -1)
echo "WORKER_CTR=$WORKER_CTR"

# Must be Up (not Restarting / Exited)
sudo docker ps --filter "id=$WORKER_CTR" --format '{{.Names}} {{.Status}}'

# Logs — expect: pg-boss worker started
sudo docker logs --tail 100 "$WORKER_CTR"

# Follow logs while smoking a job from the API
sudo docker logs -f --tail 50 "$WORKER_CTR"

# Network: worker should be on coolify (same as API / proxy) for private Redis if used
sudo docker inspect "$WORKER_CTR" --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}'

# Restart count / exit reason if unhealthy
sudo docker inspect "$WORKER_CTR" --format 'Status={{.State.Status}} ExitCode={{.State.ExitCode}} OOM={{.State.OOMKilled}} Error={{.State.Error}}'
```

Healthy signs:

- Status: `Up …`
- Log line: `pg-boss worker started`
- No crash loop / restart every few seconds

Unhealthy signs:

- `Unsafe database role "…"` → wrong `DATABASE_URL` role (still owner/`BYPASSRLS`)
- Hang then exit with Postgres timeout → wrong host / not session pooler / network
- Immediate exit on env validation → missing required env var (read the error)

Quick filter for failures:

```bash
sudo docker logs "$WORKER_CTR" 2>&1 | grep -iE 'error|unsafe|invalid environment|ECONNREFUSED|timeout' | tail -30
```

#### Step 8 — Optional GitHub auto-redeploy webhook

1. In Coolify → `fresi-worker` → find **Deploy Webhook** (or “Webhook URL”).
2. Copy the URL.
3. GitHub → this repo → **Settings** → **Secrets and variables** → **Actions**.
4. Create/update secret:

| Secret                   | Value                                         |
| ------------------------ | --------------------------------------------- |
| `COOLIFY_WEBHOOK_WORKER` | Coolify deploy webhook URL for `fresi-worker` |

5. Confirm `COOLIFY_WEBHOOK_API` is already set for the API app.
6. On the next successful **Build and Push Images** workflow on `main`, Actions will trigger worker redeploy (workflow staggers API vs worker).

#### Step 9 — Smoke job path (after worker is Up)

1. Trigger any flow that enqueues work from the API (e.g. send a notification, upload a file for scan, or run a reminder/discard path in staging).
2. On EC2, watch worker logs:

```bash
WORKER_CTR=$(sudo docker ps -qf 'ancestor=ghcr.io/ayushbalyan/openconferences/worker:latest' | head -1)
sudo docker logs -f --tail 100 "$WORKER_CTR"
```

3. Confirm side effects (email via Zepto, scan status update, etc.).

#### Worker vs API cheat sheet

| Item                | API (`fresi-api`)               | Worker (`fresi-worker`)  |
| ------------------- | ------------------------------- | ------------------------ |
| Image               | `…/api:latest`                  | `…/worker:latest`        |
| Domain              | `https://api.fresi.org`         | none                     |
| Ports Exposes       | `3001`                          | none                     |
| Healthcheck         | `GET /api/v1/healthz` on `3001` | **disabled**             |
| `DATABASE_URL` role | `openconferences_api`           | `openconferences_worker` |
| DNS (GoDaddy)       | A record `api` → Elastic IP     | none                     |
| SSL                 | Coolify Let’s Encrypt           | N/A                      |
| Webhook secret      | `COOLIFY_WEBHOOK_API`           | `COOLIFY_WEBHOOK_WORKER` |

### Important

- Turn **off** Git-based Dockerfile builds for these services so Coolify never compiles on the EC2 box.
- Redeploy = pull new tag + recreate container (cheap on RAM).
- Stagger API vs worker restarts on 2 GiB hosts (the workflow sleeps 15s between webhooks).
- Worker health is **logs + `docker ps`**, not a public URL.
- API public failure mode `no available server` = Traefik has no healthy backend (domain/`https://` missing, container down, or healthcheck rolling back).

## Secrets (Coolify / Vercel — never in git or image layers)

| Variable                | Source / value                                                                                                                                                      |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`          | **API:** session pooler as `openconferences_api` (NOBYPASSRLS). **Worker:** session pooler as `openconferences_worker`. **Migrate job only:** owner/`postgres` URL. |
| `REDIS_URL`             | Upstash or Redis container                                                                                                                                          |
| `S3_*`                  | Cloudflare R2 credentials                                                                                                                                           |
| `SENTRY_DSN`            | Sentry project DSN                                                                                                                                                  |
| `WEB_URL`               | `https://app.fresi.org`                                                                                                                                             |
| `CORS_ORIGINS`          | `https://app.fresi.org`                                                                                                                                             |
| `BETTER_AUTH_URL`       | `https://api.fresi.org`                                                                                                                                             |
| `BETTER_AUTH_SECRET`    | Strong random secret (≥32 chars)                                                                                                                                    |
| `NEXT_PUBLIC_API_URL`   | `https://api.fresi.org/api/v1` (Vercel)                                                                                                                             |
| `NODE_ENV`              | `production`                                                                                                                                                        |
| `API_HOST` / `API_PORT` | `0.0.0.0` / `3001`                                                                                                                                                  |

Session cookies must work across `app.fresi.org` and `api.fresi.org` (Secure, domain `.fresi.org` where applicable).

### Database roles (RLS stage 2)

1. Apply migrations with the owner connection:

```bash
# From a trusted machine with owner/postgres DATABASE_URL in env
export DATABASE_URL='postgresql://postgres:OWNER_PASSWORD@aws-0-<region>.pooler.supabase.com:5432/postgres?sslmode=require&uselibpqcompat=true'
pnpm db:migrate:deploy
```

2. Provision / enable LOGIN for restricted roles (passwords never stored in git):

```bash
export DATABASE_URL='postgresql://postgres:OWNER_PASSWORD@aws-0-<region>.pooler.supabase.com:5432/postgres?sslmode=require&uselibpqcompat=true'
export OPENCONFERENCES_API_PASSWORD='…'
export OPENCONFERENCES_WORKER_PASSWORD='…'
./infra/postgres/scripts/provision-app-roles.sh
```

3. Set Coolify API/worker `DATABASE_URL` to the Supabase **session** pooler (port `5432`) using those roles, with `sslmode=require&uselibpqcompat=true` when required by Node `pg`.
   - Prefer the pooler host (`*.pooler.supabase.com`), **not** `db.<ref>.supabase.co`. Direct DB hosts are often IPv6-only; EC2 without IPv6 will hang for minutes on connect and Coolify healthchecks fail with `Connection refused` (app never bound `:3001` in time).
   - API example: `postgresql://openconferences_api:...@aws-0-<region>.pooler.supabase.com:5432/postgres?sslmode=require&uselibpqcompat=true`
   - Worker example: same host/db, user `openconferences_worker`
4. From EC2, confirm the pooler port is reachable:

```bash
# Replace with your pooler host
nc -vz aws-0-<region>.pooler.supabase.com 5432
# or
timeout 5 bash -c 'echo >/dev/tcp/aws-0-<region>.pooler.supabase.com/5432' && echo ok
```

5. Optionally disable the Supabase Data API in the dashboard (Nest/Prisma does not use it). Stage-1 migration already revokes Data API grants on `public`.
6. Confirm API/worker boot (they reject `BYPASSRLS`/superuser roles in production).
7. **Bootstrap pg-boss queues as owner** (required once after role cutover — see below).

### pg-boss queues (why grants alone are not enough)

Restricted roles can receive `USAGE` / `CREATE` / `REFERENCES` on `pgboss`, but `create_queue()` eventually runs:

```sql
ALTER TABLE pgboss.job ATTACH PARTITION …
```

That requires **ownership** of `pgboss.job`. Grants cannot satisfy it. The function is idempotent: if the queue row already exists, it returns without attaching.

Run once with the **owner** URL (after `provision-app-roles.sh`):

```bash
export DATABASE_URL='postgresql://postgres.qbqnfrrmgvoaaudznadn:OWNER_PASSWORD@aws-1-ap-south-1.pooler.supabase.com:5432/postgres?sslmode=require'
./infra/postgres/scripts/bootstrap-pgboss-queues.sh
```

Then redeploy API and worker. Re-run the bootstrap whenever you add a new queue name in code.

Cascading Coolify errors during cutover usually mean each redeploy unlocked the _next_ check (`auth` → `schema CREATE` → `REFERENCES` → `must be owner`). The last step is ownership — fixed by this bootstrap, not another `GRANT`.

### Coolify healthcheck (API)

- Path: `/api/v1/healthz`, port `3001`, method GET.
- Image includes `curl`. If deploy logs say `curl: not found`, you are on an old image — rebuild/push `api:latest`.
- If healthchecks show `Connection refused` for several minutes, the process is still blocked on Postgres (see DATABASE_URL above). Temporarily disable the Coolify healthcheck only to inspect boot logs (`[boot] asserting database role` vs `[boot] binding`).

```bash
API_CTR=$(sudo docker ps -qf 'ancestor=ghcr.io/ayushbalyan/openconferences/api:latest' | head -1)
sudo docker logs --tail 200 "$API_CTR" | grep -E '\[boot\]|listening|Unsafe|error'
```

### Stage rollout checklist

**Stage 1 (Data API lockdown; runtime may still be owner/`postgres`):**

- [x] Apply `20260723120000_stage1_data_api_lockdown` (+ stage 2 migrations as shipped)
- [x] Confirm `anon` / `authenticated` / `service_role` have **0** grants on `public`
- [x] Supabase security advisors: no “RLS disabled in public” / unrestricted table errors (expected INFO: `_prisma_migrations` has RLS with no policies = deny-all)
- [ ] Optional: disable Data API in Supabase dashboard (Nest/Prisma does not use it)
- [ ] Smoke API health/auth while still on owner URL

**Stage 2 (restricted roles + FORCE RLS policies):**

- [x] Apply `20260723130000_stage2_rls_roles_and_policies` and `20260723140000_grant_set_role_to_owners`
- [x] Roles `openconferences_api` / `openconferences_worker` exist with `NOBYPASSRLS`
- [x] Policy smoke via `SET LOCAL ROLE` (member+context allow, absent context deny, outsider deny, worker paper allow, worker accounts deny)
- [ ] Run `./infra/postgres/scripts/provision-app-roles.sh` with operator-generated passwords (enables `LOGIN`)
- [ ] Point Coolify **API** `DATABASE_URL` at session pooler as `openconferences_api` (`sslmode=require&uselibpqcompat=true` as needed); smoke auth + tenant flows
- [ ] Point Coolify **worker** `DATABASE_URL` at `openconferences_worker`; smoke reminder/notification/scan/invoice/reconcile/discard jobs
- [ ] Re-run security advisors after cutover

Rollback for role cutover: point Coolify `DATABASE_URL` back to the previous owner URL (temporary). Do **not** roll back Prisma migrations.

## DNS and TLS (API)

DNS for `fresi.org` may live in **GoDaddy** (or Cloudflare). Coolify Traefik issues **Let’s Encrypt** for `https://api.fresi.org`. The worker needs no DNS/TLS.

### GoDaddy (current)

1. DNS → **A** `api` → EC2 Elastic IP.
2. No record for worker.
3. Verify:

```bash
dig +short api.fresi.org
curl -s ifconfig.me   # on EC2; must match the A record
curl -i https://api.fresi.org/api/v1/healthz
echo | openssl s_client -connect api.fresi.org:443 -servername api.fresi.org 2>/dev/null \
  | openssl x509 -noout -subject -issuer -dates
```

### Optional Cloudflare later

If you move nameservers to Cloudflare:

1. DNS: `api` → Elastic IP, proxied (orange).
2. SSL/TLS mode: **Full (strict)** once Coolify has a Let’s Encrypt cert.
3. Rate limit `/api/v1/auth/*` (Phase 1+).

## Database migrations

Apply **before** new api/worker start using new schema:

```bash
export DATABASE_URL='postgresql://postgres:OWNER_PASSWORD@…/postgres?sslmode=require&uselibpqcompat=true'
pnpm db:migrate:deploy
```

Run from a trusted machine or a Coolify pre-deploy / one-off job with owner `DATABASE_URL`. Do **not** roll back migrations; fix forward.

## Rollback

1. In Coolify, set image tag to a previous digest/sha and redeploy.
2. Or re-run Actions on an older commit (rebuild) and pull.
3. Web: previous Vercel deployment.
4. Never roll back Prisma migrations.

```bash
# See which digests are running
sudo docker ps --format '{{.Image}}\t{{.Names}}\t{{.Status}}' \
  | grep openconferences
```

## Verification

Checklist:

- [ ] Actions run green; packages visible under GitHub → Packages
- [ ] Coolify API/worker show image pull (not Dockerfile build logs)
- [ ] `GET https://api.fresi.org/api/v1/healthz` → 200
- [ ] `GET https://api.fresi.org/api/v1/readyz` → 200
- [ ] `https://app.fresi.org` loads; sign-in works
- [ ] Worker logs show `pg-boss worker started`
- [ ] No secrets in git or image layers

Commands:

```bash
# --- from laptop ---
curl -i https://api.fresi.org/api/v1/healthz
curl -i https://api.fresi.org/api/v1/readyz
dig +short api.fresi.org

# --- on EC2 ---
sudo docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}' | grep openconferences

API_CTR=$(sudo docker ps -qf 'ancestor=ghcr.io/ayushbalyan/openconferences/api:latest' | head -1)
WORKER_CTR=$(sudo docker ps -qf 'ancestor=ghcr.io/ayushbalyan/openconferences/worker:latest' | head -1)

sudo docker exec "$API_CTR" wget -qO- http://127.0.0.1:3001/api/v1/healthz
sudo docker logs --tail 50 "$API_CTR" | grep -E 'listening|error' || true
sudo docker logs --tail 50 "$WORKER_CTR" | grep -E 'pg-boss worker started|error|Unsafe' || true

curl -sk -H 'Host: api.fresi.org' https://127.0.0.1/api/v1/healthz
```

## First-time migration checklist

1. Push workflow to `main` and run **Build and Push Images**.
2. Configure GHCR package visibility + Coolify registry auth.
3. Recreate Coolify apps as Docker Image pulls (`fresi-api`, then `fresi-worker`).
4. Wire optional webhooks (`COOLIFY_WEBHOOK_API`, `COOLIFY_WEBHOOK_WORKER`).
5. Verify with the commands in [Verification](#verification).
6. Confirm Let’s Encrypt: `openssl s_client` shows issuer Let’s Encrypt for `api.fresi.org`.
