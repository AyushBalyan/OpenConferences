ALTER TABLE "papers" ADD COLUMN "submittedAt" TIMESTAMP(3);

UPDATE "papers" AS paper
SET "submittedAt" = submitted."submittedAt"
FROM (
  SELECT "entityId", "conferenceId", MIN("createdAt") AS "submittedAt"
  FROM "audit_logs"
  WHERE "action" = 'paper.submitted' AND "entity" = 'Paper'
  GROUP BY "entityId", "conferenceId"
) AS submitted
WHERE paper."id"::text = submitted."entityId"
  AND paper."conferenceId" = submitted."conferenceId"
  AND paper."status" <> 'DRAFT';
