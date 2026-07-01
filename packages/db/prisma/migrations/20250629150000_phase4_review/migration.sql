-- CreateEnum
CREATE TYPE "BidValue" AS ENUM ('EAGER', 'YES', 'MAYBE', 'NO', 'CONFLICT');

-- CreateEnum
CREATE TYPE "CoiType" AS ENUM ('CO_AUTHOR', 'INSTITUTION', 'ADVISOR_STUDENT', 'PERSONAL', 'FINANCIAL', 'OTHER');

-- CreateEnum
CREATE TYPE "CoiSource" AS ENUM ('SELF', 'CHAIR', 'SYSTEM');

-- CreateEnum
CREATE TYPE "RoundStatus" AS ENUM ('OPEN', 'REVIEWING', 'REBUTTAL', 'DECIDING', 'CLOSED');

-- CreateEnum
CREATE TYPE "ReviewVisibility" AS ENUM ('HIDDEN', 'AUTHOR_VISIBLE', 'PUBLIC');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('ASSIGNED', 'ACCEPTED', 'DECLINED', 'COMPLETED');

-- CreateTable
CREATE TABLE "review_rounds" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "conferenceId" UUID NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "status" "RoundStatus" NOT NULL DEFAULT 'OPEN',
    "reviewDueAt" TIMESTAMP(3),
    "rebuttalDueAt" TIMESTAMP(3),
    "revisionDueAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_rounds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviewer_invitations" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "conferenceId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "invitedUserId" UUID,
    "token" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "roleNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reviewer_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bids" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "conferenceId" UUID NOT NULL,
    "paperId" UUID NOT NULL,
    "reviewerUserId" UUID NOT NULL,
    "value" "BidValue" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bids_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conflicts_of_interest" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "conferenceId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "paperId" UUID,
    "withUserId" UUID,
    "type" "CoiType" NOT NULL,
    "source" "CoiSource" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conflicts_of_interest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviewer_assignments" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "conferenceId" UUID NOT NULL,
    "roundId" UUID NOT NULL,
    "paperId" UUID NOT NULL,
    "reviewerUserId" UUID NOT NULL,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'ASSIGNED',
    "dueAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reviewer_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "review_rounds_conferenceId_roundNumber_key" ON "review_rounds"("conferenceId", "roundNumber");

