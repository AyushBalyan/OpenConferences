-- CreateEnum
CREATE TYPE "Recommendation" AS ENUM ('STRONG_ACCEPT', 'ACCEPT', 'WEAK_ACCEPT', 'BORDERLINE', 'WEAK_REJECT', 'REJECT', 'STRONG_REJECT');

-- CreateTable
CREATE TABLE "reviews" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "conferenceId" UUID NOT NULL,
    "assignmentId" UUID NOT NULL,
    "roundId" UUID NOT NULL,
    "paperId" UUID NOT NULL,
    "reviewerUserId" UUID NOT NULL,
    "scores" JSONB NOT NULL DEFAULT '{}',
    "recommendation" "Recommendation",
    "confidence" INTEGER,
    "commentsToAuthors" TEXT,
    "commentsToChairs" TEXT,
    "visibility" "ReviewVisibility" NOT NULL DEFAULT 'HIDDEN',
    "submittedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rebuttals" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "conferenceId" UUID NOT NULL,
    "paperId" UUID NOT NULL,
    "roundId" UUID NOT NULL,
    "authoredByUserId" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rebuttals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reviews_assignmentId_key" ON "reviews"("assignmentId");

-- CreateIndex
CREATE INDEX "reviews_paperId_idx" ON "reviews"("paperId");

-- CreateIndex
CREATE INDEX "reviews_roundId_idx" ON "reviews"("roundId");

-- CreateIndex
CREATE INDEX "reviews_conferenceId_reviewerUserId_idx" ON "reviews"("conferenceId", "reviewerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "rebuttals_paperId_roundId_key" ON "rebuttals"("paperId", "roundId");

-- CreateIndex
CREATE INDEX "rebuttals_conferenceId_idx" ON "rebuttals"("conferenceId");

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "reviews" ADD CONSTRAINT "reviews_conferenceId_fkey" FOREIGN KEY ("conferenceId") REFERENCES "conferences"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "reviews" ADD CONSTRAINT "reviews_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "reviewer_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "reviews" ADD CONSTRAINT "reviews_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "review_rounds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "reviews" ADD CONSTRAINT "reviews_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "papers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reviewerUserId_fkey" FOREIGN KEY ("reviewerUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "rebuttals" ADD CONSTRAINT "rebuttals_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "rebuttals" ADD CONSTRAINT "rebuttals_conferenceId_fkey" FOREIGN KEY ("conferenceId") REFERENCES "conferences"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "rebuttals" ADD CONSTRAINT "rebuttals_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "papers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "rebuttals" ADD CONSTRAINT "rebuttals_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "review_rounds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "rebuttals" ADD CONSTRAINT "rebuttals_authoredByUserId_fkey" FOREIGN KEY ("authoredByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- =============================================================================
-- Row-Level Security for reviews and rebuttals
-- =============================================================================

-- reviews
ALTER TABLE "reviews" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "reviews" FORCE ROW LEVEL SECURITY;

CREATE POLICY "reviews_select" ON "reviews"
  FOR SELECT USING (app_user_in_conference("conferenceId"));

CREATE POLICY "reviews_insert" ON "reviews"
  FOR INSERT WITH CHECK (app_user_in_conference("conferenceId") OR app_rls_bypass());

CREATE POLICY "reviews_update" ON "reviews"
  FOR UPDATE USING (app_user_in_conference("conferenceId") OR app_rls_bypass());

CREATE POLICY "reviews_delete" ON "reviews"
  FOR DELETE USING (app_user_in_conference("conferenceId") OR app_rls_bypass());

-- rebuttals
ALTER TABLE "rebuttals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rebuttals" FORCE ROW LEVEL SECURITY;

CREATE POLICY "rebuttals_select" ON "rebuttals"
  FOR SELECT USING (app_user_in_conference("conferenceId"));

CREATE POLICY "rebuttals_insert" ON "rebuttals"
  FOR INSERT WITH CHECK (app_user_in_conference("conferenceId") OR app_rls_bypass());

CREATE POLICY "rebuttals_update" ON "rebuttals"
  FOR UPDATE USING (app_user_in_conference("conferenceId") OR app_rls_bypass());

CREATE POLICY "rebuttals_delete" ON "rebuttals"
  FOR DELETE USING (app_user_in_conference("conferenceId") OR app_rls_bypass());
