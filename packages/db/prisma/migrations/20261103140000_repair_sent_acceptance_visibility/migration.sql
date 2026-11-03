-- The notification path previously updated decisions without the acting user's
-- RLS context. Restore author visibility only for acceptances with a matching
-- successfully sent decision email; do not release any unsent decisions.
UPDATE decisions AS d
SET "notifiedAt" = sent.sent_at,
    "updatedAt" = CURRENT_TIMESTAMP
FROM (
  SELECT "relatedEntityId", "conferenceId", "organizationId",
         MIN("sentAt") AS sent_at
  FROM notification_logs
  WHERE "templateKey" = 'decision.notified'
    AND "relatedEntity" = 'Decision'
    AND status = 'SENT'
    AND "sentAt" IS NOT NULL
  GROUP BY "relatedEntityId", "conferenceId", "organizationId"
) AS sent
WHERE d.id::text = sent."relatedEntityId"
  AND d."conferenceId" = sent."conferenceId"
  AND d."organizationId" = sent."organizationId"
  AND d.outcome = 'ACCEPT'
  AND d."notifiedAt" IS NULL;
