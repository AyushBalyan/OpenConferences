-- Drop track, keywords, and abstract from submission.confirmed.

UPDATE "notification_templates"
SET
  "subject" = $trim$Submission received: {{paperTitle}}$trim$,
  "bodyHtml" = $trim$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Submission confirmed</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e4e4e7;border-radius:10px;">
<tr><td style="padding:22px 28px 0;">
<p style="margin:0;font-size:12px;line-height:1.4;letter-spacing:0.1em;text-transform:uppercase;font-weight:600;color:#71717a;">{{conferenceName}}</p>
</td></tr>
<tr><td style="padding:14px 28px 26px;">
<h1 style="margin:0 0 18px;font-size:21px;line-height:1.35;font-weight:600;color:#18181b;">Submission confirmed</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">Your paper has been received for {{conferenceName}}.</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">Please keep this message as a record of the submission.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px;background:#fafafa;border:1px solid #e4e4e7;border-radius:8px;">
<tr><td style="padding:18px 20px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
<tr><td style="padding:0 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Paper</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{paperTitle}}</p>
</td></tr>
<tr><td style="padding:12px 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Corresponding author</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{authorName}}</p>
</td></tr>
<tr><td style="padding:12px 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Email</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{authorEmail}}</p>
</td></tr>
<tr><td style="padding:12px 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Affiliation</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{authorAffiliation}}</p>
</td></tr>
<tr><td style="padding:12px 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Authors</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{authorList}}</p>
</td></tr>
</table>
</td></tr>
</table>



<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:4px 0 0;">
<tr><td style="padding:16px 0 0;border-top:1px solid #e4e4e7;">
<p style="margin:0;font-size:13px;line-height:1.6;color:#71717a;">You will receive further updates by email as this submission moves through review.</p>
</td></tr>
</table>
</td></tr>
</table>
<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This message was sent by {{conferenceName}}.</p>
</td></tr>
</table>
</body>
</html>$trim$,
  "bodyText" = $trim${{conferenceName}}

Submission confirmed

Your paper has been received for {{conferenceName}}.

Please keep this message as a record of the submission.

Paper: {{paperTitle}}
Corresponding author: {{authorName}}
Email: {{authorEmail}}
Affiliation: {{authorAffiliation}}
Authors: {{authorList}}

You will receive further updates by email as this submission moves through review.

This message was sent by {{conferenceName}}.$trim$,
  "variables" = '["paperTitle","conferenceName","authorName","authorEmail","authorAffiliation","authorList"]'::jsonb,
  "isActive" = true,
  "updatedAt" = NOW()
WHERE "organizationId" IS NULL AND "key" = 'submission.confirmed' AND "version" = 2;
