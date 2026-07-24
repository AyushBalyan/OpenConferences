#!/usr/bin/env bash
# Provision restricted API/worker DB roles for OpenConferences (stage-2 RLS).
# Run as the migration owner (postgres / openconferences) against the target database.
#
# Required env:
#   DATABASE_URL                 Owner connection (BYPASSRLS / superuser OK)
#   OPENCONFERENCES_API_PASSWORD
#   OPENCONFERENCES_WORKER_PASSWORD
#
# Optional:
#   OPENCONFERENCES_API_ROLE     default openconferences_api
#   OPENCONFERENCES_WORKER_ROLE  default openconferences_worker

set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required" >&2
  exit 1
fi
if [[ -z "${OPENCONFERENCES_API_PASSWORD:-}" ]]; then
  echo "OPENCONFERENCES_API_PASSWORD is required" >&2
  exit 1
fi
if [[ -z "${OPENCONFERENCES_WORKER_PASSWORD:-}" ]]; then
  echo "OPENCONFERENCES_WORKER_PASSWORD is required" >&2
  exit 1
fi

API_ROLE="${OPENCONFERENCES_API_ROLE:-openconferences_api}"
WORKER_ROLE="${OPENCONFERENCES_WORKER_ROLE:-openconferences_worker}"

# Node pg accepts uselibpqcompat; libpq/psql does not — strip it for this script.
PSQL_DATABASE_URL="$(
  printf '%s' "$DATABASE_URL" \
    | sed -E 's/([?&])uselibpqcompat=[^&]*&?/\1/g; s/[?&]$//'
)"

# Escape single quotes for SQL string literals
sql_quote() {
  printf "%s" "$1" | sed "s/'/''/g"
}

API_PASS_SQL="$(sql_quote "$OPENCONFERENCES_API_PASSWORD")"
WORKER_PASS_SQL="$(sql_quote "$OPENCONFERENCES_WORKER_PASSWORD")"

DB_NAME="$(psql "$PSQL_DATABASE_URL" -Atc 'SELECT current_database()')"

psql "$PSQL_DATABASE_URL" -v ON_ERROR_STOP=1 <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${API_ROLE}') THEN
    CREATE ROLE ${API_ROLE} NOINHERIT NOBYPASSRLS NOSUPERUSER NOCREATEDB NOCREATEROLE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${WORKER_ROLE}') THEN
    CREATE ROLE ${WORKER_ROLE} NOINHERIT NOBYPASSRLS NOSUPERUSER NOCREATEDB NOCREATEROLE;
  END IF;
END
\$\$;

-- Enable LOGIN + set passwords only. Do not ALTER SUPERUSER/NOBYPASSRLS:
-- Supabase postgres is not a full superuser and rejects those attribute changes.
-- Roles are already NOBYPASSRLS NOSUPERUSER from stage-2 migration / CREATE above.
ALTER ROLE ${API_ROLE} WITH LOGIN PASSWORD '${API_PASS_SQL}';
ALTER ROLE ${WORKER_ROLE} WITH LOGIN PASSWORD '${WORKER_PASS_SQL}';

GRANT CONNECT ON DATABASE "${DB_NAME}" TO ${API_ROLE}, ${WORKER_ROLE};
GRANT USAGE ON SCHEMA public TO ${API_ROLE}, ${WORKER_ROLE};
GRANT USAGE ON SCHEMA pgboss TO ${API_ROLE}, ${WORKER_ROLE};
-- CREATE required so pg-boss can create queue partition tables
GRANT CREATE ON SCHEMA pgboss TO ${API_ROLE}, ${WORKER_ROLE};

-- Allow owner to SET ROLE for diagnostics/integration tests
DO \$\$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = current_user) THEN
    EXECUTE format('GRANT %I TO %I', '${API_ROLE}', current_user);
    EXECUTE format('GRANT %I TO %I', '${WORKER_ROLE}', current_user);
  END IF;
END
\$\$;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${API_ROLE};
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${WORKER_ROLE};
REVOKE ALL ON TABLE public.accounts FROM ${WORKER_ROLE};
REVOKE ALL ON TABLE public.sessions FROM ${WORKER_ROLE};
REVOKE ALL ON TABLE public.verifications FROM ${WORKER_ROLE};
REVOKE ALL ON TABLE public.two_factors FROM ${WORKER_ROLE};
REVOKE ALL ON TABLE public._prisma_migrations FROM ${API_ROLE}, ${WORKER_ROLE};
GRANT SELECT ON TABLE public.users TO ${WORKER_ROLE};

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${API_ROLE}, ${WORKER_ROLE};

DO \$\$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'pgboss') THEN
    -- pg-boss createQueue() creates partition tables → needs CREATE on schema
    -- FK to pgboss.queue requires REFERENCES (not only DML)
    EXECUTE format('GRANT USAGE, CREATE ON SCHEMA pgboss TO %I, %I', '${API_ROLE}', '${WORKER_ROLE}');
    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA pgboss TO %I, %I',
      '${API_ROLE}', '${WORKER_ROLE}'
    );
    EXECUTE format('GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA pgboss TO %I, %I', '${API_ROLE}', '${WORKER_ROLE}');
    EXECUTE format('GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pgboss TO %I, %I', '${API_ROLE}', '${WORKER_ROLE}');
    EXECUTE format(
      'ALTER DEFAULT PRIVILEGES IN SCHEMA pgboss GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER ON TABLES TO %I, %I',
      '${API_ROLE}', '${WORKER_ROLE}'
    );
    EXECUTE format(
      'ALTER DEFAULT PRIVILEGES IN SCHEMA pgboss GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO %I, %I',
      '${API_ROLE}', '${WORKER_ROLE}'
    );
  END IF;
END
\$\$;

SELECT rolname, rolcanlogin, rolbypassrls, rolsuper
FROM pg_roles
WHERE rolname IN ('${API_ROLE}', '${WORKER_ROLE}')
ORDER BY rolname;
SQL

echo "Provisioned ${API_ROLE} and ${WORKER_ROLE}."
echo "Set Coolify DATABASE_URL for API/worker to the pooler session URL using these roles."
echo "Keep owner DATABASE_URL only for migrate deploy / seed / one-off jobs."
