-- Extend the explicit scope allow-list without changing any existing grants or keys.
DO $$
DECLARE c record;
BEGIN
  FOR c IN SELECT conrelid::regclass AS tbl, conname FROM pg_constraint
    WHERE conrelid IN ('public.api_integrations'::regclass, 'public.api_integration_keys'::regclass)
      AND contype='c' AND pg_get_constraintdef(oid) LIKE '%scopes%'
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', c.tbl, c.conname);
  END LOOP;
END $$;
ALTER TABLE public.api_integrations ADD CONSTRAINT api_integrations_scopes_allowed CHECK (
  cardinality(scopes)>0 AND scopes <@ ARRAY['papers:read','authors:read','authors:contacts:read','reviewers:read','reviewers:identity:read','reviewers:contacts:read','assignments:read','assignments:write','analytics:read']::text[]);
ALTER TABLE public.api_integration_keys ADD CONSTRAINT api_integration_keys_scopes_allowed CHECK (
  cardinality(scopes)>0 AND scopes <@ ARRAY['papers:read','authors:read','authors:contacts:read','reviewers:read','reviewers:identity:read','reviewers:contacts:read','assignments:read','assignments:write','analytics:read']::text[]
  AND "secretHash" ~ '^[a-f0-9]{64}$' AND "expiresAt">"createdAt");

-- Durable idempotency results contain only the public bot assignment response, never credentials or PII.
CREATE TABLE public.api_integration_mutations (
  id uuid PRIMARY KEY,
  "integrationId" uuid NOT NULL,
  "organizationId" uuid NOT NULL,
  "conferenceId" uuid NOT NULL,
  "requestId" uuid NOT NULL,
  "payloadHash" char(64) NOT NULL CHECK ("payloadHash" ~ '^[a-f0-9]{64}$'),
  response jsonb NOT NULL CHECK (jsonb_typeof(response)='object'),
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT api_integration_mutations_integration_fkey FOREIGN KEY ("integrationId","conferenceId","organizationId")
    REFERENCES public.api_integrations(id,"conferenceId","organizationId") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "api_integration_mutations_integrationId_requestId_key" ON public.api_integration_mutations("integrationId","requestId");
CREATE INDEX "api_integration_mutations_conferenceId_idx" ON public.api_integration_mutations("conferenceId");
ALTER TABLE public.api_integration_mutations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_integration_mutations FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.api_integration_mutations FROM PUBLIC, openconferences_api, openconferences_worker;
DO $$
DECLARE role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
      EXECUTE format('REVOKE ALL ON public.api_integration_mutations FROM %I', role_name);
    END IF;
  END LOOP;
END $$;
GRANT SELECT, INSERT ON public.api_integration_mutations TO openconferences_api;
CREATE POLICY integration_mutation_read ON public.api_integration_mutations FOR SELECT TO openconferences_api
  USING(public.app_integration_manager("organizationId","conferenceId"));
CREATE POLICY integration_mutation_insert ON public.api_integration_mutations FOR INSERT TO openconferences_api
  WITH CHECK(public.app_integration_manager("organizationId","conferenceId"));
