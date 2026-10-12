-- CreateTable
CREATE TABLE "api_integrations" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "conferenceId" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "purpose" VARCHAR(500),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "scopes" TEXT[],
    "authorizedByUserId" UUID NOT NULL,
    "createdByUserId" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokedByUserId" UUID,

    CONSTRAINT "api_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_integration_keys" (
    "id" UUID NOT NULL,
    "integrationId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "conferenceId" UUID NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "secretHash" CHAR(64) NOT NULL,
    "scopes" TEXT[],
    "createdByUserId" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokedByUserId" UUID,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "api_integration_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_integration_access_logs" (
    "id" UUID NOT NULL,
    "integrationId" UUID NOT NULL,
    "keyId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "conferenceId" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "route" VARCHAR(150) NOT NULL,
    "method" VARCHAR(8) NOT NULL,
    "status" INTEGER NOT NULL,
    "resultCount" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_integration_access_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_integration_reviewer_references" (
    "id" UUID NOT NULL,
    "integrationId" UUID NOT NULL,
    "conferenceId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "reviewerUserId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_integration_reviewer_references_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "api_integrations_conferenceId_createdAt_id_idx" ON "api_integrations"("conferenceId", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "api_integrations_id_conferenceId_organizationId_key" ON "api_integrations"("id", "conferenceId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "api_integration_keys_secretHash_key" ON "api_integration_keys"("secretHash");

-- CreateIndex
CREATE INDEX "api_integration_keys_integrationId_expiresAt_revokedAt_idx" ON "api_integration_keys"("integrationId", "expiresAt", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "api_integration_keys_integrationId_requestId_key" ON "api_integration_keys"("integrationId", "requestId");

-- CreateIndex
CREATE UNIQUE INDEX "api_integration_keys_id_integrationId_conferenceId_organiza_key" ON "api_integration_keys"("id", "integrationId", "conferenceId", "organizationId");

-- CreateIndex
CREATE INDEX "api_integration_access_logs_conferenceId_observedAt_id_idx" ON "api_integration_access_logs"("conferenceId", "observedAt", "id");

-- CreateIndex
CREATE INDEX "api_integration_access_logs_integrationId_observedAt_id_idx" ON "api_integration_access_logs"("integrationId", "observedAt", "id");

-- CreateIndex
CREATE INDEX "api_integration_reviewer_references_conferenceId_idx" ON "api_integration_reviewer_references"("conferenceId");

-- CreateIndex
CREATE UNIQUE INDEX "api_integration_reviewer_references_integrationId_reviewerU_key" ON "api_integration_reviewer_references"("integrationId", "reviewerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "conferences_id_organizationId_key" ON "conferences"("id", "organizationId");

-- AddForeignKey
ALTER TABLE "api_integrations" ADD CONSTRAINT "api_integrations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_integrations" ADD CONSTRAINT "api_integrations_conferenceId_organizationId_fkey" FOREIGN KEY ("conferenceId", "organizationId") REFERENCES "conferences"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_integrations" ADD CONSTRAINT "api_integrations_authorizedByUserId_fkey" FOREIGN KEY ("authorizedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_integrations" ADD CONSTRAINT "api_integrations_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_integration_keys" ADD CONSTRAINT "api_integration_keys_integrationId_conferenceId_organizati_fkey" FOREIGN KEY ("integrationId", "conferenceId", "organizationId") REFERENCES "api_integrations"("id", "conferenceId", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_integration_access_logs" ADD CONSTRAINT "api_integration_access_logs_keyId_integrationId_conference_fkey" FOREIGN KEY ("keyId", "integrationId", "conferenceId", "organizationId") REFERENCES "api_integration_keys"("id", "integrationId", "conferenceId", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_integration_reviewer_references" ADD CONSTRAINT "api_integration_reviewer_references_integrationId_conferen_fkey" FOREIGN KEY ("integrationId", "conferenceId", "organizationId") REFERENCES "api_integrations"("id", "conferenceId", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_integration_reviewer_references" ADD CONSTRAINT "api_integration_reviewer_references_reviewerUserId_fkey" FOREIGN KEY ("reviewerUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Credential lookup is scoped by a server-derived public ID + high-entropy digest.
-- This never changes policies on existing business tables and never bypasses RLS.
CREATE FUNCTION public.app_integration_manager(org_id uuid, conf_id uuid) RETURNS boolean
LANGUAGE sql STABLE SET search_path = '' AS $$
 SELECT public.app_conference_context_matches(conf_id) AND public.app_org_context_matches(org_id)
 AND EXISTS (SELECT 1 FROM public.memberships m JOIN public.role_grants r ON r."membershipId"=m.id
 WHERE m."userId"::text=public.app_current_user_id()
 AND ((m.scope='CONFERENCE' AND m."conferenceId"=conf_id) OR (m.scope='ORGANIZATION' AND m."organizationId"=org_id))
 AND r.role IN ('CHAIR','ORGANIZER','ORG_ADMIN'));
$$;
REVOKE ALL ON FUNCTION public.app_integration_manager(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_integration_manager(uuid,uuid) TO openconferences_api;
ALTER TABLE api_integrations ADD CHECK (status IN ('ACTIVE','SUSPENDED','REVOKED'));
ALTER TABLE api_integrations ALTER COLUMN scopes SET NOT NULL;
ALTER TABLE api_integration_keys ALTER COLUMN scopes SET NOT NULL;
ALTER TABLE api_integrations ADD CHECK (cardinality(scopes)>0 AND scopes <@ ARRAY['papers:read','authors:read','authors:contacts:read','reviewers:read','reviewers:identity:read','reviewers:contacts:read','assignments:read','analytics:read']::text[]);
ALTER TABLE api_integration_keys ADD CHECK (cardinality(scopes)>0 AND scopes <@ ARRAY['papers:read','authors:read','authors:contacts:read','reviewers:read','reviewers:identity:read','reviewers:contacts:read','assignments:read','analytics:read']::text[] AND "secretHash" ~ '^[a-f0-9]{64}$' AND "expiresAt">"createdAt");
ALTER TABLE api_integration_access_logs ADD CHECK (status BETWEEN 100 AND 599 AND "resultCount">=0 AND "durationMs">=0);
ALTER TABLE api_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_integrations FORCE ROW LEVEL SECURITY;
ALTER TABLE api_integration_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_integration_keys FORCE ROW LEVEL SECURITY;
ALTER TABLE api_integration_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_integration_access_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE api_integration_reviewer_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_integration_reviewer_references FORCE ROW LEVEL SECURITY;
REVOKE ALL ON api_integrations,api_integration_keys,api_integration_access_logs,api_integration_reviewer_references FROM PUBLIC,openconferences_worker;
REVOKE ALL ON api_integrations,api_integration_keys,api_integration_access_logs,api_integration_reviewer_references FROM openconferences_api;
GRANT SELECT,INSERT,UPDATE ON api_integrations,api_integration_keys TO openconferences_api;
GRANT SELECT,INSERT ON api_integration_access_logs TO openconferences_api;
GRANT SELECT,INSERT ON api_integration_reviewer_references TO openconferences_api;
GRANT SELECT,DELETE ON api_integration_access_logs TO openconferences_worker;
CREATE POLICY integration_manage ON api_integrations FOR ALL TO openconferences_api
 USING(public.app_integration_manager("organizationId","conferenceId")) WITH CHECK(public.app_integration_manager("organizationId","conferenceId"));
CREATE POLICY integration_key_manage ON api_integration_keys FOR ALL TO openconferences_api
 USING(public.app_integration_manager("organizationId","conferenceId")) WITH CHECK(public.app_integration_manager("organizationId","conferenceId"));
CREATE POLICY integration_key_lookup ON api_integration_keys FOR SELECT TO openconferences_api USING (
 id::text=nullif(current_setting('app.integration_key_id',true),'') AND "secretHash"=nullif(current_setting('app.integration_key_hash',true),''));
CREATE POLICY integration_lookup ON api_integrations FOR SELECT TO openconferences_api USING (
 EXISTS(SELECT 1 FROM public.api_integration_keys k WHERE k."integrationId"=api_integrations.id
 AND k.id::text=nullif(current_setting('app.integration_key_id',true),'') AND k."secretHash"=nullif(current_setting('app.integration_key_hash',true),'')));
CREATE POLICY integration_log_read ON api_integration_access_logs FOR SELECT TO openconferences_api USING(public.app_integration_manager("organizationId","conferenceId"));
CREATE POLICY integration_log_insert ON api_integration_access_logs FOR INSERT TO openconferences_api WITH CHECK(public.app_integration_manager("organizationId","conferenceId"));
CREATE POLICY integration_ref_read ON api_integration_reviewer_references FOR SELECT TO openconferences_api USING(public.app_integration_manager("organizationId","conferenceId"));
CREATE POLICY integration_ref_insert ON api_integration_reviewer_references FOR INSERT TO openconferences_api WITH CHECK(public.app_integration_manager("organizationId","conferenceId"));
CREATE POLICY integration_log_retention ON api_integration_access_logs FOR SELECT TO openconferences_worker USING("observedAt" < now()-interval '30 days');
CREATE POLICY integration_log_retention_delete ON api_integration_access_logs FOR DELETE TO openconferences_worker USING("observedAt" < now()-interval '30 days');
