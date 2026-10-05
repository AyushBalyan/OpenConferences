-- pg-boss creates this schema on first process start. Migration
-- 20260723130000_stage2_rls_roles_and_policies grants USAGE on it
-- unconditionally, so a fresh database (CI, new environment) fails with
-- SQLSTATE 3F000 until the schema exists.
-- No-op when the schema is already present (production).
CREATE SCHEMA IF NOT EXISTS pgboss;
