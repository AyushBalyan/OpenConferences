-- Academic Outreach: campaigns, recipients, templates, SES delivery seam

CREATE TYPE "OutreachCampaignType" AS ENUM ('TPC_INVITATION', 'PAPER_SUBMISSION_INVITATION', 'GENERAL_OUTREACH');
CREATE TYPE "OutreachCampaignStatus" AS ENUM ('DRAFT', 'READY', 'SENDING', 'SENT', 'PARTIAL', 'FAILED');
CREATE TYPE "OutreachRecipientStatus" AS ENUM ('PENDING', 'SKIPPED', 'QUEUED', 'SENT', 'FAILED');

CREATE TABLE "outreach_templates" (
    "id" UUID NOT NULL,
    "organizationId" UUID,
    "conferenceId" UUID,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "subject" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "bodyText" TEXT,
    "variables" JSONB NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outreach_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "outreach_campaigns" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "conferenceId" UUID NOT NULL,
    "createdById" UUID NOT NULL,
    "templateId" UUID,
    "name" TEXT NOT NULL,
    "type" "OutreachCampaignType" NOT NULL,
    "status" "OutreachCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "templateKey" TEXT,
    "templateName" TEXT,
    "subject" TEXT,
    "bodyHtml" TEXT,
    "fromName" TEXT,
    "fromEmail" TEXT,
    "replyToEmail" TEXT,
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "confirmedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outreach_campaigns_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "outreach_recipients" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "conferenceId" UUID NOT NULL,
    "campaignId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "paper" TEXT NOT NULL,
    "status" "OutreachRecipientStatus" NOT NULL DEFAULT 'PENDING',
    "providerMessageId" TEXT,
    "error" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outreach_recipients_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "outreach_templates_platform_key_version_key"
  ON "outreach_templates" ("key", "version")
  WHERE "organizationId" IS NULL AND "conferenceId" IS NULL;
CREATE INDEX "outreach_templates_key_isActive_idx" ON "outreach_templates"("key", "isActive");
CREATE INDEX "outreach_templates_conferenceId_key_idx" ON "outreach_templates"("conferenceId", "key");

CREATE INDEX "outreach_campaigns_conferenceId_createdAt_idx" ON "outreach_campaigns"("conferenceId", "createdAt");
CREATE INDEX "outreach_campaigns_conferenceId_status_idx" ON "outreach_campaigns"("conferenceId", "status");

CREATE UNIQUE INDEX "outreach_recipients_campaignId_email_key" ON "outreach_recipients"("campaignId", "email");
CREATE INDEX "outreach_recipients_conferenceId_email_idx" ON "outreach_recipients"("conferenceId", "email");
CREATE INDEX "outreach_recipients_campaignId_status_idx" ON "outreach_recipients"("campaignId", "status");

ALTER TABLE "outreach_templates" ADD CONSTRAINT "outreach_templates_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "outreach_templates" ADD CONSTRAINT "outreach_templates_conferenceId_fkey" FOREIGN KEY ("conferenceId") REFERENCES "conferences"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "outreach_campaigns" ADD CONSTRAINT "outreach_campaigns_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "outreach_campaigns" ADD CONSTRAINT "outreach_campaigns_conferenceId_fkey" FOREIGN KEY ("conferenceId") REFERENCES "conferences"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "outreach_campaigns" ADD CONSTRAINT "outreach_campaigns_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "outreach_campaigns" ADD CONSTRAINT "outreach_campaigns_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "outreach_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "outreach_recipients" ADD CONSTRAINT "outreach_recipients_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "outreach_recipients" ADD CONSTRAINT "outreach_recipients_conferenceId_fkey" FOREIGN KEY ("conferenceId") REFERENCES "conferences"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "outreach_recipients" ADD CONSTRAINT "outreach_recipients_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "outreach_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "outreach_templates" ("id", "organizationId", "conferenceId", "key", "name", "version", "subject", "bodyHtml", "bodyText", "variables", "isActive", "createdAt", "updatedAt") VALUES
(
  'b1000001-0000-4000-8000-000000000001',
  NULL,
  NULL,
  'tpc_invitation',
  'TPC Invitation',
  1,
  'Invitation to join the Technical Program Committee',
  '<p>Dear {{name}},</p>
<p>We are inviting you to join the Technical Program Committee for our conference.</p>
<p>Given your expertise in {{topic}} as shown in your paper {{paper}}, we believe your contribution would be valuable to the conference.</p>
<p>We would be honored to have you serve on the TPC.</p>
<p>Kind regards,<br/>The Organizing Committee</p>',
  'Dear {{name}},

We are inviting you to join the Technical Program Committee for our conference.

Given your expertise in {{topic}} as shown in your paper {{paper}}, we believe your contribution would be valuable to the conference.

Kind regards,
The Organizing Committee',
  '["name","topic","paper"]',
  true,
  NOW(),
  NOW()
),
(
  'b1000001-0000-4000-8000-000000000002',
  NULL,
  NULL,
  'paper_submission_invitation',
  'Paper Submission Invitation',
  1,
  'Invitation to submit a paper',
  '<p>Dear {{name}},</p>
<p>We invite you to submit a paper to our conference.</p>
<p>Given your work in {{topic}}, including {{paper}}, we believe the community would benefit from your contribution.</p>
<p>Kind regards,<br/>The Organizing Committee</p>',
  'Dear {{name}},

We invite you to submit a paper to our conference.

Given your work in {{topic}}, including {{paper}}, we believe the community would benefit from your contribution.

Kind regards,
The Organizing Committee',
  '["name","topic","paper"]',
  true,
  NOW(),
  NOW()
),
(
  'b1000001-0000-4000-8000-000000000003',
  NULL,
  NULL,
  'general_conference_outreach',
  'General Conference Outreach',
  1,
  'Invitation to participate in our conference',
  '<p>Dear {{name}},</p>
<p>We are writing to invite you to participate in our conference.</p>
<p>Your expertise in {{topic}}, as reflected in {{paper}}, would make you a valued participant.</p>
<p>Kind regards,<br/>The Organizing Committee</p>',
  'Dear {{name}},

We are writing to invite you to participate in our conference.

Your expertise in {{topic}}, as reflected in {{paper}}, would make you a valued participant.

Kind regards,
The Organizing Committee',
  '["name","topic","paper"]',
  true,
  NOW(),
  NOW()
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'openconferences_api') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.outreach_templates TO openconferences_api;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.outreach_campaigns TO openconferences_api;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.outreach_recipients TO openconferences_api;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'openconferences_worker') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.outreach_templates TO openconferences_worker;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.outreach_campaigns TO openconferences_worker;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.outreach_recipients TO openconferences_worker;
  END IF;
