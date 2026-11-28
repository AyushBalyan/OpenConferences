-- Settings audit: what conferences really hold.
-- Run with: infra/redesign/audit/snapshot.sh run infra/redesign/audit/settings.sql
-- Conferences are numbered by creation order. No names, people or papers are selected.

\pset format unaligned
\pset fieldsep ' | '
\pset footer off

\echo '== 1. Conferences: typed settings, dates that are set, and size'
SELECT
  row_number() OVER (ORDER BY c."createdAt") AS n,
  dense_rank() OVER (ORDER BY c."organizationId") AS org,
  c.status,
  c."blindingMode" AS blinding,
  c."invitationLifetimeDays" AS invite_days,
  (c."deletedAt" IS NOT NULL) AS deleted,
  concat_ws(',',
    CASE WHEN c."cfpOpensAt" IS NOT NULL THEN 'cfpOpens' END,
    CASE WHEN c."cfpClosesAt" IS NOT NULL THEN 'cfpCloses' END,
    CASE WHEN c."biddingOpensAt" IS NOT NULL THEN 'biddingOpens' END,
    CASE WHEN c."biddingClosesAt" IS NOT NULL THEN 'biddingCloses' END,
    CASE WHEN c."reviewDueAt" IS NOT NULL THEN 'reviewDue' END,
    CASE WHEN c."rebuttalDueAt" IS NOT NULL THEN 'rebuttalDue' END,
    CASE WHEN c."decisionDueAt" IS NOT NULL THEN 'decisionDue' END,
    CASE WHEN c."cameraReadyDueAt" IS NOT NULL THEN 'cameraReadyDue' END,
    CASE WHEN c."registrationDueAt" IS NOT NULL THEN 'registrationDue' END
  ) AS dates_set,
  (SELECT count(*) FROM tracks t WHERE t."conferenceId" = c.id) AS tracks,
  (SELECT count(*) FROM papers p WHERE p."conferenceId" = c.id) AS papers,
  (SELECT count(*) FROM reviews r WHERE r."conferenceId" = c.id) AS reviews,
  (SELECT count(*) FROM registrations g WHERE g."conferenceId" = c.id) AS registrations
FROM conferences c
ORDER BY c."createdAt";

\echo
\echo '== 2. reviewConfig and feeSchedule, as stored'
SELECT
  row_number() OVER (ORDER BY c."createdAt") AS n,
  c."reviewConfig" AS review_config,
  c."feeSchedule" AS fee_schedule
FROM conferences c
ORDER BY c."createdAt";

\echo
\echo '== 3. Keys in use, and how many conferences use each'
SELECT 'reviewConfig' AS col, k AS key, count(*) AS conferences
FROM conferences c, jsonb_object_keys(c."reviewConfig") AS k
GROUP BY k
UNION ALL
SELECT 'feeSchedule', k, count(*)
FROM conferences c, jsonb_object_keys(c."feeSchedule") AS k
GROUP BY k
ORDER BY 1, 2;

\echo
\echo '== 4. Registration deadline stored twice: do the two values agree?'
SELECT
  row_number() OVER (ORDER BY c."createdAt") AS n,
  c."registrationDueAt" AS column_value,
  c."feeSchedule" ->> 'registrationDeadlineAt' AS json_value
FROM conferences c
ORDER BY c."createdAt";

\echo
\echo '== 5. Score keys stored on reviews, per conference'
SELECT
  x.n,
  k AS score_key,
  count(*) AS reviews,
  min((r.scores ->> k)::numeric) AS min_score,
  max((r.scores ->> k)::numeric) AS max_score
FROM reviews r
JOIN (
  SELECT id, row_number() OVER (ORDER BY "createdAt") AS n FROM conferences
) x ON x.id = r."conferenceId",
jsonb_object_keys(r.scores) AS k
GROUP BY x.n, k
ORDER BY x.n, k;

\echo
\echo '== 6. Reviews: recommendation and confidence filled in?'
SELECT
  x.n,
  (r."submittedAt" IS NOT NULL) AS submitted,
  count(*) AS reviews,
  count(r.recommendation) AS with_recommendation,
  count(r.confidence) AS with_confidence
FROM reviews r
JOIN (
  SELECT id, row_number() OVER (ORDER BY "createdAt") AS n FROM conferences
) x ON x.id = r."conferenceId"
GROUP BY x.n, 2
ORDER BY x.n, 2;

\echo
\echo '== 7. Notification templates: platform defaults and organisation copies'
SELECT
  CASE WHEN "organizationId" IS NULL THEN 'platform' ELSE 'organisation copy' END AS scope,
  count(*) AS templates,
  count(DISTINCT key) AS keys
