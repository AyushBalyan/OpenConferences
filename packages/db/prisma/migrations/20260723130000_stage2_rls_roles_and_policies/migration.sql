-- Stage 2: Restricted API/worker roles, org-inherited conference helpers, role-targeted policies.
-- Removes reliance on app.bypass_rls GUC. Owner (postgres/openconferences) may still BYPASSRLS
-- for migrations/seed; production API/worker must use NOBYPASSRLS roles.

-- =============================================================================
-- Application roles (passwords set by provisioning script; never stored in migrations)
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'openconferences_api') THEN
    CREATE ROLE openconferences_api NOINHERIT NOBYPASSRLS NOSUPERUSER NOCREATEDB NOCREATEROLE;
  ELSE
    ALTER ROLE openconferences_api NOBYPASSRLS NOSUPERUSER;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'openconferences_worker') THEN
    CREATE ROLE openconferences_worker NOINHERIT NOBYPASSRLS NOSUPERUSER NOCREATEDB NOCREATEROLE;
  ELSE
    ALTER ROLE openconferences_worker NOBYPASSRLS NOSUPERUSER;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO openconferences_api, openconferences_worker;
GRANT USAGE ON SCHEMA pgboss TO openconferences_api, openconferences_worker;

-- Table grants
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
  LOOP
    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO openconferences_api',
      r.table_name
    );
    -- Worker needs broad DML on domain + notification tables; deny auth secrets later via RLS
    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO openconferences_worker',
      r.table_name
    );
  END LOOP;

  -- Worker must not touch Better Auth secrets or Prisma history
  REVOKE ALL ON TABLE public.accounts FROM openconferences_worker;
  REVOKE ALL ON TABLE public.sessions FROM openconferences_worker;
  REVOKE ALL ON TABLE public.verifications FROM openconferences_worker;
  REVOKE ALL ON TABLE public.two_factors FROM openconferences_worker;
  REVOKE ALL ON TABLE public._prisma_migrations FROM openconferences_api, openconferences_worker;
  -- users: worker needs email for reminders
  GRANT SELECT ON TABLE public.users TO openconferences_worker;
END $$;

-- Sequences
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.relname AS seq_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'S'
  LOOP
    EXECUTE format(
      'GRANT USAGE, SELECT ON SEQUENCE public.%I TO openconferences_api, openconferences_worker',
      r.seq_name
    );
  END LOOP;
END $$;

-- Default privileges for future tables created by common owners
DO $$
DECLARE
  owner_role text;
BEGIN
  FOREACH owner_role IN ARRAY ARRAY['postgres', 'openconferences']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = owner_role) THEN
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO openconferences_api',
        owner_role
      );
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO openconferences_worker',
        owner_role
      );
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO openconferences_api, openconferences_worker',
        owner_role
      );
    END IF;
  END LOOP;
END $$;

-- pgboss grants (if schema exists)
DO $$
DECLARE
  r record;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'pgboss') THEN
    FOR r IN
      SELECT c.relname AS table_name
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'pgboss' AND c.relkind IN ('r', 'p')
    LOOP
      EXECUTE format(
        'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE pgboss.%I TO openconferences_api, openconferences_worker',
        r.table_name
      );
    END LOOP;
  END IF;
END $$;

-- =============================================================================
-- Helper functions: membership + org inheritance + platform admin (no bypass GUC)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.app_current_user_id()
RETURNS text
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT NULLIF(current_setting('app.current_user_id', true), '');
$$;

CREATE OR REPLACE FUNCTION public.app_current_org_id()
RETURNS text
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT NULLIF(current_setting('app.current_org_id', true), '');
$$;

CREATE OR REPLACE FUNCTION public.app_current_conference_id()
RETURNS text
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT NULLIF(current_setting('app.current_conference_id', true), '');
$$;

