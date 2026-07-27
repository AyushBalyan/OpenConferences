-- Capability-token lookup for public author submit links.
-- Normal conferences_api_select requires org membership, which joiners do not have yet.
-- SECURITY DEFINER resolves by authorJoinToken without broadening general SELECT.

CREATE OR REPLACE FUNCTION public.app_resolve_conference_by_author_join_token(p_token uuid)
RETURNS TABLE (
  id uuid,
  "organizationId" uuid,
  name text,
  status public."ConferenceStatus"
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT c.id, c."organizationId", c.name, c.status
  FROM public.conferences c
  WHERE c."authorJoinToken" = p_token
    AND c."deletedAt" IS NULL
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.app_resolve_conference_by_author_join_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_resolve_conference_by_author_join_token(uuid) TO openconferences_api;
