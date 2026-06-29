-- CreateEnum
CREATE TYPE "ConferenceStatus" AS ENUM ('DRAFT', 'CFP_OPEN', 'REVIEWING', 'DECISIONS', 'FINALIZATION', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "BlindingMode" AS ENUM ('SINGLE', 'DOUBLE', 'OPEN');

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conferences" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "ConferenceStatus" NOT NULL DEFAULT 'DRAFT',
    "blindingMode" "BlindingMode" NOT NULL DEFAULT 'DOUBLE',
    "cfpOpensAt" TIMESTAMP(3),
    "cfpClosesAt" TIMESTAMP(3),
    "biddingOpensAt" TIMESTAMP(3),
    "biddingClosesAt" TIMESTAMP(3),
    "reviewDueAt" TIMESTAMP(3),
    "rebuttalDueAt" TIMESTAMP(3),
    "decisionDueAt" TIMESTAMP(3),
    "cameraReadyDueAt" TIMESTAMP(3),
    "registrationDueAt" TIMESTAMP(3),
    "reviewConfig" JSONB NOT NULL DEFAULT '{}',
    "feeSchedule" JSONB NOT NULL DEFAULT '{}',
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "conferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tracks" (
    "id" UUID NOT NULL,
    "conferenceId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "tracks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug") WHERE "deletedAt" IS NULL;

-- CreateIndex
CREATE INDEX "conferences_organizationId_status_idx" ON "conferences"("organizationId", "status");

-- Partial unique index: slug unique per org among non-deleted conferences
CREATE UNIQUE INDEX "conferences_organizationId_slug_key" ON "conferences"("organizationId", "slug") WHERE "deletedAt" IS NULL;

-- CreateIndex
CREATE INDEX "tracks_conferenceId_idx" ON "tracks"("conferenceId");

-- Partial unique index: slug unique per conference among non-deleted tracks
CREATE UNIQUE INDEX "tracks_conferenceId_slug_key" ON "tracks"("conferenceId", "slug") WHERE "deletedAt" IS NULL;

-- CreateIndex
CREATE INDEX "memberships_organizationId_idx" ON "memberships"("organizationId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conferences" ADD CONSTRAINT "conferences_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracks" ADD CONSTRAINT "tracks_conferenceId_fkey" FOREIGN KEY ("conferenceId") REFERENCES "conferences"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracks" ADD CONSTRAINT "tracks_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_conferenceId_fkey" FOREIGN KEY ("conferenceId") REFERENCES "conferences"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Organization slug format constraint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_slug_format" CHECK (slug ~ '^[a-z0-9-]+$');

-- Membership scope constraint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_scope_conference_check" CHECK (
  ("scope" = 'CONFERENCE' AND "conferenceId" IS NOT NULL) OR
  ("scope" = 'ORGANIZATION' AND "conferenceId" IS NULL)
);

-- CFP window constraint
ALTER TABLE "conferences" ADD CONSTRAINT "conferences_cfp_window_check" CHECK (
  "cfpOpensAt" IS NULL OR "cfpClosesAt" IS NULL OR "cfpOpensAt" < "cfpClosesAt"
);

-- =============================================================================
-- Row-Level Security (§18.4)
-- Policies key off transaction-scoped GUCs set by the API via SET LOCAL:
--   app.current_user_id, app.current_org_id, app.current_conference_id, app.bypass_rls
-- =============================================================================

-- Helper: bypass flag for seed/admin paths
CREATE OR REPLACE FUNCTION app_rls_bypass() RETURNS boolean AS $$
  SELECT COALESCE(current_setting('app.bypass_rls', true), 'off') = 'on';
$$ LANGUAGE sql STABLE;

-- Helper: user has membership in org
CREATE OR REPLACE FUNCTION app_user_in_org(org_id uuid) RETURNS boolean AS $$
  SELECT app_rls_bypass() OR EXISTS (
    SELECT 1 FROM memberships m
    WHERE m."userId"::text = current_setting('app.current_user_id', true)
      AND m."organizationId" = org_id
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Helper: user has membership in conference
CREATE OR REPLACE FUNCTION app_user_in_conference(conf_id uuid) RETURNS boolean AS $$
  SELECT app_rls_bypass() OR EXISTS (
    SELECT 1 FROM memberships m
    WHERE m."userId"::text = current_setting('app.current_user_id', true)
      AND m."conferenceId" = conf_id
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- organizations
ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organizations" FORCE ROW LEVEL SECURITY;

CREATE POLICY "organizations_select" ON "organizations"
  FOR SELECT USING (app_user_in_org(id));

CREATE POLICY "organizations_insert" ON "organizations"
  FOR INSERT WITH CHECK (app_rls_bypass());

CREATE POLICY "organizations_update" ON "organizations"
  FOR UPDATE USING (app_user_in_org(id));

CREATE POLICY "organizations_delete" ON "organizations"
  FOR DELETE USING (app_rls_bypass());

-- conferences
ALTER TABLE "conferences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "conferences" FORCE ROW LEVEL SECURITY;

CREATE POLICY "conferences_select" ON "conferences"
  FOR SELECT USING (app_user_in_org("organizationId"));

CREATE POLICY "conferences_insert" ON "conferences"
  FOR INSERT WITH CHECK (app_user_in_org("organizationId") OR app_rls_bypass());

CREATE POLICY "conferences_update" ON "conferences"
  FOR UPDATE USING (app_user_in_org("organizationId"));

CREATE POLICY "conferences_delete" ON "conferences"
  FOR DELETE USING (app_rls_bypass());

-- tracks
ALTER TABLE "tracks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tracks" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tracks_select" ON "tracks"
  FOR SELECT USING (app_user_in_conference("conferenceId"));

CREATE POLICY "tracks_insert" ON "tracks"
  FOR INSERT WITH CHECK (app_user_in_conference("conferenceId") OR app_rls_bypass());

CREATE POLICY "tracks_update" ON "tracks"
  FOR UPDATE USING (app_user_in_conference("conferenceId"));

CREATE POLICY "tracks_delete" ON "tracks"
  FOR DELETE USING (app_user_in_conference("conferenceId") OR app_rls_bypass());

-- memberships
ALTER TABLE "memberships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "memberships" FORCE ROW LEVEL SECURITY;

CREATE POLICY "memberships_select" ON "memberships"
  FOR SELECT USING (
    app_rls_bypass() OR
    "userId"::text = current_setting('app.current_user_id', true) OR
    app_user_in_org("organizationId")
  );

CREATE POLICY "memberships_insert" ON "memberships"
  FOR INSERT WITH CHECK (app_user_in_org("organizationId") OR app_rls_bypass());

CREATE POLICY "memberships_update" ON "memberships"
  FOR UPDATE USING (app_user_in_org("organizationId") OR app_rls_bypass());

CREATE POLICY "memberships_delete" ON "memberships"
  FOR DELETE USING (app_user_in_org("organizationId") OR app_rls_bypass());

-- role_grants (via membership org/conference scope)
ALTER TABLE "role_grants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "role_grants" FORCE ROW LEVEL SECURITY;

CREATE POLICY "role_grants_select" ON "role_grants"
  FOR SELECT USING (
    app_rls_bypass() OR EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.id = "role_grants"."membershipId"
        AND (
          m."userId"::text = current_setting('app.current_user_id', true) OR
          app_user_in_org(m."organizationId")
        )
    )
  );

CREATE POLICY "role_grants_insert" ON "role_grants"
  FOR INSERT WITH CHECK (
    app_rls_bypass() OR EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.id = "role_grants"."membershipId"
        AND app_user_in_org(m."organizationId")
    )
  );

CREATE POLICY "role_grants_delete" ON "role_grants"
  FOR DELETE USING (
    app_rls_bypass() OR EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.id = "role_grants"."membershipId"
        AND app_user_in_org(m."organizationId")
    )
  );
