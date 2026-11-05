ALTER TABLE public.conference_updates DROP CONSTRAINT conference_updates_kind_check;
ALTER TABLE public.conference_updates ADD CONSTRAINT conference_updates_kind_check CHECK (kind IN ('PAPER_SUBMITTED','PAPER_WITHDRAWN','PAPER_REVISED','INVITATION_ACCEPTED','INVITATION_DECLINED','REVIEW_SUBMITTED','REVIEW_UPDATED','REBUTTAL_SUBMITTED','REBUTTAL_UPDATED'));

CREATE FUNCTION public.app_capture_revision_update() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW."roundNumber">1 AND EXISTS (
   SELECT 1 FROM public.review_rounds r JOIN public.decisions d ON d."roundId"=r.id
   WHERE r."paperId"=NEW."paperId" AND r."roundNumber"=NEW."roundNumber"-1
   AND d.outcome IN ('MINOR_REVISION','MAJOR_REVISION')
 ) THEN
   INSERT INTO public.conference_updates("organizationId","conferenceId",kind,"sourceId","sourceVersion",message,subject,"paperId","roundId")
   SELECT NEW."organizationId",NEW."conferenceId",'PAPER_REVISED',NEW.id,0,'Revised manuscript submitted.',concat_ws(' · ',p."submissionNumber",p.title),p.id,NEW.id
   FROM public.papers p WHERE p.id=NEW."paperId"
   ON CONFLICT(kind,"sourceId","sourceVersion") DO NOTHING;
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.app_capture_revision_update() FROM PUBLIC;
CREATE TRIGGER conference_update_revision AFTER INSERT ON public.review_rounds FOR EACH ROW EXECUTE FUNCTION public.app_capture_revision_update();

INSERT INTO notification_templates (id,"organizationId",key,version,locale,subject,"bodyHtml","bodyText",variables,"isActive","createdAt","updatedAt") SELECT gen_random_uuid(),NULL,'revision.confirmed',1,'en',$revision$Revised manuscript received: {{submissionNumber}}$revision$,$revision$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Revised manuscript received</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e4e4e7;border-radius:10px;">
<tr><td style="padding:22px 28px 0;">
<p style="margin:0;font-size:12px;line-height:1.4;letter-spacing:0.1em;text-transform:uppercase;font-weight:600;color:#71717a;">{{conferenceName}}</p>
</td></tr>
<tr><td style="padding:14px 28px 26px;">
<h1 style="margin:0 0 18px;font-size:21px;line-height:1.35;font-weight:600;color:#18181b;">Revised manuscript received</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">Your revised manuscript has passed the file check and has been submitted for the next review cycle at {{conferenceName}}.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px;background:#fafafa;border:1px solid #e4e4e7;border-radius:8px;">
<tr><td style="padding:18px 20px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
<tr><td style="padding:0 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Paper ID</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{submissionNumber}}</p>
</td></tr>
<tr><td style="padding:12px 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Paper title</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{paperTitle}}</p>
</td></tr>
<tr><td style="padding:12px 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Corresponding author</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{authorName}}</p>
</td></tr>
</table>
</td></tr>
</table>



<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 16px;">
<tr><td style="background:#18181b;border-radius:6px;">
<a href="{{paperUrl}}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">View revised submission</a>
</td></tr>
</table>
<p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#71717a;word-break:break-all;">If the button does not work, paste this address into your browser:<br>{{paperUrl}}</p>


</td></tr>
</table>
<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This message was sent by {{conferenceName}}.</p>
<p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This is a system generated mail. For any queries contact: icamcds2026@fresi.org</p>
</td></tr>
</table>
</body>
</html>$revision$,$revision${{conferenceName}}

Revised manuscript received

Your revised manuscript has passed the file check and has been submitted for the next review cycle at {{conferenceName}}.

Paper ID: {{submissionNumber}}
Paper title: {{paperTitle}}
Corresponding author: {{authorName}}

View revised submission: {{paperUrl}}

This message was sent by {{conferenceName}}.

This is a system generated mail. For any queries contact: icamcds2026@fresi.org$revision$,'["conferenceName","submissionNumber","paperTitle","authorName","paperUrl"]'::jsonb,true,now(),now() WHERE NOT EXISTS (SELECT 1 FROM notification_templates WHERE key='revision.confirmed' AND "organizationId" IS NULL);

INSERT INTO notification_templates (id,"organizationId",key,version,locale,subject,"bodyHtml","bodyText",variables,"isActive","createdAt","updatedAt") SELECT gen_random_uuid(),NULL,'revision.ops_alert',1,'en',$revision$Revised manuscript submitted: {{submissionNumber}}$revision$,$revision$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Revised manuscript submitted</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e4e4e7;border-radius:10px;">
<tr><td style="padding:22px 28px 0;">
<p style="margin:0;font-size:12px;line-height:1.4;letter-spacing:0.1em;text-transform:uppercase;font-weight:600;color:#71717a;">{{conferenceName}}</p>
</td></tr>
<tr><td style="padding:14px 28px 26px;">
<h1 style="margin:0 0 18px;font-size:21px;line-height:1.35;font-weight:600;color:#18181b;">Revised manuscript submitted</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">A revised manuscript has passed the file check. Assign reviewers for the next review cycle.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px;background:#fafafa;border:1px solid #e4e4e7;border-radius:8px;">
<tr><td style="padding:18px 20px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
<tr><td style="padding:0 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Paper ID</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{submissionNumber}}</p>
</td></tr>
<tr><td style="padding:12px 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Paper title</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{paperTitle}}</p>
</td></tr>
<tr><td style="padding:12px 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Corresponding author</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{authorName}}</p>
</td></tr>
</table>
</td></tr>
</table>



<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 16px;">
<tr><td style="background:#18181b;border-radius:6px;">
<a href="{{paperUrl}}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">View revised submission</a>
</td></tr>
</table>
<p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#71717a;word-break:break-all;">If the button does not work, paste this address into your browser:<br>{{paperUrl}}</p>


</td></tr>
</table>
<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This message was sent by {{conferenceName}}.</p>
<p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This is a system generated mail. For any queries contact: icamcds2026@fresi.org</p>
</td></tr>
</table>
</body>
</html>$revision$,$revision${{conferenceName}}

Revised manuscript submitted

A revised manuscript has passed the file check. Assign reviewers for the next review cycle.

Paper ID: {{submissionNumber}}
Paper title: {{paperTitle}}
Corresponding author: {{authorName}}

View revised submission: {{paperUrl}}

This message was sent by {{conferenceName}}.

This is a system generated mail. For any queries contact: icamcds2026@fresi.org$revision$,'["conferenceName","submissionNumber","paperTitle","authorName","paperUrl"]'::jsonb,true,now(),now() WHERE NOT EXISTS (SELECT 1 FROM notification_templates WHERE key='revision.ops_alert' AND "organizationId" IS NULL);
