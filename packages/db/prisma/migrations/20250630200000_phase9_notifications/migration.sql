-- Phase 9: Notifications

CREATE TYPE "NotificationStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED', 'BOUNCED');

CREATE TABLE "notification_templates" (
    "id" UUID NOT NULL,
    "organizationId" UUID,
    "key" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "subject" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "bodyText" TEXT,
    "variables" JSONB NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "notification_logs" (
    "id" UUID NOT NULL,
    "organizationId" UUID,
    "conferenceId" UUID,
    "templateKey" TEXT NOT NULL,
    "templateVersion" INTEGER,
    "toEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "renderedHtml" TEXT,
    "status" "NotificationStatus" NOT NULL DEFAULT 'QUEUED',
    "providerMessageId" TEXT,
    "error" TEXT,
    "idempotencyKey" TEXT,
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "relatedEntity" TEXT,
    "relatedEntityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "email_suppressions" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_suppressions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "notification_templates_organizationId_key_version_key" ON "notification_templates"("organizationId", "key", "version");
CREATE INDEX "notification_templates_organizationId_key_isActive_idx" ON "notification_templates"("organizationId", "key", "isActive");
CREATE UNIQUE INDEX "notification_logs_idempotencyKey_key" ON "notification_logs"("idempotencyKey");
CREATE INDEX "notification_logs_conferenceId_createdAt_idx" ON "notification_logs"("conferenceId", "createdAt");
CREATE INDEX "notification_logs_status_idx" ON "notification_logs"("status");
CREATE INDEX "notification_logs_toEmail_idx" ON "notification_logs"("toEmail");
CREATE UNIQUE INDEX "email_suppressions_email_key" ON "email_suppressions"("email");

ALTER TABLE "notification_templates" ADD CONSTRAINT "notification_templates_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Platform default templates (organizationId NULL)
INSERT INTO "notification_templates" ("id", "organizationId", "key", "version", "locale", "subject", "bodyHtml", "variables", "isActive", "createdAt", "updatedAt") VALUES
('a1000001-0000-4000-8000-000000000001', NULL, 'auth.email_verify', 1, 'en', 'Verify your OpenConferences email', '<p>Please verify your email address by clicking the link below:</p><p><a href="{{verifyUrl}}">Verify email</a></p>', '["verifyUrl"]', true, NOW(), NOW()),
('a1000001-0000-4000-8000-000000000002', NULL, 'auth.password_reset', 1, 'en', 'Reset your OpenConferences password', '<p>Reset your password by clicking the link below:</p><p><a href="{{resetUrl}}">Reset password</a></p><p>If you did not request this, you can ignore this email.</p>', '["resetUrl"]', true, NOW(), NOW()),
('a1000001-0000-4000-8000-000000000003', NULL, 'submission.confirmed', 1, 'en', 'Submission confirmed: {{paperTitle}}', '<p>Your paper &quot;{{paperTitle}}&quot; has been submitted successfully.</p>', '["paperTitle"]', true, NOW(), NOW()),
('a1000001-0000-4000-8000-000000000004', NULL, 'reviewer.invitation', 1, 'en', 'Reviewer invitation: {{conferenceName}}', '<p>You have been invited to review for <strong>{{conferenceName}}</strong>.</p><p><a href="{{signupUrl}}">Create your account to accept the invitation</a></p><p>This invitation expires on {{expiresAt}}.</p>', '["conferenceName","signupUrl","expiresAt"]', true, NOW(), NOW()),
('a1000001-0000-4000-8000-000000000005', NULL, 'assignment.notified', 1, 'en', 'Review assignment: {{paperTitle}}', '<p>You have been assigned to review &quot;{{paperTitle}}&quot; (Round {{roundNumber}}).</p><p>Due date: {{dueAt}}</p>', '["paperTitle","roundNumber","dueAt"]', true, NOW(), NOW()),
('a1000001-0000-4000-8000-000000000006', NULL, 'review.reminder', 1, 'en', 'Review reminder: {{paperTitle}}', '<p>This is a reminder that your review for &quot;{{paperTitle}}&quot; is due on {{dueAt}}.</p>', '["paperTitle","dueAt"]', true, NOW(), NOW()),
('a1000001-0000-4000-8000-000000000007', NULL, 'decision.notified', 1, 'en', 'Decision: {{outcomeLabel}} — {{paperTitle}}', '<p>The editorial decision for &quot;{{paperTitle}}&quot; is: <strong>{{outcomeLabel}}</strong>.</p>{{rationaleBlock}}{{acceptBlock}}', '["paperTitle","outcomeLabel","rationaleBlock","acceptBlock"]', true, NOW(), NOW()),
('a1000001-0000-4000-8000-000000000008', NULL, 'review.released', 1, 'en', 'Reviews released: {{paperTitle}}', '<p>Reviews for your paper &quot;{{paperTitle}}&quot; have been released. You may now read them and submit a rebuttal.</p>', '["paperTitle"]', true, NOW(), NOW()),
('a1000001-0000-4000-8000-000000000009', NULL, 'cameraready.reminder', 1, 'en', 'Camera-ready deadline approaching: {{paperTitle}}', '<p>Your camera-ready submission for &quot;{{paperTitle}}&quot; is due on {{deadlineAt}}.</p>', '["paperTitle","deadlineAt"]', true, NOW(), NOW()),
('a1000001-0000-4000-8000-000000000010', NULL, 'registration.window_open', 1, 'en', 'Registration open: {{paperTitle}}', '<p>Your paper &quot;{{paperTitle}}&quot; has been accepted. Registration is now open and due by {{deadlineAt}}.</p>', '["paperTitle","deadlineAt"]', true, NOW(), NOW()),
('a1000001-0000-4000-8000-000000000011', NULL, 'registration.early_bird_ending', 1, 'en', 'Early-bird registration ending soon', '<p>Early-bird registration for &quot;{{paperTitle}}&quot; ends on {{earlyBirdEndsAt}}.</p>', '["paperTitle","earlyBirdEndsAt"]', true, NOW(), NOW()),
('a1000001-0000-4000-8000-000000000012', NULL, 'registration.confirmed', 1, 'en', 'Registration payment received', '<p>Your registration payment of {{amountFormatted}} has been captured for &quot;{{paperTitle}}&quot;.</p>', '["paperTitle","amountFormatted"]', true, NOW(), NOW()),
('a1000001-0000-4000-8000-000000000013', NULL, 'registration.verification_approved', 1, 'en', 'Student verification approved', '<p>Your student verification for &quot;{{paperTitle}}&quot; has been approved.</p>', '["paperTitle"]', true, NOW(), NOW()),
('a1000001-0000-4000-8000-000000000014', NULL, 'registration.clarification_requested', 1, 'en', 'Student verification clarification needed', '<p>Additional information is needed for your student verification for &quot;{{paperTitle}}&quot;.</p><p>{{note}}</p>', '["paperTitle","note"]', true, NOW(), NOW()),
('a1000001-0000-4000-8000-000000000015', NULL, 'registration.additional_payment_required', 1, 'en', 'Additional registration payment required', '<p>Your student verification was not approved. An additional payment of {{amountFormatted}} is required for &quot;{{paperTitle}}&quot;.</p>', '["paperTitle","amountFormatted"]', true, NOW(), NOW()),
('a1000001-0000-4000-8000-000000000016', NULL, 'registration.deadline_reminder', 1, 'en', 'Registration deadline approaching', '<p>Registration for &quot;{{paperTitle}}&quot; is due on {{deadlineAt}}. Non-payment by the deadline will withdraw your paper.</p>', '["paperTitle","deadlineAt"]', true, NOW(), NOW()),
('a1000001-0000-4000-8000-000000000017', NULL, 'registration.discarded', 1, 'en', 'Registration discarded — payment not received', '<p>Registration for &quot;{{paperTitle}}&quot; was discarded due to non-payment.</p>', '["paperTitle"]', true, NOW(), NOW());
