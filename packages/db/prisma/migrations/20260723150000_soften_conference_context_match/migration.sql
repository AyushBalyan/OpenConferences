-- Soft-bind conference route context: when set it must match the row; when absent,
-- membership predicates alone apply (needed for cross-conference dashboard/list reads).
-- Mismatched route conferenceId still fail-closes (IDOR backstop).

CREATE OR REPLACE FUNCTION public.app_conference_context_matches(conf_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT public.app_current_conference_id() IS NULL
    OR public.app_current_conference_id() = conf_id::text;
$$;

REVOKE ALL ON FUNCTION public.app_conference_context_matches(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_conference_context_matches(uuid) TO openconferences_api, openconferences_worker;
