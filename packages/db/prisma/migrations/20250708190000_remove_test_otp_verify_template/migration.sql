-- Remove deliverability test template (no longer needed).
DELETE FROM "notification_templates"
WHERE "organizationId" IS NULL AND "key" = 'test.otp_verify';
