#!/usr/bin/env bash
# Persistent, disposable LOCAL Postgres for API integration tests.
#
# It never reads .env and only ever talks to 127.0.0.1:55432/release_test, so it
# cannot reach the shared/production database configured in the root .env.
#
#   infra/testing/local-test-db.sh start      # start (creates + migrates on first run)
#   infra/testing/local-test-db.sh stop
#   infra/testing/local-test-db.sh status
#   infra/testing/local-test-db.sh migrate    # apply new Prisma migrations
#   infra/testing/local-test-db.sh env        # print exports for manual use
#   infra/testing/local-test-db.sh test [vitest args...]   # start, migrate, run API tests
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PG_BIN="${PG_BIN:-/opt/homebrew/opt/postgresql@17/bin}"
DATA_DIR="${OPENCONFERENCES_TEST_PGDATA:-$HOME/.openconferences/test-postgres}"
PORT=55432
DB=release_test
MARKER=selective-release-test
URL="postgresql://openconferences@127.0.0.1:${PORT}/${DB}"
export LANG=C LC_ALL=C

psql_local() { "$PG_BIN/psql" -q -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$PORT" -U openconferences "$@"; }

running() { "$PG_BIN/pg_ctl" -D "$DATA_DIR" status >/dev/null 2>&1; }

start() {
  local fresh=0
  if [ ! -f "$DATA_DIR/PG_VERSION" ]; then
    mkdir -p "$(dirname "$DATA_DIR")"
    "$PG_BIN/initdb" -D "$DATA_DIR" -U openconferences --auth=trust --locale=C -E UTF8 >/dev/null
    fresh=1
  fi
  if ! running; then
    # TCP on loopback only; no Unix socket (long paths break it on macOS).
    "$PG_BIN/pg_ctl" -D "$DATA_DIR" -l "$DATA_DIR/server.log" -w \
      -o "-p $PORT -c unix_socket_directories='' -c listen_addresses=127.0.0.1" start >/dev/null
  fi
  if [ "$fresh" = 1 ]; then
    "$PG_BIN/createdb" -h 127.0.0.1 -p "$PORT" -U openconferences "$DB"
    psql_local -d "$DB" -f "$ROOT/infra/postgres/init/01-extensions.sql"
    sed "s/DATABASE openconferences /DATABASE $DB /" "$ROOT/infra/postgres/init/02-app-roles.sql" |
      psql_local -d "$DB"
    psql_local -d "$DB" -c "CREATE SCHEMA local_test; CREATE TABLE local_test.task_marker(id text PRIMARY KEY); INSERT INTO local_test.task_marker VALUES ('$MARKER');"
    migrate
  fi
  echo "Local test DB running at $URL"
}

migrate() {
  (
    cd "$ROOT/packages/db"
    export DATABASE_URL="$URL"
    node -e "import('../../infra/testing/local-test-target.mjs').then(m => m.assertLocalDatabaseUrl(process.env.DATABASE_URL))"
    npx prisma db execute --file prisma/predeploy.sql --schema prisma/schema.prisma >/dev/null
    npx prisma migrate deploy --schema prisma/schema.prisma | grep -E 'Datasource|applied|No pending'
  )
}

print_env() {
  cat <<EOF
export DATABASE_URL='$URL'
export REVIEW_RELEASE_TEST_DATABASE_URL='$URL'
export REDIS_URL='redis://127.0.0.1:6379/15'
export LOCAL_TEST_DATABASE_MARKER='$MARKER'
EOF
}

case "${1:-}" in
  start) start ;;
  stop) running && "$PG_BIN/pg_ctl" -D "$DATA_DIR" -m fast stop || echo "Not running" ;;
  status) running && echo "Running at $URL" || echo "Stopped" ;;
  migrate) running || start; migrate ;;
  env) print_env ;;
  test)
    shift
    running || start
    migrate
    eval "$(print_env)"
    unset DIRECT_URL
    cd "$ROOT/apps/api"
    npx vitest run --config vitest.integration.config.ts "$@"
    ;;
  *)
    sed -n '2,13p' "$0"
    exit 1
    ;;
esac
