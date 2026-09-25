-- One review cycle per paper. Split conference-wide rounds, then drop RoundStatus.

ALTER TABLE "review_rounds" ADD COLUMN "paperId" UUID;
ALTER TABLE "review_rounds" ADD COLUMN "reviewsReleasedAt" TIMESTAMPTZ;

CREATE TEMP TABLE cycle_papers ON COMMIT DROP AS
SELECT DISTINCT r.id AS round_id, x.paper_id
FROM "review_rounds" r
JOIN (
  SELECT "roundId" AS round_id, "paperId" AS paper_id FROM "reviewer_assignments"
  UNION
  SELECT "roundId", "paperId" FROM "reviews"
  UNION
  SELECT "roundId", "paperId" FROM "rebuttals"
  UNION
  SELECT "roundId", "paperId" FROM "decisions"
) x ON x.round_id = r.id;

WITH keeper AS (
  SELECT DISTINCT ON (round_id) round_id, paper_id
  FROM cycle_papers
  ORDER BY round_id, paper_id
)
UPDATE "review_rounds" rr
SET "paperId" = keeper.paper_id
FROM keeper
WHERE rr.id = keeper.round_id;

CREATE TEMP TABLE cycle_clones ON COMMIT DROP AS
SELECT
  gen_random_uuid() AS new_id,
  cp.round_id AS old_id,
  cp.paper_id
FROM cycle_papers cp
WHERE NOT EXISTS (
  SELECT 1
  FROM "review_rounds" rr
  WHERE rr.id = cp.round_id AND rr."paperId" = cp.paper_id
);

-- Clones share the source conference and round number. The per-paper key replaces this.
DROP INDEX IF EXISTS "review_rounds_conferenceId_roundNumber_key";

INSERT INTO "review_rounds" (
  "id",
  "organizationId",
  "conferenceId",
  "paperId",
  "roundNumber",
  "status",
  "reviewDueAt",
  "rebuttalDueAt",
  "revisionDueAt",
  "version",
  "createdAt",
  "updatedAt"
)
SELECT
  c.new_id,
  src."organizationId",
  src."conferenceId",
  c.paper_id,
  src."roundNumber",
  src."status",
  src."reviewDueAt",
  src."rebuttalDueAt",
  src."revisionDueAt",
  src."version",
  src."createdAt",
  NOW()
FROM cycle_clones c
JOIN "review_rounds" src ON src.id = c.old_id;

UPDATE "reviewer_assignments" a
SET "roundId" = c.new_id
FROM cycle_clones c
WHERE a."roundId" = c.old_id AND a."paperId" = c.paper_id;

UPDATE "reviews" rv
SET "roundId" = c.new_id
FROM cycle_clones c
WHERE rv."roundId" = c.old_id AND rv."paperId" = c.paper_id;

UPDATE "rebuttals" rb
SET "roundId" = c.new_id
FROM cycle_clones c
WHERE rb."roundId" = c.old_id AND rb."paperId" = c.paper_id;

UPDATE "decisions" d
SET "roundId" = c.new_id
FROM cycle_clones c
WHERE d."roundId" = c.old_id AND d."paperId" = c.paper_id;

DELETE FROM "review_rounds" WHERE "paperId" IS NULL;

UPDATE "review_rounds" rr
SET "reviewsReleasedAt" = released.at
FROM (
  SELECT "roundId", MIN("updatedAt") AS at
  FROM "reviews"
  WHERE "visibility" = 'AUTHOR_VISIBLE' AND "submittedAt" IS NOT NULL
  GROUP BY "roundId"
) released
WHERE rr.id = released."roundId";

ALTER TABLE "review_rounds" ALTER COLUMN "paperId" SET NOT NULL;

ALTER TABLE "review_rounds"
  ADD CONSTRAINT "review_rounds_paperId_fkey"
  FOREIGN KEY ("paperId") REFERENCES "papers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

DROP INDEX IF EXISTS "review_rounds_conferenceId_roundNumber_key";
DROP INDEX IF EXISTS "review_rounds_conferenceId_status_idx";

CREATE UNIQUE INDEX "review_rounds_paperId_roundNumber_key" ON "review_rounds"("paperId", "roundNumber");
CREATE INDEX "review_rounds_conferenceId_idx" ON "review_rounds"("conferenceId");
CREATE INDEX "review_rounds_paperId_idx" ON "review_rounds"("paperId");

ALTER TABLE "review_rounds" DROP COLUMN "status";

DROP TYPE "RoundStatus";
