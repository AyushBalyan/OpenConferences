#!/usr/bin/env bash
# Local Postgres for the redesign branch.
#
# It never reads an environment file and only ever talks to
# 127.0.0.1:55433/openconferences_redesign, so it cannot reach the production
# database configured in the root .env of the main checkout. The server listens
# on loopback only and keeps its data outside the repository.
#
#   infra/redesign/db.sh start     # start (creates the database on first run)
#   infra/redesign/db.sh stop
#   infra/redesign/db.sh status
#   infra/redesign/db.sh migrate   # apply Prisma migrations
#   infra/redesign/db.sh seed      # add the invented organisation and conference
#   infra/redesign/db.sh psql      # open a psql shell on the database
#   infra/redesign/db.sh url       # print the database URL
#
# Needs the Postgres 16 or 17 command line tools. They are found through
# PG_BIN, then pg_config, then the usual Homebrew and Debian locations.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DATA_DIR="${OPENCONFERENCES_REDESIGN_PGDATA:-$HOME/.openconferences/redesign-postgres}"
PORT=55433
DB=openconferences_redesign
DB_USER=openconferences
URL="postgresql://${DB_USER}@127.0.0.1:${PORT}/${DB}"
export LANG=C LC_ALL=C

find_pg_bin() {
  if [ -n "${PG_BIN:-}" ]; then
    echo "$PG_BIN"
    return
  fi
  local dir
  if command -v pg_config >/dev/null 2>&1; then
    dir="$(pg_config --bindir)"
    if [ -x "$dir/initdb" ]; then
      echo "$dir"
      return
    fi
  fi
  for dir in \
    /opt/homebrew/opt/postgresql@17/bin /opt/homebrew/opt/postgresql@16/bin \
    /usr/local/opt/postgresql@17/bin /usr/local/opt/postgresql@16/bin \
    /usr/lib/postgresql/17/bin /usr/lib/postgresql/16/bin; do
    if [ -x "$dir/initdb" ]; then
      echo "$dir"
      return
    fi
  done
  echo "Postgres command line tools not found. Install Postgres 16 or 17" >&2
  echo "(for example: brew install postgresql@17) or set PG_BIN to its bin directory." >&2
  exit 1
}

PG_BIN="$(find_pg_bin)"

psql_local() { "$PG_BIN/psql" -q -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$PORT" -U "$DB_USER" "$@"; }

running() { "$PG_BIN/pg_ctl" -D "$DATA_DIR" status >/dev/null 2>&1; }

database_exists() {
  [ "$(psql_local -d postgres -Atc "SELECT 1 FROM pg_database WHERE datname = '$DB'")" = "1" ]
}

start() {
  if [ ! -f "$DATA_DIR/PG_VERSION" ]; then
    mkdir -p "$(dirname "$DATA_DIR")"
    "$PG_BIN/initdb" -D "$DATA_DIR" -U "$DB_USER" --auth=trust --locale=C -E UTF8 >/dev/null
  fi
  if ! running; then
    # TCP on loopback only; no Unix socket (long paths break it on macOS).
    "$PG_BIN/pg_ctl" -D "$DATA_DIR" -l "$DATA_DIR/server.log" -w \
      -o "-p $PORT -c unix_socket_directories='' -c listen_addresses=127.0.0.1" start >/dev/null
  fi
  if ! database_exists; then
    "$PG_BIN/createdb" -h 127.0.0.1 -p "$PORT" -U "$DB_USER" "$DB"
    psql_local -d "$DB" -f "$ROOT/infra/postgres/init/01-extensions.sql"
    # The init script names the main database; grant on this one instead.
    sed "s/DATABASE openconferences /DATABASE $DB /" "$ROOT/infra/postgres/init/02-app-roles.sql" |
      psql_local -d "$DB"
    echo "Created database $DB"
  fi
  echo "Redesign database running at $URL"
}

# Run a package script with DATABASE_URL fixed to the redesign database,
# whatever the calling shell has exported.
with_redesign_url() {
  (
    cd "$ROOT"
    export DATABASE_URL="$URL"
    unset DIRECT_URL
    "$@"
  )
}

case "${1:-}" in
  start) start ;;
  stop) running && "$PG_BIN/pg_ctl" -D "$DATA_DIR" -m fast stop || echo "Not running" ;;
  status) running && echo "Running at $URL" || echo "Stopped" ;;
  migrate)
    start
    with_redesign_url pnpm --filter @openconferences/db migrate:deploy
    ;;
  seed)
    start
    with_redesign_url pnpm --filter @openconferences/db seed:redesign
    ;;
  psql)
    start >/dev/null
    shift
    "$PG_BIN/psql" -h 127.0.0.1 -p "$PORT" -U "$DB_USER" -d "$DB" "$@"
    ;;
  url) echo "$URL" ;;
  *)
    sed -n '2,19p' "$0"
    exit 1
    ;;
esac
