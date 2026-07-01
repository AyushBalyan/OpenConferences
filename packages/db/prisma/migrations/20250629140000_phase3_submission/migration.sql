-- CreateEnum
CREATE TYPE "PaperStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'DECISION_MADE', 'CAMERA_READY', 'WITHDRAWN', 'WITHDRAWN_NONPAYMENT');

-- CreateEnum
CREATE TYPE "VersionKind" AS ENUM ('SUBMISSION', 'REVISION', 'CAMERA_READY', 'SUPPLEMENTARY');

-- CreateEnum
CREATE TYPE "FileScanStatus" AS ENUM ('PENDING_SCAN', 'CLEAN', 'INFECTED');

-- CreateTable
CREATE TABLE "papers" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "conferenceId" UUID NOT NULL,
    "trackId" UUID NOT NULL,
    "submittedById" UUID NOT NULL,
    "currentVersionId" UUID,
    "title" TEXT NOT NULL,
    "abstract" TEXT NOT NULL,
    "keywords" TEXT[],
    "status" "PaperStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "papers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_assets" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "uploadedById" UUID NOT NULL,
    "bucket" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "checksumSha256" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "scanStatus" "FileScanStatus" NOT NULL DEFAULT 'PENDING_SCAN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "file_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paper_versions" (
    "id" UUID NOT NULL,
    "paperId" UUID NOT NULL,
    "fileAssetId" UUID NOT NULL,
    "uploadedById" UUID NOT NULL,
    "kind" "VersionKind" NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "paper_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "authorships" (
    "id" UUID NOT NULL,
    "paperId" UUID NOT NULL,
    "userId" UUID,
    "order" INTEGER NOT NULL,
    "isCorresponding" BOOLEAN NOT NULL DEFAULT false,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "affiliation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "authorships_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "papers_currentVersionId_key" ON "papers"("currentVersionId");

-- CreateIndex
CREATE INDEX "papers_conferenceId_status_idx" ON "papers"("conferenceId", "status");

-- CreateIndex
CREATE INDEX "papers_trackId_idx" ON "papers"("trackId");

-- CreateIndex
CREATE INDEX "papers_submittedById_idx" ON "papers"("submittedById");

-- CreateIndex
CREATE INDEX "papers_keywords_gin_idx" ON "papers" USING GIN ("keywords");

-- CreateIndex
CREATE UNIQUE INDEX "file_assets_objectKey_key" ON "file_assets"("objectKey");

