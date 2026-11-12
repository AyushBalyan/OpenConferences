-- Credential bootstrap has no human user context. The permissive manager
-- policies still run alongside the key-id/digest lookup policies. Avoid the
-- nested membership/role RLS scans when human authorization cannot succeed.
-- CASE guarantees the membership branch is not evaluated in that case.
CREATE OR REPLACE FUNCTION public.app_integration_manager(org_id uuid, conf_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT CASE WHEN public.app_current_user_id() IS NULL THEN false ELSE
    public.app_conference_context_matches(conf_id)
    AND public.app_org_context_matches(org_id)
    AND EXISTS (
      SELECT 1 FROM public.memberships m
      JOIN public.role_grants r ON r."membershipId" = m.id
      WHERE m."userId"::text = public.app_current_user_id()
        AND (
          (m.scope = 'CONFERENCE' AND m."conferenceId" = conf_id)
          OR (m.scope = 'ORGANIZATION' AND m."organizationId" = org_id)
        )
        AND r.role IN ('CHAIR', 'ORGANIZER', 'ORG_ADMIN')
    )
  END;
$$;

-- Retain the existing restricted execution privileges. No RLS bypass is added.
REVOKE ALL ON FUNCTION public.app_integration_manager(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_integration_manager(uuid, uuid) TO openconferences_api;
