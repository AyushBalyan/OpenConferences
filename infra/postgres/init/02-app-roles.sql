-- Local/dev role bootstrap (also safe on empty managed DBs before stage-2 migration).
-- Production passwords are set by infra/postgres/scripts/provision-app-roles.sh

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'openconferences_api') THEN
    CREATE ROLE openconferences_api LOGIN PASSWORD 'openconferences' NOINHERIT NOBYPASSRLS NOSUPERUSER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'openconferences_worker') THEN
    CREATE ROLE openconferences_worker LOGIN PASSWORD 'openconferences' NOINHERIT NOBYPASSRLS NOSUPERUSER;
  END IF;
END $$;

GRANT CONNECT ON DATABASE openconferences TO openconferences_api, openconferences_worker;
GRANT USAGE ON SCHEMA public TO openconferences_api, openconferences_worker;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'openconferences') THEN
    GRANT openconferences_api TO openconferences;
    GRANT openconferences_worker TO openconferences;
  END IF;
END $$;