-- Soft bind: when route org context is set, row org must match (fail closed on mismatch).
CREATE OR REPLACE FUNCTION public.app_org_context_matches(org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT public.app_current_org_id() IS NULL
    OR public.app_current_org_id() = org_id::text;
$$;

-- Hard bind for conference-scoped tables: conference route context required and must match.
CREATE OR REPLACE FUNCTION public.app_conference_context_matches(conf_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT public.app_current_conference_id() IS NOT NULL
    AND public.app_current_conference_id() = conf_id::text;
$$;

CREATE OR REPLACE FUNCTION public.app_is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.memberships m
    JOIN public.role_grants rg ON rg."membershipId" = m.id
    WHERE m."userId"::text = public.app_current_user_id()
      AND rg.role = 'PLATFORM_ADMIN'::public."RoleKind"
  );
$$;

CREATE OR REPLACE FUNCTION public.app_user_in_org(org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.app_is_platform_admin() OR EXISTS (
    SELECT 1
    FROM public.memberships m
    WHERE m."userId"::text = public.app_current_user_id()
      AND m."organizationId" = org_id
  );
$$;

CREATE OR REPLACE FUNCTION public.app_user_in_conference(conf_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.app_is_platform_admin()
    OR EXISTS (
      SELECT 1
      FROM public.memberships m
      WHERE m."userId"::text = public.app_current_user_id()
        AND m."conferenceId" = conf_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.memberships m
      JOIN public.conferences c ON c.id = conf_id
      WHERE m."userId"::text = public.app_current_user_id()
        AND m.scope = 'ORGANIZATION'::public."MembershipScope"
        AND m."organizationId" = c."organizationId"
    );
$$;

-- Keep app_rls_bypass as no-op false for any leftover references during rollout
CREATE OR REPLACE FUNCTION public.app_rls_bypass()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT false;
$$;

REVOKE ALL ON FUNCTION public.app_current_user_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_current_org_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_current_conference_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_org_context_matches(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_conference_context_matches(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_is_platform_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_rls_bypass() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_user_in_org(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_user_in_conference(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.app_current_user_id() TO openconferences_api, openconferences_worker;
GRANT EXECUTE ON FUNCTION public.app_current_org_id() TO openconferences_api, openconferences_worker;
GRANT EXECUTE ON FUNCTION public.app_current_conference_id() TO openconferences_api, openconferences_worker;
GRANT EXECUTE ON FUNCTION public.app_org_context_matches(uuid) TO openconferences_api, openconferences_worker;
GRANT EXECUTE ON FUNCTION public.app_conference_context_matches(uuid) TO openconferences_api, openconferences_worker;
GRANT EXECUTE ON FUNCTION public.app_is_platform_admin() TO openconferences_api, openconferences_worker;
GRANT EXECUTE ON FUNCTION public.app_rls_bypass() TO openconferences_api, openconferences_worker;
GRANT EXECUTE ON FUNCTION public.app_user_in_org(uuid) TO openconferences_api, openconferences_worker;
GRANT EXECUTE ON FUNCTION public.app_user_in_conference(uuid) TO openconferences_api, openconferences_worker;

-- =============================================================================
-- Drop existing PUBLIC policies so we can recreate role-targeted ones
-- =============================================================================

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- =============================================================================
-- FORCE RLS on all public application tables
-- =============================================================================

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'organizations','conferences','tracks','memberships','role_grants',
    'papers','file_assets','paper_versions','authorships',
    'review_rounds','reviewer_invitations','bids','conflicts_of_interest','reviewer_assignments',
    'reviews','rebuttals','decisions',
    'registrations','payments','invoices','student_verifications','invoice_counters',
    'users','accounts','sessions','verifications','two_factors',
    'audit_logs','notification_templates','notification_logs','email_suppressions',
    '_prisma_migrations'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- =============================================================================
-- Better Auth tables — API full access (pre-auth flows); no worker access via grants
-- =============================================================================

CREATE POLICY users_api_all ON public.users
  FOR ALL TO openconferences_api USING (true) WITH CHECK (true);
CREATE POLICY users_worker_select ON public.users
  FOR SELECT TO openconferences_worker USING (true);

CREATE POLICY accounts_api_all ON public.accounts
  FOR ALL TO openconferences_api USING (true) WITH CHECK (true);
CREATE POLICY sessions_api_all ON public.sessions
  FOR ALL TO openconferences_api USING (true) WITH CHECK (true);
CREATE POLICY verifications_api_all ON public.verifications
  FOR ALL TO openconferences_api USING (true) WITH CHECK (true);
CREATE POLICY two_factors_api_all ON public.two_factors
  FOR ALL TO openconferences_api USING (true) WITH CHECK (true);

-- =============================================================================
-- Internal / system tables
-- =============================================================================

CREATE POLICY audit_logs_api_insert ON public.audit_logs
  FOR INSERT TO openconferences_api WITH CHECK (true);
CREATE POLICY audit_logs_api_select ON public.audit_logs
  FOR SELECT TO openconferences_api
  USING (
    public.app_is_platform_admin()
    OR ("organizationId" IS NOT NULL AND public.app_user_in_org("organizationId"))
    OR ("conferenceId" IS NOT NULL AND public.app_user_in_conference("conferenceId"))
  );
CREATE POLICY audit_logs_worker_insert ON public.audit_logs
  FOR INSERT TO openconferences_worker WITH CHECK (true);

CREATE POLICY email_suppressions_api_all ON public.email_suppressions
  FOR ALL TO openconferences_api USING (true) WITH CHECK (true);
CREATE POLICY email_suppressions_worker_all ON public.email_suppressions
  FOR ALL TO openconferences_worker USING (true) WITH CHECK (true);

CREATE POLICY invoice_counters_api_all ON public.invoice_counters
  FOR ALL TO openconferences_api USING (true) WITH CHECK (true);
CREATE POLICY invoice_counters_worker_all ON public.invoice_counters
  FOR ALL TO openconferences_worker USING (true) WITH CHECK (true);

CREATE POLICY notification_templates_api_all ON public.notification_templates
  FOR ALL TO openconferences_api USING (true) WITH CHECK (true);
CREATE POLICY notification_templates_worker_select ON public.notification_templates
  FOR SELECT TO openconferences_worker USING (true);

CREATE POLICY notification_logs_api_all ON public.notification_logs
  FOR ALL TO openconferences_api USING (true) WITH CHECK (true);
CREATE POLICY notification_logs_worker_all ON public.notification_logs
  FOR ALL TO openconferences_worker USING (true) WITH CHECK (true);

-- _prisma_migrations: no policies for app roles → denied under FORCE RLS

-- =============================================================================
-- Tenancy
-- =============================================================================

CREATE POLICY organizations_api_select ON public.organizations
  FOR SELECT TO openconferences_api
  USING (public.app_user_in_org(id) AND public.app_org_context_matches(id));
CREATE POLICY organizations_api_insert ON public.organizations
  FOR INSERT TO openconferences_api
  WITH CHECK (public.app_current_user_id() IS NOT NULL AND public.app_org_context_matches(id));
CREATE POLICY organizations_api_update ON public.organizations
  FOR UPDATE TO openconferences_api
  USING (public.app_user_in_org(id) AND public.app_org_context_matches(id))
  WITH CHECK (public.app_user_in_org(id) AND public.app_org_context_matches(id));
CREATE POLICY organizations_api_delete ON public.organizations
  FOR DELETE TO openconferences_api USING (public.app_is_platform_admin());
CREATE POLICY organizations_worker_select ON public.organizations
  FOR SELECT TO openconferences_worker USING (true);

CREATE POLICY conferences_api_select ON public.conferences
  FOR SELECT TO openconferences_api
  USING (
    public.app_user_in_org("organizationId")
    AND public.app_org_context_matches("organizationId")
  );
CREATE POLICY conferences_api_insert ON public.conferences
  FOR INSERT TO openconferences_api
  WITH CHECK (
    public.app_user_in_org("organizationId")
    AND public.app_org_context_matches("organizationId")
  );
CREATE POLICY conferences_api_update ON public.conferences
  FOR UPDATE TO openconferences_api
  USING (
    public.app_user_in_org("organizationId")
    AND public.app_org_context_matches("organizationId")
  )
  WITH CHECK (
    public.app_user_in_org("organizationId")
    AND public.app_org_context_matches("organizationId")
  );
CREATE POLICY conferences_api_delete ON public.conferences
  FOR DELETE TO openconferences_api USING (public.app_is_platform_admin());
CREATE POLICY conferences_worker_all ON public.conferences
  FOR ALL TO openconferences_worker USING (true) WITH CHECK (true);

CREATE POLICY tracks_api_select ON public.tracks
  FOR SELECT TO openconferences_api
  USING (
    public.app_conference_context_matches("conferenceId")
    AND public.app_user_in_conference("conferenceId")
    AND public.app_org_context_matches("organizationId")
  );
CREATE POLICY tracks_api_insert ON public.tracks
  FOR INSERT TO openconferences_api
  WITH CHECK (
    public.app_conference_context_matches("conferenceId")
    AND public.app_user_in_conference("conferenceId")
    AND public.app_org_context_matches("organizationId")
  );
CREATE POLICY tracks_api_update ON public.tracks
  FOR UPDATE TO openconferences_api
  USING (
    public.app_conference_context_matches("conferenceId")
    AND public.app_user_in_conference("conferenceId")
    AND public.app_org_context_matches("organizationId")
  )
  WITH CHECK (
    public.app_conference_context_matches("conferenceId")
    AND public.app_user_in_conference("conferenceId")
    AND public.app_org_context_matches("organizationId")
  );
CREATE POLICY tracks_api_delete ON public.tracks
  FOR DELETE TO openconferences_api
  USING (
    public.app_conference_context_matches("conferenceId")
    AND public.app_user_in_conference("conferenceId")
  );
CREATE POLICY tracks_worker_select ON public.tracks
  FOR SELECT TO openconferences_worker USING (true);

CREATE POLICY memberships_api_select ON public.memberships
  FOR SELECT TO openconferences_api
  USING (
    public.app_is_platform_admin()
    OR "userId"::text = public.app_current_user_id()
    OR public.app_user_in_org("organizationId")
  );
CREATE POLICY memberships_api_insert ON public.memberships
  FOR INSERT TO openconferences_api
  WITH CHECK (
    public.app_is_platform_admin()
    OR public.app_user_in_org("organizationId")
    OR "userId"::text = public.app_current_user_id()
  );
CREATE POLICY memberships_api_update ON public.memberships
  FOR UPDATE TO openconferences_api
  USING (public.app_user_in_org("organizationId") OR public.app_is_platform_admin())
  WITH CHECK (public.app_user_in_org("organizationId") OR public.app_is_platform_admin());
CREATE POLICY memberships_api_delete ON public.memberships
  FOR DELETE TO openconferences_api
  USING (public.app_user_in_org("organizationId") OR public.app_is_platform_admin());
CREATE POLICY memberships_worker_select ON public.memberships
  FOR SELECT TO openconferences_worker USING (true);

CREATE POLICY role_grants_api_select ON public.role_grants
  FOR SELECT TO openconferences_api
  USING (
    public.app_is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.id = "membershipId"
        AND (
          m."userId"::text = public.app_current_user_id()
          OR public.app_user_in_org(m."organizationId")
        )
    )
  );
CREATE POLICY role_grants_api_insert ON public.role_grants
  FOR INSERT TO openconferences_api
  WITH CHECK (
    public.app_is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.id = "membershipId" AND public.app_user_in_org(m."organizationId")
    )
  );
CREATE POLICY role_grants_api_delete ON public.role_grants
  FOR DELETE TO openconferences_api
  USING (
    public.app_is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.id = "membershipId" AND public.app_user_in_org(m."organizationId")
    )
  );
CREATE POLICY role_grants_worker_select ON public.role_grants
  FOR SELECT TO openconferences_worker USING (true);

-- =============================================================================
-- Submission
-- =============================================================================

CREATE POLICY papers_api_select ON public.papers
  FOR SELECT TO openconferences_api
  USING (
    public.app_conference_context_matches("conferenceId")
    AND public.app_user_in_conference("conferenceId")
    AND public.app_org_context_matches("organizationId")
  );
CREATE POLICY papers_api_insert ON public.papers
  FOR INSERT TO openconferences_api
  WITH CHECK (
    public.app_conference_context_matches("conferenceId")
    AND public.app_user_in_conference("conferenceId")
    AND public.app_org_context_matches("organizationId")
  );
CREATE POLICY papers_api_update ON public.papers
  FOR UPDATE TO openconferences_api
  USING (
    public.app_conference_context_matches("conferenceId")
    AND public.app_user_in_conference("conferenceId")
    AND public.app_org_context_matches("organizationId")
  )
  WITH CHECK (
    public.app_conference_context_matches("conferenceId")
    AND public.app_user_in_conference("conferenceId")
    AND public.app_org_context_matches("organizationId")
  );
CREATE POLICY papers_api_delete ON public.papers
  FOR DELETE TO openconferences_api
  USING (
    public.app_conference_context_matches("conferenceId")
    AND public.app_user_in_conference("conferenceId")
  );
CREATE POLICY papers_worker_all ON public.papers
  FOR ALL TO openconferences_worker USING (true) WITH CHECK (true);

CREATE POLICY file_assets_api_select ON public.file_assets
  FOR SELECT TO openconferences_api
  USING (
    public.app_user_in_org("organizationId")
    AND public.app_org_context_matches("organizationId")
  );
CREATE POLICY file_assets_api_insert ON public.file_assets
  FOR INSERT TO openconferences_api
  WITH CHECK (
    public.app_user_in_org("organizationId")
    AND public.app_org_context_matches("organizationId")
  );
CREATE POLICY file_assets_api_update ON public.file_assets
  FOR UPDATE TO openconferences_api
  USING (
    public.app_user_in_org("organizationId")
    AND public.app_org_context_matches("organizationId")
  )
  WITH CHECK (
    public.app_user_in_org("organizationId")
    AND public.app_org_context_matches("organizationId")
  );
CREATE POLICY file_assets_api_delete ON public.file_assets
  FOR DELETE TO openconferences_api
  USING (
    public.app_user_in_org("organizationId")
    AND public.app_org_context_matches("organizationId")
  );
CREATE POLICY file_assets_worker_all ON public.file_assets
  FOR ALL TO openconferences_worker USING (true) WITH CHECK (true);

CREATE POLICY paper_versions_api_select ON public.paper_versions
  FOR SELECT TO openconferences_api
  USING (
    EXISTS (
      SELECT 1 FROM public.papers p
      WHERE p.id = "paperId"
        AND public.app_conference_context_matches(p."conferenceId")
        AND public.app_user_in_conference(p."conferenceId")
        AND public.app_org_context_matches(p."organizationId")
    )
  );
CREATE POLICY paper_versions_api_insert ON public.paper_versions
  FOR INSERT TO openconferences_api
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.papers p
      WHERE p.id = "paperId"
        AND public.app_conference_context_matches(p."conferenceId")
        AND public.app_user_in_conference(p."conferenceId")
        AND public.app_org_context_matches(p."organizationId")
    )
  );
CREATE POLICY paper_versions_api_update ON public.paper_versions
  FOR UPDATE TO openconferences_api
  USING (
    EXISTS (
      SELECT 1 FROM public.papers p
      WHERE p.id = "paperId"
        AND public.app_conference_context_matches(p."conferenceId")
        AND public.app_user_in_conference(p."conferenceId")
        AND public.app_org_context_matches(p."organizationId")
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.papers p
      WHERE p.id = "paperId"
        AND public.app_conference_context_matches(p."conferenceId")
        AND public.app_user_in_conference(p."conferenceId")
        AND public.app_org_context_matches(p."organizationId")
    )
  );
CREATE POLICY paper_versions_worker_all ON public.paper_versions
  FOR ALL TO openconferences_worker USING (true) WITH CHECK (true);

CREATE POLICY authorships_api_select ON public.authorships
  FOR SELECT TO openconferences_api
  USING (
    EXISTS (
      SELECT 1 FROM public.papers p
      WHERE p.id = "paperId"
        AND public.app_conference_context_matches(p."conferenceId")
        AND public.app_user_in_conference(p."conferenceId")
        AND public.app_org_context_matches(p."organizationId")
    )
  );
CREATE POLICY authorships_api_insert ON public.authorships
  FOR INSERT TO openconferences_api
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.papers p
      WHERE p.id = "paperId"
        AND public.app_conference_context_matches(p."conferenceId")
        AND public.app_user_in_conference(p."conferenceId")
        AND public.app_org_context_matches(p."organizationId")
    )
  );
