-- Replace the event-date clause in platform acceptance templates only.
-- Rendered sent emails and organizer-customized templates remain historical.
UPDATE notification_templates SET
 "bodyHtml"=replace("bodyHtml", $acceptance$scheduled to be held online from <strong>15–17 December 2026</strong>$acceptance$, $acceptance$subject to the incorporation of reviewers’ comments$acceptance$),
 "bodyText"=replace("bodyText", $acceptance$scheduled to be held online from 15–17 December 2026$acceptance$, $acceptance$subject to the incorporation of reviewers’ comments$acceptance$),
 "updatedAt"=now()
WHERE key='decision.accepted' AND "organizationId" IS NULL;
