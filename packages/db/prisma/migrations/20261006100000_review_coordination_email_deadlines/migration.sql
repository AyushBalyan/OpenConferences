-- Update platform defaults only; organization-specific templates retain their content.
UPDATE "notification_templates"
SET "subject" = $review_mail$Review request: {{paperTitle}}$review_mail$,
    "bodyHtml" = $review_mail$<!DOCTYPE html>
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
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">Please complete the review and submit your comments/recommendations by <strong>{{dueAt}}</strong> (UTC).</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">Your valuable feedback will help us ensure the quality of the conference programme and assist the authors in improving their work.</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">Thank you for your time and valuable contribution to the conference.</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">You can access the review portal by going on the given link: <a href="{{reviewUrl}}">View Review Portal</a></p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">This manuscript is confidential and is shared with you only for review. Please do not copy, forward, or discuss it with anyone outside the review, and do not use its unpublished ideas in your own work. Kindly review the file as received, without altering it.</p>

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
</html>$review_mail$,
    "bodyText" = $review_mail${{conferenceName}}

Dear Prof. {{reviewerName}}

Thank you for serving as a member of the Technical Programme Committee of the conference {{conferenceName}}.

We would be grateful if you could review the assigned conference paper "{{paperTitle}}".

Please complete the review and submit your comments/recommendations by {{dueAt}} (UTC).

Your valuable feedback will help us ensure the quality of the conference programme and assist the authors in improving their work.

Thank you for your time and valuable contribution to the conference.

You can access the review portal by going on the given link: View Review Portal <{{reviewUrl}}>

This manuscript is confidential and is shared with you only for review. Please do not copy, forward, or discuss it with anyone outside the review, and do not use its unpublished ideas in your own work. Kindly review the file as received, without altering it.

With regards,

Organizing Committee

({{conferenceName}})

This message was sent by {{conferenceName}}.

This is a system generated mail. For any queries contact: icamcds2026@fresi.org$review_mail$,
    "variables" = '["reviewerName","paperTitle","conferenceName","dueAt","reviewUrl"]'::jsonb,
    "updatedAt" = NOW()
WHERE "key" = 'assignment.notified' AND "organizationId" IS NULL AND "isActive" = true;

UPDATE "notification_templates"
SET "subject" = $review_mail$Review reminder: {{paperTitle}}$review_mail$,
    "bodyHtml" = $review_mail$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Review reminder</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e4e4e7;border-radius:10px;">
<tr><td style="padding:22px 28px 0;">
<p style="margin:0;font-size:12px;line-height:1.4;letter-spacing:0.1em;text-transform:uppercase;font-weight:600;color:#71717a;">{{conferenceName}}</p>
</td></tr>
<tr><td style="padding:14px 28px 26px;">
<h1 style="margin:0 0 18px;font-size:21px;line-height:1.35;font-weight:600;color:#18181b;">Review reminder</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">This is a reminder to complete your review for {{conferenceName}}.</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">Your current deadline is shown below. If it has passed, please submit your review or contact the chair.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px;background:#fafafa;border:1px solid #e4e4e7;border-radius:8px;">
<tr><td style="padding:18px 20px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
<tr><td style="padding:0 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Paper</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{paperTitle}}</p>
</td></tr>
<tr><td style="padding:12px 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Due date</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{dueAt}}</p>
</td></tr>
</table>
</td></tr>
</table>



<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 16px;">
<tr><td style="background:#18181b;border-radius:6px;">
<a href="{{reviewUrl}}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">Open review assignments</a>
</td></tr>
</table>
<p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#71717a;word-break:break-all;">If the button does not work, paste this address into your browser:<br>{{reviewUrl}}</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:4px 0 0;">
<tr><td style="padding:16px 0 0;border-top:1px solid #e4e4e7;">
<p style="margin:0;font-size:13px;line-height:1.6;color:#71717a;">Late reviews may delay editorial decisions for authors.</p>
</td></tr>
</table>
</td></tr>
</table>
<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This message was sent by {{conferenceName}}.</p>
<p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This is a system generated mail. For any queries contact: icamcds2026@fresi.org</p>
</td></tr>
</table>
</body>
</html>$review_mail$,
    "bodyText" = $review_mail${{conferenceName}}

Review reminder

This is a reminder to complete your review for {{conferenceName}}.

Your current deadline is shown below. If it has passed, please submit your review or contact the chair.

Paper: {{paperTitle}}
Due date: {{dueAt}}

Open review assignments: {{reviewUrl}}

Late reviews may delay editorial decisions for authors.

This message was sent by {{conferenceName}}.

This is a system generated mail. For any queries contact: icamcds2026@fresi.org$review_mail$,
    "variables" = '["paperTitle","dueAt","conferenceName","reviewUrl"]'::jsonb,
    "updatedAt" = NOW()
WHERE "key" = 'review.reminder' AND "organizationId" IS NULL AND "isActive" = true;
