-- Outreach delivery states, Resend webhook replay protection, and webhook-path RLS.

ALTER TYPE "OutreachRecipientStatus" ADD VALUE IF NOT EXISTS 'BOUNCED';
ALTER TYPE "OutreachRecipientStatus" ADD VALUE IF NOT EXISTS 'COMPLAINED';
ALTER TYPE "OutreachRecipientStatus" ADD VALUE IF NOT EXISTS 'SUPPRESSED';

ALTER TABLE "outreach_recipients" ADD COLUMN "deliveredAt" TIMESTAMP(3);

CREATE INDEX "outreach_recipients_providerMessageId_idx" ON "outreach_recipients"("providerMessageId");

CREATE TABLE "outreach_webhook_events" (
    "id" UUID NOT NULL,
    "svixId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "emailId" TEXT,
    "recipientId" UUID,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outreach_webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "outreach_webhook_events_svixId_key" ON "outreach_webhook_events"("svixId");
CREATE INDEX "outreach_webhook_events_emailId_idx" ON "outreach_webhook_events"("emailId");

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'openconferences_api') THEN
    GRANT SELECT, INSERT ON TABLE public.outreach_webhook_events TO openconferences_api;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'openconferences_worker') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.outreach_webhook_events TO openconferences_worker;
  END IF;
END $$;

ALTER TABLE public.outreach_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_webhook_events FORCE ROW LEVEL SECURITY;

-- Replay log is not tenant-scoped; Nest remains the auth boundary for the signed webhook.
CREATE POLICY outreach_webhook_events_api_insert ON public.outreach_webhook_events
  FOR INSERT TO openconferences_api WITH CHECK (true);
CREATE POLICY outreach_webhook_events_api_select ON public.outreach_webhook_events
  FOR SELECT TO openconferences_api USING (true);
CREATE POLICY outreach_webhook_events_worker_all ON public.outreach_webhook_events
  FOR ALL TO openconferences_worker USING (true) WITH CHECK (true);

-- Outreach Resend webhooks have no session user; Nest remains the auth boundary.
CREATE POLICY outreach_recipients_api_webhook_select ON public.outreach_recipients
  FOR SELECT TO openconferences_api
  USING (public.app_current_user_id() IS NULL);
CREATE POLICY outreach_recipients_api_webhook_update ON public.outreach_recipients
  FOR UPDATE TO openconferences_api
  USING (public.app_current_user_id() IS NULL)
  WITH CHECK (public.app_current_user_id() IS NULL);

CREATE POLICY outreach_campaigns_api_webhook_select ON public.outreach_campaigns
  FOR SELECT TO openconferences_api
  USING (public.app_current_user_id() IS NULL);
CREATE POLICY outreach_campaigns_api_webhook_update ON public.outreach_campaigns
  FOR UPDATE TO openconferences_api
  USING (public.app_current_user_id() IS NULL)
  WITH CHECK (public.app_current_user_id() IS NULL);
