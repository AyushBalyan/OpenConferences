#!/usr/bin/env bash
# Create all app pg-boss queues as the DB owner.
# Restricted API/worker roles cannot ATTACH PARTITION on pgboss.job (must be table owner).
# After this runs once, their createQueue() calls become no-ops (ON CONFLICT).
#
# Required:
#   DATABASE_URL  — owner / postgres pooler URL (not openconferences_api/worker)
#
# Usage:
#   export DATABASE_URL='postgresql://postgres.<ref>:…@…pooler.supabase.com:5432/postgres?sslmode=require'
#   ./infra/postgres/scripts/bootstrap-pgboss-queues.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
SQL_FILE="$ROOT/infra/postgres/scripts/bootstrap-pgboss-queues.sql"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required (owner role)" >&2
  exit 1
fi

PSQL_DATABASE_URL="$(
  printf '%s' "$DATABASE_URL" \
    | sed -E 's/([?&])uselibpqcompat=[^&]*&?/\1/g; s/[?&]$//'
)"

echo "Bootstrapping pg-boss queues as owner…"
psql "$PSQL_DATABASE_URL" -v ON_ERROR_STOP=1 -f "$SQL_FILE"
echo "Done. Redeploy API and worker."