-- CreateIndex
CREATE UNIQUE INDEX "paper_versions_paperId_kind_versionNumber_key" ON "paper_versions"("paperId", "kind", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "authorships_paperId_order_key" ON "authorships"("paperId", "order");

-- CreateIndex
CREATE INDEX "authorships_userId_idx" ON "authorships"("userId");

-- CreateIndex
CREATE INDEX "authorships_email_idx" ON "authorships"("email");

-- Partial unique: exactly one corresponding author per paper
CREATE UNIQUE INDEX "authorships_paperId_corresponding_key" ON "authorships"("paperId") WHERE "isCorresponding" = true;

-- Constraints
ALTER TABLE "papers" ADD CONSTRAINT "papers_title_not_empty" CHECK (length(trim("title")) > 0);

-- AddForeignKey
ALTER TABLE "papers" ADD CONSTRAINT "papers_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "papers" ADD CONSTRAINT "papers_conferenceId_fkey" FOREIGN KEY ("conferenceId") REFERENCES "conferences"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "papers" ADD CONSTRAINT "papers_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "tracks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "papers" ADD CONSTRAINT "papers_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "papers" ADD CONSTRAINT "papers_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "paper_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "file_assets" ADD CONSTRAINT "file_assets_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "file_assets" ADD CONSTRAINT "file_assets_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "paper_versions" ADD CONSTRAINT "paper_versions_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "papers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "paper_versions" ADD CONSTRAINT "paper_versions_fileAssetId_fkey" FOREIGN KEY ("fileAssetId") REFERENCES "file_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "paper_versions" ADD CONSTRAINT "paper_versions_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "authorships" ADD CONSTRAINT "authorships_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "papers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "authorships" ADD CONSTRAINT "authorships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- =============================================================================
-- Row-Level Security for submission tables
-- =============================================================================

-- papers
ALTER TABLE "papers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "papers" FORCE ROW LEVEL SECURITY;

CREATE POLICY "papers_select" ON "papers"
  FOR SELECT USING (app_user_in_conference("conferenceId"));

CREATE POLICY "papers_insert" ON "papers"
  FOR INSERT WITH CHECK (app_user_in_conference("conferenceId") OR app_rls_bypass());

CREATE POLICY "papers_update" ON "papers"
  FOR UPDATE USING (app_user_in_conference("conferenceId"));

CREATE POLICY "papers_delete" ON "papers"
  FOR DELETE USING (app_user_in_conference("conferenceId") OR app_rls_bypass());

-- file_assets
ALTER TABLE "file_assets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "file_assets" FORCE ROW LEVEL SECURITY;

CREATE POLICY "file_assets_select" ON "file_assets"
  FOR SELECT USING (app_user_in_org("organizationId"));

CREATE POLICY "file_assets_insert" ON "file_assets"
  FOR INSERT WITH CHECK (app_user_in_org("organizationId") OR app_rls_bypass());

CREATE POLICY "file_assets_update" ON "file_assets"
  FOR UPDATE USING (app_user_in_org("organizationId") OR app_rls_bypass());

-- paper_versions (via paper conference scope)
ALTER TABLE "paper_versions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "paper_versions" FORCE ROW LEVEL SECURITY;

CREATE POLICY "paper_versions_select" ON "paper_versions"
  FOR SELECT USING (
    app_rls_bypass() OR EXISTS (
      SELECT 1 FROM papers p
      WHERE p.id = "paper_versions"."paperId"
        AND app_user_in_conference(p."conferenceId")
    )
  );

CREATE POLICY "paper_versions_insert" ON "paper_versions"
  FOR INSERT WITH CHECK (
    app_rls_bypass() OR EXISTS (
      SELECT 1 FROM papers p
      WHERE p.id = "paper_versions"."paperId"
        AND app_user_in_conference(p."conferenceId")
    )
  );

CREATE POLICY "paper_versions_update" ON "paper_versions"
  FOR UPDATE USING (
    app_rls_bypass() OR EXISTS (
      SELECT 1 FROM papers p
      WHERE p.id = "paper_versions"."paperId"
        AND app_user_in_conference(p."conferenceId")
    )
  );

-- authorships (via paper conference scope)
ALTER TABLE "authorships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "authorships" FORCE ROW LEVEL SECURITY;

CREATE POLICY "authorships_select" ON "authorships"
  FOR SELECT USING (
    app_rls_bypass() OR EXISTS (
      SELECT 1 FROM papers p
      WHERE p.id = "authorships"."paperId"
        AND app_user_in_conference(p."conferenceId")
    )
  );

CREATE POLICY "authorships_insert" ON "authorships"
  FOR INSERT WITH CHECK (
    app_rls_bypass() OR EXISTS (
      SELECT 1 FROM papers p
      WHERE p.id = "authorships"."paperId"
        AND app_user_in_conference(p."conferenceId")
    )
  );

CREATE POLICY "authorships_update" ON "authorships"
  FOR UPDATE USING (
    app_rls_bypass() OR EXISTS (
      SELECT 1 FROM papers p
      WHERE p.id = "authorships"."paperId"
        AND app_user_in_conference(p."conferenceId")
    )
  );

CREATE POLICY "authorships_delete" ON "authorships"
  FOR DELETE USING (
    app_rls_bypass() OR EXISTS (
      SELECT 1 FROM papers p
      WHERE p.id = "authorships"."paperId"
        AND app_user_in_conference(p."conferenceId")
    )
  );
