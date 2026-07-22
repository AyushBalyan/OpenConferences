-- Add opaque token for public author submit links
ALTER TABLE "conferences" ADD COLUMN "authorJoinToken" UUID;

UPDATE "conferences" SET "authorJoinToken" = gen_random_uuid() WHERE "authorJoinToken" IS NULL;

ALTER TABLE "conferences" ALTER COLUMN "authorJoinToken" SET NOT NULL;

CREATE UNIQUE INDEX "conferences_authorJoinToken_key" ON "conferences"("authorJoinToken");
