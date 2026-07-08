-- Phase 9 follow-up: align notification status enum with Prisma PascalCase convention.
-- Early phase9 drafts used snake_case `notification_status`; current phase9 creates
-- "NotificationStatus" directly. This block is a no-op on fresh installs.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_status') THEN
    ALTER TYPE notification_status RENAME TO "NotificationStatus";
  END IF;
END $$;
