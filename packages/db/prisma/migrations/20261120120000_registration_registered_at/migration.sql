-- The date a registration fee was first paid, so the organiser list can show and sort by it.
ALTER TABLE "registrations" ADD COLUMN "registeredAt" TIMESTAMP(3);

-- Existing registrations: the invoice date of the first payment, or when that payment was made.
UPDATE "registrations" r
SET "registeredAt" = paid.at
FROM (
  SELECT p."registrationId", MIN(COALESCE(i."issuedAt", p."createdAt")) AS at
  FROM "payments" p
  LEFT JOIN "invoices" i ON i."paymentId" = p."id"
  WHERE p."kind" <> 'REFUND'
    AND p."status" IN ('CAPTURED', 'REFUNDED', 'PARTIALLY_REFUNDED')
  GROUP BY p."registrationId"
) paid
WHERE paid."registrationId" = r."id";

CREATE INDEX "registrations_conferenceId_registeredAt_idx" ON "registrations"("conferenceId", "registeredAt");