END $$;

ALTER TABLE public.outreach_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_templates FORCE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_campaigns FORCE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_recipients FORCE ROW LEVEL SECURITY;

CREATE POLICY outreach_templates_api_all ON public.outreach_templates
  FOR ALL TO openconferences_api USING (true) WITH CHECK (true);
CREATE POLICY outreach_templates_worker_select ON public.outreach_templates
  FOR SELECT TO openconferences_worker USING (true);

CREATE POLICY outreach_campaigns_api_select ON public.outreach_campaigns
  FOR SELECT TO openconferences_api
  USING (
    public.app_conference_context_matches("conferenceId")
    AND public.app_user_in_conference("conferenceId")
    AND public.app_org_context_matches("organizationId")
  );
CREATE POLICY outreach_campaigns_api_insert ON public.outreach_campaigns
  FOR INSERT TO openconferences_api
  WITH CHECK (
    public.app_conference_context_matches("conferenceId")
    AND public.app_user_in_conference("conferenceId")
    AND public.app_org_context_matches("organizationId")
  );
CREATE POLICY outreach_campaigns_api_update ON public.outreach_campaigns
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
CREATE POLICY outreach_campaigns_worker_all ON public.outreach_campaigns
  FOR ALL TO openconferences_worker USING (true) WITH CHECK (true);

CREATE POLICY outreach_recipients_api_select ON public.outreach_recipients
  FOR SELECT TO openconferences_api
  USING (
    public.app_conference_context_matches("conferenceId")
    AND public.app_user_in_conference("conferenceId")
    AND public.app_org_context_matches("organizationId")
  );
CREATE POLICY outreach_recipients_api_insert ON public.outreach_recipients
  FOR INSERT TO openconferences_api
  WITH CHECK (
    public.app_conference_context_matches("conferenceId")
    AND public.app_user_in_conference("conferenceId")
    AND public.app_org_context_matches("organizationId")
  );
CREATE POLICY outreach_recipients_api_update ON public.outreach_recipients
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
CREATE POLICY outreach_recipients_api_delete ON public.outreach_recipients
  FOR DELETE TO openconferences_api
  USING (
    public.app_conference_context_matches("conferenceId")
    AND public.app_user_in_conference("conferenceId")
  );
CREATE POLICY outreach_recipients_worker_all ON public.outreach_recipients
  FOR ALL TO openconferences_worker USING (true) WITH CHECK (true);
