-- Reviewer invitation: transactional copy (remove phishing-like phrases for deliverability)
UPDATE "notification_templates"
SET
  "subject" = 'Accept your reviewer invitation — {{conferenceName}}',
  "bodyHtml" = REPLACE(
    REPLACE(
      REPLACE(
        REPLACE(
          REPLACE(
            REPLACE(
              REPLACE(
                "bodyHtml",
                '<title>You are invited to review</title>',
                '<title>Reviewer invitation</title>'
              ),
              '<h1 style="margin:12px 0 0;font-size:22px;line-height:1.35;color:#0f172a;font-weight:700;">You are invited to review</h1>',
              '<h1 style="margin:12px 0 0;font-size:22px;line-height:1.35;color:#0f172a;font-weight:700;">Reviewer invitation</h1>'
            ),
            'One click to join the review committee.',
            'You have been invited to review for {{conferenceName}}.'
          ),
          'You have been invited to join the program committee as a reviewer.',
          'You have been invited to review for {{conferenceName}}.'
        ),
        'Click the button below to sign in securely and join the committee. No password is required for your first visit.',
        'Sign in with this email address to accept the invitation and access your review assignments.'
      ),
      'Sign up or sign in with this email address to accept the invitation and access assigned papers, bidding, and review forms.',
      'Sign in with this email address to accept the invitation and access your review assignments.'
    ),
    'Join as reviewer',
    'Accept invitation'
  ),
  "bodyText" = REPLACE(
    REPLACE(
      REPLACE(
        "bodyText",
        'Click the link below to join the review committee in one step.',
        'Sign in with this email address to accept the invitation.'
      ),
      'Sign up or sign in with this email address to accept.',
      'Sign in with this email address to accept the invitation.'
    ),
    'Join as reviewer',
    'Accept invitation'
  ),
  "updatedAt" = NOW()
WHERE "organizationId" IS NULL AND "key" = 'reviewer.invitation' AND "version" = 2;
