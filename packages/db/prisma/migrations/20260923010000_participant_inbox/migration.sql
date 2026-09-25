-- Generated with Prisma migrate diff; recipient RLS added below.
CREATE TABLE "inbox_read_states" (
  "id" UUID NOT NULL PRIMARY KEY,
  "organizationId" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "conferenceId" UUID NOT NULL REFERENCES "conferences"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "userId" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "kind" TEXT NOT NULL CHECK ("kind" IN ('REVIEW', 'REBUTTAL')),
  "sourceId" UUID NOT NULL,
  "readVersion" INTEGER NOT NULL CHECK ("readVersion" >= 0),
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "inbox_read_states_conferenceId_userId_idx" ON "inbox_read_states"("conferenceId", "userId");
CREATE UNIQUE INDEX "inbox_read_states_userId_conferenceId_kind_sourceId_key" ON "inbox_read_states"("userId", "conferenceId", "kind", "sourceId");
ALTER TABLE "inbox_read_states" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inbox_read_states" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON "inbox_read_states" FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN REVOKE ALL ON "inbox_read_states" FROM anon; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN REVOKE ALL ON "inbox_read_states" FROM authenticated; END IF;
END $$;
GRANT SELECT, INSERT, UPDATE ON "inbox_read_states" TO openconferences_api;
CREATE POLICY inbox_recipient ON "inbox_read_states" FOR ALL TO openconferences_api
USING (
  "userId"::text = public.app_current_user_id()
  AND "conferenceId"::text = current_setting('app.current_conference_id', true)
  AND public.app_org_context_matches("organizationId")
  AND public.app_user_in_conference("conferenceId")
)
WITH CHECK (
  "userId"::text = public.app_current_user_id()
  AND "conferenceId"::text = current_setting('app.current_conference_id', true)
  AND public.app_org_context_matches("organizationId")
  AND public.app_user_in_conference("conferenceId")
);
