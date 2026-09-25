-- Reviewer invitation: Dear Professor, and wait-for-assignment step.

UPDATE "notification_templates"
SET
  "bodyHtml" = replace(
    replace(
      "bodyHtml",
      'Dear colleague,',
      'Dear Professor,'
    ),
    'After you accept, you can bid on papers and declare any conflicts of interest.',
    'After you accept, the dashboard may appear empty at first. Please wait until a paper is assigned to you.'
  ),
  "bodyText" = replace(
    replace(
      "bodyText",
      'Dear colleague,',
      'Dear Professor,'
    ),
    'After you accept, you can bid on papers and declare any conflicts of interest.',
    'After you accept, the dashboard may appear empty at first. Please wait until a paper is assigned to you.'
  ),
  "updatedAt" = NOW()
WHERE "organizationId" IS NULL
  AND "key" = 'reviewer.invitation';
