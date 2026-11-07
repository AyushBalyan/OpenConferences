-- Public-schema default grants also apply to newly created tables. Restrict
-- transition history to append-only and keep operational jobs undeletable.
REVOKE UPDATE, DELETE ON public.reviewer_invitation_changes FROM openconferences_api,openconferences_worker;
REVOKE DELETE ON public.reviewer_invitation_batches FROM openconferences_api,openconferences_worker;