-- CreateIndex
CREATE INDEX "review_rounds_conferenceId_status_idx" ON "review_rounds"("conferenceId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "reviewer_invitations_token_key" ON "reviewer_invitations"("token");

-- CreateIndex
CREATE INDEX "reviewer_invitations_conferenceId_email_idx" ON "reviewer_invitations"("conferenceId", "email");

-- CreateIndex
CREATE INDEX "reviewer_invitations_conferenceId_status_idx" ON "reviewer_invitations"("conferenceId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "bids_paperId_reviewerUserId_key" ON "bids"("paperId", "reviewerUserId");

-- CreateIndex
CREATE INDEX "bids_conferenceId_reviewerUserId_idx" ON "bids"("conferenceId", "reviewerUserId");

-- CreateIndex
CREATE INDEX "conflicts_of_interest_conferenceId_userId_idx" ON "conflicts_of_interest"("conferenceId", "userId");

-- CreateIndex
CREATE INDEX "conflicts_of_interest_paperId_idx" ON "conflicts_of_interest"("paperId");

-- CreateIndex
CREATE UNIQUE INDEX "reviewer_assignments_roundId_paperId_reviewerUserId_key" ON "reviewer_assignments"("roundId", "paperId", "reviewerUserId");

-- CreateIndex
CREATE INDEX "reviewer_assignments_conferenceId_reviewerUserId_idx" ON "reviewer_assignments"("conferenceId", "reviewerUserId");

-- CreateIndex
CREATE INDEX "reviewer_assignments_roundId_idx" ON "reviewer_assignments"("roundId");

-- AddForeignKey
ALTER TABLE "review_rounds" ADD CONSTRAINT "review_rounds_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "review_rounds" ADD CONSTRAINT "review_rounds_conferenceId_fkey" FOREIGN KEY ("conferenceId") REFERENCES "conferences"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "reviewer_invitations" ADD CONSTRAINT "reviewer_invitations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "reviewer_invitations" ADD CONSTRAINT "reviewer_invitations_conferenceId_fkey" FOREIGN KEY ("conferenceId") REFERENCES "conferences"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "reviewer_invitations" ADD CONSTRAINT "reviewer_invitations_invitedUserId_fkey" FOREIGN KEY ("invitedUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "bids" ADD CONSTRAINT "bids_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "bids" ADD CONSTRAINT "bids_conferenceId_fkey" FOREIGN KEY ("conferenceId") REFERENCES "conferences"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "bids" ADD CONSTRAINT "bids_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "papers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "bids" ADD CONSTRAINT "bids_reviewerUserId_fkey" FOREIGN KEY ("reviewerUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "conflicts_of_interest" ADD CONSTRAINT "conflicts_of_interest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "conflicts_of_interest" ADD CONSTRAINT "conflicts_of_interest_conferenceId_fkey" FOREIGN KEY ("conferenceId") REFERENCES "conferences"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "conflicts_of_interest" ADD CONSTRAINT "conflicts_of_interest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "conflicts_of_interest" ADD CONSTRAINT "conflicts_of_interest_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "papers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "conflicts_of_interest" ADD CONSTRAINT "conflicts_of_interest_withUserId_fkey" FOREIGN KEY ("withUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "reviewer_assignments" ADD CONSTRAINT "reviewer_assignments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "reviewer_assignments" ADD CONSTRAINT "reviewer_assignments_conferenceId_fkey" FOREIGN KEY ("conferenceId") REFERENCES "conferences"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "reviewer_assignments" ADD CONSTRAINT "reviewer_assignments_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "review_rounds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "reviewer_assignments" ADD CONSTRAINT "reviewer_assignments_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "papers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "reviewer_assignments" ADD CONSTRAINT "reviewer_assignments_reviewerUserId_fkey" FOREIGN KEY ("reviewerUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- =============================================================================
-- Row-Level Security for review tables
-- =============================================================================

-- review_rounds
ALTER TABLE "review_rounds" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "review_rounds" FORCE ROW LEVEL SECURITY;

CREATE POLICY "review_rounds_select" ON "review_rounds"
  FOR SELECT USING (app_user_in_conference("conferenceId"));

CREATE POLICY "review_rounds_insert" ON "review_rounds"
  FOR INSERT WITH CHECK (app_user_in_conference("conferenceId") OR app_rls_bypass());

CREATE POLICY "review_rounds_update" ON "review_rounds"
  FOR UPDATE USING (app_user_in_conference("conferenceId") OR app_rls_bypass());

CREATE POLICY "review_rounds_delete" ON "review_rounds"
  FOR DELETE USING (app_user_in_conference("conferenceId") OR app_rls_bypass());

-- reviewer_invitations
ALTER TABLE "reviewer_invitations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "reviewer_invitations" FORCE ROW LEVEL SECURITY;

CREATE POLICY "reviewer_invitations_select" ON "reviewer_invitations"
  FOR SELECT USING (app_user_in_conference("conferenceId") OR app_rls_bypass());

CREATE POLICY "reviewer_invitations_insert" ON "reviewer_invitations"
  FOR INSERT WITH CHECK (app_user_in_conference("conferenceId") OR app_rls_bypass());

CREATE POLICY "reviewer_invitations_update" ON "reviewer_invitations"
  FOR UPDATE USING (app_user_in_conference("conferenceId") OR app_rls_bypass());

-- bids
ALTER TABLE "bids" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bids" FORCE ROW LEVEL SECURITY;

CREATE POLICY "bids_select" ON "bids"
  FOR SELECT USING (app_user_in_conference("conferenceId"));

CREATE POLICY "bids_insert" ON "bids"
  FOR INSERT WITH CHECK (app_user_in_conference("conferenceId") OR app_rls_bypass());

CREATE POLICY "bids_update" ON "bids"
  FOR UPDATE USING (app_user_in_conference("conferenceId") OR app_rls_bypass());

CREATE POLICY "bids_delete" ON "bids"
  FOR DELETE USING (app_user_in_conference("conferenceId") OR app_rls_bypass());

-- conflicts_of_interest
ALTER TABLE "conflicts_of_interest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "conflicts_of_interest" FORCE ROW LEVEL SECURITY;

CREATE POLICY "conflicts_of_interest_select" ON "conflicts_of_interest"
  FOR SELECT USING (app_user_in_conference("conferenceId"));

CREATE POLICY "conflicts_of_interest_insert" ON "conflicts_of_interest"
  FOR INSERT WITH CHECK (app_user_in_conference("conferenceId") OR app_rls_bypass());

CREATE POLICY "conflicts_of_interest_update" ON "conflicts_of_interest"
  FOR UPDATE USING (app_user_in_conference("conferenceId") OR app_rls_bypass());

CREATE POLICY "conflicts_of_interest_delete" ON "conflicts_of_interest"
  FOR DELETE USING (app_user_in_conference("conferenceId") OR app_rls_bypass());

-- reviewer_assignments
ALTER TABLE "reviewer_assignments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "reviewer_assignments" FORCE ROW LEVEL SECURITY;

CREATE POLICY "reviewer_assignments_select" ON "reviewer_assignments"
  FOR SELECT USING (app_user_in_conference("conferenceId"));

CREATE POLICY "reviewer_assignments_insert" ON "reviewer_assignments"
  FOR INSERT WITH CHECK (app_user_in_conference("conferenceId") OR app_rls_bypass());

CREATE POLICY "reviewer_assignments_update" ON "reviewer_assignments"
  FOR UPDATE USING (app_user_in_conference("conferenceId") OR app_rls_bypass());

CREATE POLICY "reviewer_assignments_delete" ON "reviewer_assignments"
  FOR DELETE USING (app_user_in_conference("conferenceId") OR app_rls_bypass());
