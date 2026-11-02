-- Refund intents use kind=REFUND and status=CREATED until the provider settles them.
ALTER TABLE payments ADD COLUMN "refundOfPaymentId" UUID REFERENCES payments(id);
CREATE INDEX "payments_refundOfPaymentId_idx" ON payments("refundOfPaymentId");
-- Recover historical parent IDs where the stored provider response identifies them.
UPDATE payments refund SET "refundOfPaymentId" = capture.id
FROM payments capture
WHERE refund.kind = 'REFUND' AND capture.kind <> 'REFUND'
  AND refund.provider = capture.provider AND refund."registrationId" = capture."registrationId"
  AND refund."rawPayload"->>'payment_id' = capture."providerPaymentId";
-- Unidentifiable legacy refunds remain conservatively reserved at registration level.

-- Better Auth 1.7 validates credential accountId against its owning user UUID.
-- Normalize historical email-based seed accounts, preserving any canonical account.
UPDATE accounts a SET "accountId" = a."userId"::text
FROM users u
WHERE a."userId" = u.id AND a."providerId" = 'credential'
  AND lower(a."accountId") = lower(u.email)
  AND NOT EXISTS (SELECT 1 FROM accounts canonical
    WHERE canonical."providerId" = 'credential' AND canonical."accountId" = a."userId"::text);
