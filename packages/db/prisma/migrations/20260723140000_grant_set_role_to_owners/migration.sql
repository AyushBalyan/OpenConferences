-- Allow migration owners to SET LOCAL ROLE for diagnostics/integration tests.
-- Does not grant BYPASSRLS; app roles remain NOBYPASSRLS.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgres')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'openconferences_api') THEN
    GRANT openconferences_api TO postgres;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgres')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'openconferences_worker') THEN
    GRANT openconferences_worker TO postgres;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'openconferences')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'openconferences_api') THEN
    GRANT openconferences_api TO openconferences;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'openconferences')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'openconferences_worker') THEN
    GRANT openconferences_worker TO openconferences;
  END IF;
END $$;