CREATE POLICY authorships_api_update ON public.authorships
  FOR UPDATE TO openconferences_api
  USING (
    EXISTS (
      SELECT 1 FROM public.papers p
      WHERE p.id = "paperId"
        AND public.app_conference_context_matches(p."conferenceId")
        AND public.app_user_in_conference(p."conferenceId")
        AND public.app_org_context_matches(p."organizationId")
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.papers p
      WHERE p.id = "paperId"
        AND public.app_conference_context_matches(p."conferenceId")
        AND public.app_user_in_conference(p."conferenceId")
        AND public.app_org_context_matches(p."organizationId")
    )
  );
CREATE POLICY authorships_api_delete ON public.authorships
  FOR DELETE TO openconferences_api
  USING (
    EXISTS (
      SELECT 1 FROM public.papers p
      WHERE p.id = "paperId"
        AND public.app_conference_context_matches(p."conferenceId")
        AND public.app_user_in_conference(p."conferenceId")
    )
  );
CREATE POLICY authorships_worker_select ON public.authorships
  FOR SELECT TO openconferences_worker USING (true);

-- =============================================================================
-- Review workflow
-- =============================================================================

CREATE POLICY review_rounds_api_all ON public.review_rounds
  FOR ALL TO openconferences_api
  USING (
    public.app_conference_context_matches("conferenceId")
    AND public.app_user_in_conference("conferenceId")
  )
  WITH CHECK (
    public.app_conference_context_matches("conferenceId")
    AND public.app_user_in_conference("conferenceId")
  );
