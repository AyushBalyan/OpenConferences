-- AlterTable
ALTER TABLE "conferences" ADD COLUMN     "invitationLifetimeDays" INTEGER NOT NULL DEFAULT 7;

-- AlterTable
ALTER TABLE "reviewer_invitations" ADD COLUMN     "acceptedAt" TIMESTAMP(3),
ADD COLUMN     "affiliation" TEXT,
ADD COLUMN     "declineReasonEncrypted" TEXT,
ADD COLUMN     "declinedAt" TIMESTAMP(3),
ADD COLUMN     "displayName" TEXT,
ADD COLUMN     "externalReference" TEXT,
ADD COLUMN     "reissuedAt" TIMESTAMP(3),
ADD COLUMN     "researchFields" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "revokedAt" TIMESTAMP(3),
ADD COLUMN     "sentAt" TIMESTAMP(3),
ADD COLUMN     "tokenCiphertext" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "reviewer_assignments" ADD COLUMN     "releaseReason" TEXT,
ADD COLUMN     "releasedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "reviewer_invitation_changes" (
    "sequence" BIGSERIAL NOT NULL,
    "organizationId" UUID NOT NULL,
    "conferenceId" UUID NOT NULL,
    "invitationId" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviewer_invitation_changes_pkey" PRIMARY KEY ("sequence")
);

-- CreateTable
CREATE TABLE "reviewer_invitation_batches" (
    "id" UUID NOT NULL,
    "integrationId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "conferenceId" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "inputEncrypted" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "total" INTEGER NOT NULL,
    "processed" INTEGER NOT NULL DEFAULT 0,
    "results" JSONB NOT NULL DEFAULT '[]',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reviewer_invitation_batches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reviewer_invitation_changes_conferenceId_sequence_idx" ON "reviewer_invitation_changes"("conferenceId", "sequence");

-- CreateIndex
CREATE INDEX "reviewer_invitation_batches_status_updatedAt_idx" ON "reviewer_invitation_batches"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "reviewer_invitation_batches_conferenceId_id_idx" ON "reviewer_invitation_batches"("conferenceId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "reviewer_invitation_batches_integrationId_requestId_key" ON "reviewer_invitation_batches"("integrationId", "requestId");

-- CreateIndex
CREATE INDEX "reviewer_invitations_conferenceId_updatedAt_id_idx" ON "reviewer_invitations"("conferenceId", "updatedAt", "id");

-- AddForeignKey
ALTER TABLE "reviewer_invitation_changes" ADD CONSTRAINT "reviewer_invitation_changes_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "reviewer_invitations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviewer_invitation_changes" ADD CONSTRAINT "reviewer_invitation_changes_conferenceId_fkey" FOREIGN KEY ("conferenceId") REFERENCES "conferences"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviewer_invitation_changes" ADD CONSTRAINT "reviewer_invitation_changes_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviewer_invitation_batches" ADD CONSTRAINT "reviewer_invitation_batches_integrationId_conferenceId_org_fkey" FOREIGN KEY ("integrationId", "conferenceId", "organizationId") REFERENCES "api_integrations"("id", "conferenceId", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviewer_invitation_batches" ADD CONSTRAINT "reviewer_invitation_batches_conferenceId_fkey" FOREIGN KEY ("conferenceId") REFERENCES "conferences"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviewer_invitation_batches" ADD CONSTRAINT "reviewer_invitation_batches_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- These resources are conference-scoped. Public actions are validated by a
-- purpose-bound token in the API before its transaction context is established.
ALTER TABLE public.reviewer_invitation_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviewer_invitation_changes FORCE ROW LEVEL SECURITY;
ALTER TABLE public.reviewer_invitation_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviewer_invitation_batches FORCE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.reviewer_invitation_changes TO openconferences_api, openconferences_worker;
GRANT SELECT, INSERT, UPDATE ON public.reviewer_invitation_batches TO openconferences_api, openconferences_worker;
GRANT USAGE, SELECT ON SEQUENCE public.reviewer_invitation_changes_sequence_seq TO openconferences_api, openconferences_worker;
CREATE POLICY invitation_changes_api ON public.reviewer_invitation_changes FOR ALL TO openconferences_api
 USING (public.app_conference_context_matches("conferenceId") AND public.app_user_in_conference("conferenceId"))
 WITH CHECK (public.app_conference_context_matches("conferenceId"));
CREATE POLICY invitation_changes_worker ON public.reviewer_invitation_changes FOR ALL TO openconferences_worker USING (true) WITH CHECK (true);
CREATE POLICY invitation_batches_api ON public.reviewer_invitation_batches FOR ALL TO openconferences_api
 USING (public.app_conference_context_matches("conferenceId") AND public.app_user_in_conference("conferenceId"))
 WITH CHECK (public.app_conference_context_matches("conferenceId") AND public.app_user_in_conference("conferenceId"));
CREATE POLICY invitation_batches_worker ON public.reviewer_invitation_batches FOR ALL TO openconferences_worker USING (true) WITH CHECK (true);
-- Only the worker's approved batch processor writes invitations. It has no
-- access to authentication credentials; every batch revalidates its authorizer.
CREATE POLICY reviewer_invitations_worker_insert ON public.reviewer_invitations FOR INSERT TO openconferences_worker WITH CHECK (public.app_conference_context_matches("conferenceId"));
CREATE POLICY reviewer_invitations_worker_update ON public.reviewer_invitations FOR UPDATE TO openconferences_worker USING (public.app_conference_context_matches("conferenceId")) WITH CHECK (public.app_conference_context_matches("conferenceId"));
ALTER TABLE public.conferences ADD CONSTRAINT invitation_lifetime_range CHECK ("invitationLifetimeDays" BETWEEN 1 AND 30);
-- No sent/opened/accepted timestamps are invented for historical invitations.

ALTER TABLE public.reviewer_invitations ADD COLUMN "conferenceName" TEXT;
UPDATE public.reviewer_invitations i SET "conferenceName"=c.name FROM public.conferences c WHERE i."conferenceId"=c.id;
