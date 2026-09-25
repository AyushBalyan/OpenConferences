UPDATE "notification_templates"
SET
  "subject" = $letter$Review request: {{paperTitle}}$letter$,
  "bodyHtml" = $letter$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Dear Prof. {{reviewerName}}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e4e4e7;border-radius:10px;">
<tr><td style="padding:22px 28px 0;">
<p style="margin:0;font-size:12px;line-height:1.4;letter-spacing:0.1em;text-transform:uppercase;font-weight:600;color:#71717a;">{{conferenceName}}</p>
</td></tr>
<tr><td style="padding:14px 28px 26px;">
<h1 style="margin:0 0 18px;font-size:21px;line-height:1.35;font-weight:600;color:#18181b;">Dear Prof. {{reviewerName}}</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">Thank you for serving as a member of the Technical Programme Committee of the conference {{conferenceName}}.</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">We would be grateful if you could review the assigned conference paper "<strong>{{paperTitle}}</strong>".</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">You are kindly requested to complete the review and submit your comments/recommendations within <strong>7 days</strong> of receiving this email.</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">Your valuable feedback will help us ensure the quality of the conference programme and assist the authors in improving their work.</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">Thank you for your time and valuable contribution to the conference.</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">You can access the review portal by going on the given link: <a href="https://app.fresi.org/me/dashboard">View Review Portal</a></p>

<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">With regards,</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">Organizing Committee</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">({{conferenceName}})</p>




</td></tr>
</table>
<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This message was sent by {{conferenceName}}.</p>
<p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This is a system generated mail. For any queries contact: icamcds2026@fresi.org</p>
</td></tr>
</table>
</body>
</html>$letter$,
  "bodyText" = $letter${{conferenceName}}

Dear Prof. {{reviewerName}}

Thank you for serving as a member of the Technical Programme Committee of the conference {{conferenceName}}.

We would be grateful if you could review the assigned conference paper "{{paperTitle}}".

You are kindly requested to complete the review and submit your comments/recommendations within 7 days of receiving this email.

Your valuable feedback will help us ensure the quality of the conference programme and assist the authors in improving their work.

Thank you for your time and valuable contribution to the conference.

You can access the review portal by going on the given link: View Review Portal <https://app.fresi.org/me/dashboard>

With regards,

Organizing Committee

({{conferenceName}})

This message was sent by {{conferenceName}}.

This is a system generated mail. For any queries contact: icamcds2026@fresi.org$letter$,
  "variables" = '["reviewerName","paperTitle","conferenceName"]'::jsonb,
  "isActive" = true
WHERE "key" = 'assignment.notified' AND "organizationId" IS NULL;