CREATE POLICY review_rounds_worker_select ON public.review_rounds
  FOR SELECT TO openconferences_worker USING (true);

-- Invitations: token/email flows need API access without prior conference membership
CREATE POLICY reviewer_invitations_api_all ON public.reviewer_invitations
  FOR ALL TO openconferences_api USING (true) WITH CHECK (true);
CREATE POLICY reviewer_invitations_worker_select ON public.reviewer_invitations
  FOR SELECT TO openconferences_worker USING (true);

CREATE POLICY bids_api_all ON public.bids
  FOR ALL TO openconferences_api
  USING (
    public.app_conference_context_matches("conferenceId")
    AND public.app_user_in_conference("conferenceId")
  )
  WITH CHECK (
    public.app_conference_context_matches("conferenceId")
    AND public.app_user_in_conference("conferenceId")
  );
CREATE POLICY bids_worker_select ON public.bids
  FOR SELECT TO openconferences_worker USING (true);

CREATE POLICY conflicts_of_interest_api_all ON public.conflicts_of_interest
  FOR ALL TO openconferences_api
  USING (
    public.app_conference_context_matches("conferenceId")
    AND public.app_user_in_conference("conferenceId")
  )
  WITH CHECK (
    public.app_conference_context_matches("conferenceId")
    AND public.app_user_in_conference("conferenceId")
  );
