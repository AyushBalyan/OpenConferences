-- Frozen public submission code. Nullable so existing rows and drafts are unchanged.
-- Postgres unique indexes treat NULL as distinct, so many drafts can omit the code.
ALTER TABLE "papers" ADD COLUMN "submissionNumber" TEXT;

CREATE UNIQUE INDEX "papers_conferenceId_submissionNumber_key" ON "papers"("conferenceId", "submissionNumber");
