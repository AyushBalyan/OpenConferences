-- Platform template: submission.ops_alert (ops email on every paper submission)
INSERT INTO "notification_templates" (
  "id", "organizationId", "key", "version", "locale", "subject", "bodyHtml", "bodyText", "variables", "isActive", "createdAt", "updatedAt"
)
SELECT
  'a2000001-0000-4000-8000-000000000019',
  NULL,
  'submission.ops_alert',
  2,
  'en',
  'New submission: {{paperTitle}} ({{conferenceName}})',
  $html$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>New paper submission</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">A paper was submitted to {{conferenceName}}.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
<tr><td style="padding:28px 32px 20px;border-bottom:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#4f46e5;">OpenConferences</p>
<h1 style="margin:12px 0 0;font-size:22px;line-height:1.35;color:#0f172a;font-weight:700;">New paper submission</h1>
</td></tr>
<tr><td style="padding:28px 32px;">
<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">A paper was submitted to {{conferenceName}}.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;"><tr><td style="padding:12px 16px;"><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Conference</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{conferenceName}}</td></tr><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Paper title</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{paperTitle}}</td></tr><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Corresponding author</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{authorEmail}}</td></tr></td></tr></table>

<table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px 0 8px;"><tr><td style="border-radius:8px;background:#4f46e5;"><a href="{{paperUrl}}" style="display:inline-block;padding:13px 28px;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">View submission</a></td></tr></table>
<p style="margin:16px 0 0;font-size:13px;line-height:1.55;color:#64748b;">This is an operations alert for every new submission.</p>
</td></tr>
<tr><td style="padding:18px 32px;background:#f8fafc;border-top:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;">Automated message from OpenConferences. Please do not reply to this email.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>$html$,
  $text$New paper submission

A paper was submitted to {{conferenceName}}.

Conference: {{conferenceName}}
Paper title: {{paperTitle}}
Corresponding author: {{authorEmail}}

View submission: {{paperUrl}}

This is an operations alert for every new submission.

— OpenConferences$text$,
  '["paperTitle", "conferenceName", "authorEmail", "paperUrl"]'::jsonb,
  true,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "notification_templates"
  WHERE "organizationId" IS NULL AND "key" = 'submission.ops_alert' AND "version" = 2
);
