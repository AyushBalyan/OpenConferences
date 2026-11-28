-- Screen inventory: how often each task happens.
-- Run with: infra/redesign/audit/snapshot.sh run infra/redesign/audit/usage.sql
-- Counts only. No names, people or papers are selected.

\pset format unaligned
\pset fieldsep ' | '
\pset footer off

\echo '== 1. Period covered by the audit log'
SELECT min("createdAt")::date AS first_entry, max("createdAt")::date AS last_entry, count(*) AS entries
FROM audit_logs;

\echo
\echo '== 2. Actions recorded, with how many different people did each'
SELECT
  action,
  count(*) AS times,
  count(DISTINCT "actorUserId") AS people,
  count(DISTINCT "conferenceId") AS conferences,
  min("createdAt")::date AS first_seen,
  max("createdAt")::date AS last_seen
FROM audit_logs
GROUP BY action
ORDER BY times DESC;

\echo
\echo '== 3. Actions by the highest role the person holds in that conference'
WITH actor_role AS (
  SELECT
    m."userId",
    m."conferenceId",
    max(CASE g.role
      WHEN 'PLATFORM_ADMIN' THEN 6
      WHEN 'ORG_ADMIN' THEN 5
      WHEN 'ORGANIZER' THEN 4
      WHEN 'CHAIR' THEN 3
      WHEN 'REVIEWER' THEN 2
      WHEN 'AUTHOR' THEN 1
    END) AS rank
  FROM memberships m
  JOIN role_grants g ON g."membershipId" = m.id
  GROUP BY m."userId", m."conferenceId"
)
SELECT
  CASE coalesce(r.rank, 0)
    WHEN 6 THEN 'platform admin'
    WHEN 5 THEN 'organisation admin'
    WHEN 4 THEN 'organiser'
    WHEN 3 THEN 'chair'
    WHEN 2 THEN 'reviewer'
    WHEN 1 THEN 'author'
    ELSE 'no conference role'
  END AS role,
  a.action,
  count(*) AS times
FROM audit_logs a
LEFT JOIN actor_role r ON r."userId" = a."actorUserId" AND r."conferenceId" = a."conferenceId"
GROUP BY 1, 2
ORDER BY 1, times DESC;

\echo
\echo '== 4. Emails sent, by template'
SELECT "templateKey" AS template, status, count(*) AS emails
FROM notification_logs
GROUP BY 1, 2
ORDER BY emails DESC;

\echo
\echo '== 5. People by role, and how many hold more than one role'
SELECT g.role, count(DISTINCT m."userId") AS people
FROM memberships m
JOIN role_grants g ON g."membershipId" = m.id
GROUP BY g.role
ORDER BY people DESC;

SELECT count(*) AS people_who_are_both_author_and_reviewer
FROM (
  SELECT m."userId"
  FROM memberships m
  JOIN role_grants g ON g."membershipId" = m.id
  WHERE g.role IN ('AUTHOR', 'REVIEWER')
  GROUP BY m."userId"
  HAVING count(DISTINCT g.role) = 2
) both_roles;

\echo
\echo '== 6. Volumes behind the main screens'
SELECT 'papers' AS thing, count(*) AS total FROM papers
UNION ALL SELECT 'paper versions', count(*) FROM paper_versions
UNION ALL SELECT 'reviewer assignments', count(*) FROM reviewer_assignments
UNION ALL SELECT 'reviews', count(*) FROM reviews
UNION ALL SELECT 'author responses', count(*) FROM rebuttals
UNION ALL SELECT 'decisions', count(*) FROM decisions
UNION ALL SELECT 'registrations', count(*) FROM registrations
UNION ALL SELECT 'payments', count(*) FROM payments
UNION ALL SELECT 'invoices', count(*) FROM invoices
UNION ALL SELECT 'student verifications', count(*) FROM student_verifications
UNION ALL SELECT 'reviewer invitations', count(*) FROM reviewer_invitations
UNION ALL SELECT 'outreach campaigns', count(*) FROM outreach_campaigns
UNION ALL SELECT 'outreach recipients', count(*) FROM outreach_recipients
UNION ALL SELECT 'conference updates', count(*) FROM conference_updates
UNION ALL SELECT 'integration calls logged', count(*) FROM api_integration_access_logs
UNION ALL SELECT 'bids', count(*) FROM bids
UNION ALL SELECT 'conflict declarations', count(*) FROM conflicts_of_interest
UNION ALL SELECT 'tracks', count(*) FROM tracks;
