CREATE TABLE public.reviewer_reminder_digests (
  id uuid PRIMARY KEY, "organizationId" uuid NOT NULL REFERENCES public.organizations(id),
  "conferenceId" uuid NOT NULL REFERENCES public.conferences(id), "reviewerUserId" uuid NOT NULL REFERENCES public.users(id),
  "requestedById" uuid NOT NULL REFERENCES public.users(id), "requestId" uuid NOT NULL UNIQUE,
  "utcDay" text NOT NULL, status text NOT NULL DEFAULT 'PREPARING' CHECK (status IN ('PREPARING','QUEUED','SUPPRESSED','CANCELLED','FAILED')),
  snapshot jsonb NOT NULL, "cancelledSnapshots" jsonb NOT NULL DEFAULT '[]', "notificationLogId" uuid REFERENCES public.notification_logs(id),
  error text, "createdAt" timestamp(3) NOT NULL DEFAULT now(), "updatedAt" timestamp(3) NOT NULL DEFAULT now(),
  UNIQUE ("conferenceId", "reviewerUserId", "utcDay")
);
CREATE INDEX reviewer_reminder_digests_conference_day_idx ON public.reviewer_reminder_digests("conferenceId", "utcDay");
GRANT SELECT, INSERT, UPDATE ON public.reviewer_reminder_digests TO openconferences_api, openconferences_worker;
ALTER TABLE public.reviewer_reminder_digests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviewer_reminder_digests FORCE ROW LEVEL SECURITY;
CREATE POLICY reviewer_digest_api ON public.reviewer_reminder_digests FOR ALL TO openconferences_api
USING (public.app_conference_context_matches("conferenceId") AND EXISTS (
 SELECT 1 FROM public.conferences c JOIN public.memberships m ON m."organizationId"=c."organizationId"
 JOIN public.role_grants g ON g."membershipId"=m.id
 WHERE c.id=reviewer_reminder_digests."conferenceId" AND c."organizationId"=reviewer_reminder_digests."organizationId"
 AND m."userId"::text=public.app_current_user_id() AND (
 (m.scope='CONFERENCE' AND m."conferenceId"=c.id AND g.role IN ('ORGANIZER','CHAIR')) OR
 (m.scope='ORGANIZATION' AND g.role='ORG_ADMIN')
 )
)) WITH CHECK (public.app_conference_context_matches("conferenceId") AND EXISTS (
 SELECT 1 FROM public.conferences c JOIN public.memberships m ON m."organizationId"=c."organizationId"
 JOIN public.role_grants g ON g."membershipId"=m.id
 WHERE c.id=reviewer_reminder_digests."conferenceId" AND c."organizationId"=reviewer_reminder_digests."organizationId"
 AND m."userId"::text=public.app_current_user_id() AND (
 (m.scope='CONFERENCE' AND m."conferenceId"=c.id AND g.role IN ('ORGANIZER','CHAIR')) OR
 (m.scope='ORGANIZATION' AND g.role='ORG_ADMIN')
 )
));
CREATE POLICY reviewer_digest_worker ON public.reviewer_reminder_digests FOR ALL TO openconferences_worker USING (true) WITH CHECK (true);
-- Workers need the same row locks as review submission, but no general cycle UPDATE privilege.
CREATE FUNCTION public.app_lock_digest_cycles(conf_id uuid, cycle_ids uuid[]) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM id FROM public.review_rounds WHERE "conferenceId"=conf_id AND id=ANY(cycle_ids) ORDER BY id FOR UPDATE;
END; $$;
REVOKE ALL ON FUNCTION public.app_lock_digest_cycles(uuid,uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_lock_digest_cycles(uuid,uuid[]) TO openconferences_worker;

INSERT INTO public.notification_templates (id,key,version,subject,"bodyHtml","bodyText",variables,"isActive","updatedAt") SELECT gen_random_uuid(),'reviewer.reminder_digest',2,'Review reminder: {{conferenceName}}','<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Your outstanding reviews</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e4e4e7;border-radius:10px;">

<tr><td style="padding:14px 28px 26px;">
<h1 style="margin:0 0 18px;font-size:21px;line-height:1.35;font-weight:600;color:#18181b;">Your outstanding reviews</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">Hello {{reviewerName}},</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">The organisers of {{conferenceName}} have requested an update on these reviews. Each assignment has its own deadline.</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">{{reviewItems}}</p>




<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 16px;">
<tr><td style="background:#18181b;border-radius:6px;">
<a href="{{reviewUrl}}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">Open your reviews</a>
</td></tr>
</table>
<p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#71717a;word-break:break-all;">If the button does not work, paste this address into your browser:<br>{{reviewUrl}}</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:4px 0 0;">
<tr><td style="padding:16px 0 0;border-top:1px solid #e4e4e7;">
<p style="margin:0;font-size:13px;line-height:1.6;color:#71717a;">Deadlines below are shown in UTC. Please contact the organisers if you need an extension.</p>
</td></tr>
</table>
</td></tr>
</table>
<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This message was sent by {{conferenceName}}.</p>
<p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This is a system generated mail. For any queries contact: icamcds2026@fresi.org</p>
</td></tr>
</table>
</body>
</html>','{{conferenceName}}

Your outstanding reviews

Hello {{reviewerName}},

The organisers of {{conferenceName}} have requested an update on these reviews. Each assignment has its own deadline.

{{reviewItems}}

Open your reviews: {{reviewUrl}}

Deadlines below are shown in UTC. Please contact the organisers if you need an extension.

This message was sent by {{conferenceName}}.

This is a system generated mail. For any queries contact: icamcds2026@fresi.org','["conferenceName","reviewerName","reviewItems","reviewUrl"]'::jsonb,true,now() WHERE NOT EXISTS (SELECT 1 FROM public.notification_templates WHERE "organizationId" IS NULL AND key='reviewer.reminder_digest');

-- Runtime roles cannot erase daily reservations or their audit snapshots.
REVOKE DELETE ON public.reviewer_reminder_digests FROM openconferences_api, openconferences_worker;
CREATE POLICY reviewer_digest_platform ON public.reviewer_reminder_digests FOR ALL TO openconferences_api
USING (public.app_is_platform_admin() AND public.app_conference_context_matches("conferenceId") AND EXISTS (
 SELECT 1 FROM public.conferences c WHERE c.id=reviewer_reminder_digests."conferenceId" AND c."organizationId"=reviewer_reminder_digests."organizationId"
)) WITH CHECK (public.app_is_platform_admin() AND public.app_conference_context_matches("conferenceId") AND EXISTS (
 SELECT 1 FROM public.conferences c WHERE c.id=reviewer_reminder_digests."conferenceId" AND c."organizationId"=reviewer_reminder_digests."organizationId"
));
