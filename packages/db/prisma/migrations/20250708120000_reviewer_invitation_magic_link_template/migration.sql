-- Reviewer invitation email: magic link one-click onboarding copy (template v2 sync target)
UPDATE "notification_templates"
SET
  "subject" = 'Reviewer invitation — {{conferenceName}}',
  "bodyHtml" = REPLACE(
    REPLACE(
      "bodyHtml",
      'Sign up or sign in with this email address to accept the invitation and access assigned papers, bidding, and review forms.',
      'Click the button below to sign in securely and join the committee. No password is required for your first visit.'
    ),
    'Accept invitation',
    'Join as reviewer'
  ),
  "bodyText" = REPLACE(
    REPLACE(
      "bodyText",
      'Sign up or sign in with this email address to accept.',
      'Click the link below to join the review committee in one step.'
    ),
    'Accept invitation',
    'Join as reviewer'
  ),
  "updatedAt" = NOW()
WHERE "organizationId" IS NULL AND "key" = 'reviewer.invitation' AND "version" = 2;
