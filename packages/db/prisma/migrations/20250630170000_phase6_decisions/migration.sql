-- CreateEnum
CREATE TYPE "DecisionOutcome" AS ENUM ('ACCEPT', 'REJECT', 'MINOR_REVISION', 'MAJOR_REVISION');

-- CreateTable
CREATE TABLE "decisions" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "conferenceId" UUID NOT NULL,
    "paperId" UUID NOT NULL,
    "roundId" UUID NOT NULL,
    "decidedById" UUID NOT NULL,
    "outcome" "DecisionOutcome" NOT NULL,
    "rationale" TEXT,
    "notifiedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "decisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "decisions_paperId_roundId_key" ON "decisions"("paperId", "roundId");

-- CreateIndex
CREATE INDEX "decisions_conferenceId_idx" ON "decisions"("conferenceId");

-- AddForeignKey
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_conferenceId_fkey" FOREIGN KEY ("conferenceId") REFERENCES "conferences"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "papers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "review_rounds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- =============================================================================
-- Row-Level Security for decisions
-- =============================================================================

ALTER TABLE "decisions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "decisions" FORCE ROW LEVEL SECURITY;

CREATE POLICY "decisions_select" ON "decisions"
  FOR SELECT USING (app_user_in_conference("conferenceId"));

CREATE POLICY "decisions_insert" ON "decisions"
  FOR INSERT WITH CHECK (app_user_in_conference("conferenceId") OR app_rls_bypass());

CREATE POLICY "decisions_update" ON "decisions"
  FOR UPDATE USING (app_user_in_conference("conferenceId") OR app_rls_bypass());

CREATE POLICY "decisions_delete" ON "decisions"
  FOR DELETE USING (app_user_in_conference("conferenceId") OR app_rls_bypass());
