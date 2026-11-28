#!/usr/bin/env bash
# A throwaway local copy of a production backup, for the Phase 1 audit only.
#
# The audit needs the settings that real conferences hold. This restores a
# backup file into its own database on the local redesign Postgres server, so
# the audit can read it without connecting to production. See decision D11 in
# docs/redesign/DECISIONS.md for the rules that apply to this copy.
#
#   infra/redesign/audit/snapshot.sh restore <backup.dump>
#   infra/redesign/audit/snapshot.sh run <query.sql>   # read-only, saved under out/
#   infra/redesign/audit/snapshot.sh psql              # read-only shell
#   infra/redesign/audit/snapshot.sh drop              # delete the copy and out/
#
# It only ever talks to 127.0.0.1:55433/audit_snapshot. Tables that hold
# credentials are restored empty. Row-level security is left out, because the
# roles its policies name do not exist on the local server.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
HERE="$ROOT/infra/redesign/audit"
OUT="$HERE/out"
PORT=55433
DB=audit_snapshot
DB_USER=openconferences
export LANG=C LC_ALL=C

# Restored with their structure but no rows: passwords, sessions, one-time
# codes and integration keys are not needed for an audit.
SECRET_TABLES='accounts|sessions|verifications|two_factors|api_integration_keys'

find_pg_bin() {
  if [ -n "${PG_BIN:-}" ]; then
    echo "$PG_BIN"
    return
  fi
  local dir
  for dir in \
    /opt/homebrew/opt/postgresql@17/bin /opt/homebrew/opt/postgresql@16/bin \
    /usr/local/opt/postgresql@17/bin /usr/local/opt/postgresql@16/bin \
    /usr/lib/postgresql/17/bin /usr/lib/postgresql/16/bin; do
    if [ -x "$dir/pg_restore" ]; then
      echo "$dir"
      return
    fi
  done
  echo "Postgres command line tools not found. Set PG_BIN to their bin directory." >&2
  exit 1
}

PG_BIN="$(find_pg_bin)"

admin() { "$PG_BIN/psql" -q -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$PORT" -U "$DB_USER" "$@"; }

read_only() {
  PGOPTIONS='-c default_transaction_read_only=on -c statement_timeout=60000' \
    "$PG_BIN/psql" -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$PORT" -U "$DB_USER" -d "$DB" "$@"
}

exists() {
  [ "$(admin -d postgres -Atc "SELECT 1 FROM pg_database WHERE datname = '$DB'")" = "1" ]
}

need_snapshot() {
  "$ROOT/infra/redesign/db.sh" start >/dev/null
  if ! exists; then
    echo "No snapshot. Run: infra/redesign/audit/snapshot.sh restore <backup.dump>" >&2
    exit 1
  fi
}

restore() {
  local dump="${1:-}"
  if [ -z "$dump" ] || [ ! -f "$dump" ]; then
    echo "Usage: infra/redesign/audit/snapshot.sh restore <backup.dump>" >&2
    exit 1
  fi
  "$ROOT/infra/redesign/db.sh" start >/dev/null
  admin -d postgres -c "DROP DATABASE IF EXISTS $DB"
  "$PG_BIN/createdb" -h 127.0.0.1 -p "$PORT" -U "$DB_USER" "$DB"
  admin -d "$DB" <<'SQL'
CREATE SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
SQL
  admin -d postgres -c "ALTER DATABASE $DB SET search_path = public, extensions"

  mkdir -p "$OUT"
  local list
  list="$(mktemp)"
  "$PG_BIN/pg_restore" -l "$dump" |
    grep -vE ' (POLICY|ACL|ROW SECURITY|PUBLICATION|EVENT TRIGGER) ' |
    grep -vE " TABLE DATA public ($SECRET_TABLES) " >"$list"
  # Errors are collected, not fatal: a few objects refer to hosted-only roles.
  "$PG_BIN/pg_restore" --schema=public --no-owner --no-privileges -L "$list" \
    -h 127.0.0.1 -p "$PORT" -U "$DB_USER" -d "$DB" "$dump" 2>"$OUT/restore-errors.log" || true
  rm -f "$list"

  echo "Restored into $DB:"
  read_only -Atc "SELECT count(*) FROM pg_stat_user_tables WHERE schemaname = 'public'" |
    sed 's/^/  tables: /'
  read_only -Atc "SELECT 'conferences: ' || count(*) FROM conferences"
  read_only -Atc "SELECT 'organizations: ' || count(*) FROM organizations"
  echo "Restore messages: $(grep -c 'error:' "$OUT/restore-errors.log" || true) errors, see $OUT/restore-errors.log"
}

run() {
  local file="${1:-}"
  if [ -z "$file" ] || [ ! -f "$file" ]; then
    echo "Usage: infra/redesign/audit/snapshot.sh run <query.sql>" >&2
    exit 1
  fi
  need_snapshot
  mkdir -p "$OUT"
  local target
  target="$OUT/$(basename "${file%.sql}").txt"
  read_only -f "$file" >"$target"
  echo "Wrote $target"
}

drop() {
  "$ROOT/infra/redesign/db.sh" start >/dev/null
  admin -d postgres -c "DROP DATABASE IF EXISTS $DB"
  rm -rf "$OUT"
  echo "Dropped $DB and removed $OUT"
}

case "${1:-}" in
  restore) restore "${2:-}" ;;
  run) run "${2:-}" ;;
  psql)
    need_snapshot
    shift
    read_only "$@"
    ;;
  drop) drop ;;
  *)
    sed -n '2,15p' "$0"
    exit 1
    ;;
esac