CREATE POLICY conflicts_of_interest_worker_select ON public.conflicts_of_interest
  FOR SELECT TO openconferences_worker USING (true);

CREATE POLICY reviewer_assignments_api_all ON public.reviewer_assignments
  FOR ALL TO openconferences_api
  USING (
    public.app_conference_context_matches("conferenceId")
    AND public.app_user_in_conference("conferenceId")
  )
  WITH CHECK (
    public.app_conference_context_matches("conferenceId")
    AND public.app_user_in_conference("conferenceId")
  );
CREATE POLICY reviewer_assignments_worker_all ON public.reviewer_assignments
  FOR ALL TO openconferences_worker USING (true) WITH CHECK (true);

CREATE POLICY reviews_api_all ON public.reviews
  FOR ALL TO openconferences_api
  USING (
    public.app_conference_context_matches("conferenceId")
    AND public.app_user_in_conference("conferenceId")
  )
  WITH CHECK (
    public.app_conference_context_matches("conferenceId")
    AND public.app_user_in_conference("conferenceId")
  );
CREATE POLICY reviews_worker_select ON public.reviews
  FOR SELECT TO openconferences_worker USING (true);

CREATE POLICY rebuttals_api_all ON public.rebuttals
  FOR ALL TO openconferences_api
  USING (
    public.app_conference_context_matches("conferenceId")
    AND public.app_user_in_conference("conferenceId")
  )
  WITH CHECK (
    public.app_conference_context_matches("conferenceId")
    AND public.app_user_in_conference("conferenceId")
  );
