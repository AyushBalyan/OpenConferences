-- Batches are new in this release and have no deployed rows to backfill.
ALTER TABLE public.reviewer_invitation_batches ADD COLUMN "keyId" UUID NOT NULL;
GRANT SELECT ON public.api_integrations TO openconferences_worker;
GRANT SELECT (id,"integrationId","conferenceId","organizationId",scopes,"expiresAt","revokedAt") ON public.api_integration_keys TO openconferences_worker;
CREATE POLICY invitation_batch_grant_read ON public.api_integrations FOR SELECT TO openconferences_worker
 USING (EXISTS (SELECT 1 FROM public.reviewer_invitation_batches b WHERE b."integrationId"=api_integrations.id));
CREATE POLICY invitation_batch_key_read ON public.api_integration_keys FOR SELECT TO openconferences_worker
 USING (EXISTS (SELECT 1 FROM public.reviewer_invitation_batches b WHERE b."keyId"=api_integration_keys.id));

-- Provision the pg-boss partition using the deployment owner, never by granting
-- runtime workers schema-owner privileges.
DO $$ DECLARE queue_partition text; BEGIN
 IF to_regprocedure('pgboss.create_queue(text,json)') IS NULL THEN RETURN; END IF;
 PERFORM pgboss.create_queue('reviewer.invitation_batch','{}'::json);
 SELECT partition_name INTO queue_partition FROM pgboss.queue WHERE name='reviewer.invitation_batch';
 IF queue_partition IS NOT NULL THEN
  EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE pgboss.%I TO openconferences_api,openconferences_worker',queue_partition);
 END IF;
END $$;
