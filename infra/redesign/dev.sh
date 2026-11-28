#!/usr/bin/env bash
# Start the redesign: local database, migrations, seed, then the API, the
# worker and apps/web-v2. Run it as `pnpm redesign:dev` from the repository root.
#
# Settings come from .env.redesign. A variable already exported in the shell
# wins over the file, and a DATABASE_URL that is not local stops everything at
# the first step with an explanation.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

if [ ! -f .env.redesign ]; then
  echo "Missing .env.redesign. This command only works on the redesign branch." >&2
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "==> Installing dependencies"
  pnpm install --frozen-lockfile
fi

echo "==> Checking that the database is local"
pnpm --silent --filter @openconferences/db check:local

echo "==> Starting the local redesign database"
infra/redesign/db.sh start

echo "==> Applying migrations"
pnpm --filter @openconferences/db migrate:deploy

echo "==> Seeding the invented organisation and conference"
pnpm turbo run build --filter=@openconferences/db --output-logs=errors-only
pnpm --filter @openconferences/db seed:redesign

echo "==> Starting the API (3101), the worker and apps/web-v2 (3100)"
echo "    Health page: http://localhost:3100/health"
exec pnpm turbo run dev \
  --filter=@openconferences/api \
  --filter=@openconferences/worker \
  --filter=@openconferences/web-v2