CREATE POLICY rebuttals_worker_select ON public.rebuttals
  FOR SELECT TO openconferences_worker USING (true);

CREATE POLICY decisions_api_all ON public.decisions
  FOR ALL TO openconferences_api
  USING (
    public.app_conference_context_matches("conferenceId")
    AND public.app_user_in_conference("conferenceId")
  )
  WITH CHECK (
    public.app_conference_context_matches("conferenceId")
    AND public.app_user_in_conference("conferenceId")
  );
CREATE POLICY decisions_worker_select ON public.decisions
  FOR SELECT TO openconferences_worker USING (true);

-- =============================================================================
-- Billing
-- =============================================================================

-- Billing writes include Razorpay webhooks with no session user; Nest remains the auth boundary.
CREATE POLICY registrations_api_all ON public.registrations
  FOR ALL TO openconferences_api USING (true) WITH CHECK (true);
CREATE POLICY registrations_worker_all ON public.registrations
  FOR ALL TO openconferences_worker USING (true) WITH CHECK (true);

CREATE POLICY payments_api_all ON public.payments
  FOR ALL TO openconferences_api USING (true) WITH CHECK (true);
CREATE POLICY payments_worker_all ON public.payments
  FOR ALL TO openconferences_worker USING (true) WITH CHECK (true);

CREATE POLICY invoices_api_all ON public.invoices
  FOR ALL TO openconferences_api
  USING (
    public.app_user_in_org("organizationId")
    AND public.app_org_context_matches("organizationId")
  )
  WITH CHECK (
    public.app_user_in_org("organizationId")
    AND public.app_org_context_matches("organizationId")
  );
CREATE POLICY invoices_worker_all ON public.invoices
  FOR ALL TO openconferences_worker USING (true) WITH CHECK (true);

CREATE POLICY student_verifications_api_all ON public.student_verifications
  FOR ALL TO openconferences_api
  USING (
    public.app_user_in_org("organizationId")
    AND public.app_org_context_matches("organizationId")
  )
  WITH CHECK (
    public.app_user_in_org("organizationId")
    AND public.app_org_context_matches("organizationId")
  );
CREATE POLICY student_verifications_worker_select ON public.student_verifications
  FOR SELECT TO openconferences_worker USING (true);