FROM notification_templates
GROUP BY 1
ORDER BY 1;

\echo
\echo '== 8. Organisation copies of notification templates, by key'
SELECT key, count(*) AS copies, max(version) AS version
FROM notification_templates
WHERE "organizationId" IS NOT NULL
GROUP BY key
ORDER BY key;

\echo
\echo '== 9. Templates that still contain hard-coded names or addresses'
SELECT
  'notification' AS kind,
  key,
  CASE WHEN "organizationId" IS NULL THEN 'platform' ELSE 'organisation copy' END AS scope,
  version,
  "isActive" AS active,
  (coalesce(subject, '') || coalesce("bodyHtml", '') || coalesce("bodyText", '')) ~* 'icamcds' AS names_conference,
  (coalesce(subject, '') || coalesce("bodyHtml", '') || coalesce("bodyText", '')) ~* 'fresi\.org' AS names_domain,
  (coalesce(subject, '') || coalesce("bodyHtml", '') || coalesce("bodyText", '')) ~* '(15|16|17).{0,12}December' AS names_dates
FROM notification_templates
WHERE (coalesce(subject, '') || coalesce("bodyHtml", '') || coalesce("bodyText", '')) ~* 'icamcds|fresi\.org|(15|16|17).{0,12}December'
ORDER BY key, scope, version;

\echo
\echo '== 9b. Outreach templates that contain hard-coded names or addresses'
SELECT
  key,
  version,
  "isActive" AS active,
  (coalesce(subject, '') || coalesce("bodyHtml", '') || coalesce("bodyText", '')) ~* 'icamcds' AS names_conference,
  (coalesce(subject, '') || coalesce("bodyHtml", '') || coalesce("bodyText", '')) ~* 'fresi\.org' AS names_domain
FROM outreach_templates
ORDER BY key, version;

\echo
\echo '== 10. Outreach templates by scope'
SELECT
  CASE
    WHEN "conferenceId" IS NOT NULL THEN 'conference'
    WHEN "organizationId" IS NOT NULL THEN 'organisation'
    ELSE 'platform'
  END AS scope,
  count(*) AS templates
FROM outreach_templates
GROUP BY 1
ORDER BY 1;

\echo
\echo '== 11. Memberships and role grants'
SELECT m.scope, g.role, count(*) AS grants
FROM memberships m
JOIN role_grants g ON g."membershipId" = m.id
GROUP BY m.scope, g.role
ORDER BY m.scope, g.role;

\echo
\echo '== 12. Users linked to an organisation without a membership row'
SELECT
  count(*) FILTER (WHERE "organizationId" IS NOT NULL) AS users_with_org_field,
  count(*) AS users
FROM users;

\echo
\echo '== 13. Per-registration overrides and student verification'
SELECT
  x.n,
  count(*) AS registrations,
  count(g."earlyBirdExtendedUntil") AS early_bird_extended,
  count(*) FILTER (WHERE g.audience = 'STUDENT') AS student
FROM registrations g
JOIN (
  SELECT id, row_number() OVER (ORDER BY "createdAt") AS n FROM conferences
) x ON x.id = g."conferenceId"
GROUP BY x.n
ORDER BY x.n;

\echo
\echo '== 14. Review rounds, bids and conflict declarations per conference'
SELECT
  x.n,
  (SELECT count(*) FROM review_rounds r WHERE r."conferenceId" = x.id) AS rounds,
  (SELECT count(*) FROM bids b WHERE b."conferenceId" = x.id) AS bids,
  (SELECT count(*) FROM conflicts_of_interest k WHERE k."conferenceId" = x.id) AS conflicts,
  (SELECT count(*) FROM rebuttals b WHERE b."conferenceId" = x.id) AS rebuttals,
  (SELECT count(*) FROM outreach_campaigns o WHERE o."conferenceId" = x.id) AS outreach_campaigns,
  (SELECT count(*) FROM api_integrations a WHERE a."conferenceId" = x.id) AS integrations,
  (
    SELECT count(*)
    FROM student_verifications s
    JOIN registrations g ON g.id = s."registrationId"
    WHERE g."conferenceId" = x.id
  ) AS student_verifications,
  (SELECT count(*) FROM reviewer_reminder_digests d WHERE d."conferenceId" = x.id) AS reminder_digests
FROM (
  SELECT id, row_number() OVER (ORDER BY "createdAt") AS n FROM conferences
) x
ORDER BY x.n;
