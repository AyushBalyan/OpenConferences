CREATE TABLE public.invoice_daily_counters (
  "organizationId" UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  "conferenceId" UUID NOT NULL REFERENCES public.conferences(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  "issueDate" VARCHAR(8) NOT NULL CHECK ("issueDate" ~ '^[0-9]{8}$'),
  "lastNumber" BIGINT NOT NULL DEFAULT 0 CHECK ("lastNumber" BETWEEN 0 AND 9999),
  PRIMARY KEY ("conferenceId", "issueDate")
);

ALTER TABLE public.invoice_daily_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_daily_counters FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.invoice_daily_counters FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON public.invoice_daily_counters TO openconferences_api, openconferences_worker;

-- Issuance is internal to captured-payment invoice generation. Bind to its tenant
-- context, like the existing shared invoice counter, without a session-user requirement.
CREATE POLICY invoice_daily_counters_runtime ON public.invoice_daily_counters
  FOR ALL TO openconferences_api, openconferences_worker
  USING (public.app_org_context_matches("organizationId") AND public.app_conference_context_matches("conferenceId"))
  WITH CHECK (public.app_org_context_matches("organizationId") AND public.app_conference_context_matches("conferenceId"));
