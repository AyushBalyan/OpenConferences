-- Add the combined acceptance and registration template; preserve organizer overrides.
INSERT INTO notification_templates (id, "organizationId", key, version, locale, subject, "bodyHtml", "bodyText", variables, "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid(), NULL, 'decision.accepted', 2, 'en', $acceptance$Paper accepted — {{submissionNumber}} | {{conferenceName}}$acceptance$, $acceptance$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Manuscript accepted for presentation</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e4e4e7;border-radius:10px;">
<tr><td style="padding:22px 28px 0;">
<p style="margin:0;font-size:12px;line-height:1.4;letter-spacing:0.1em;text-transform:uppercase;font-weight:600;color:#71717a;">{{conferenceName}}</p>
</td></tr>
<tr><td style="padding:14px 28px 26px;">
<h1 style="margin:0 0 18px;font-size:21px;line-height:1.35;font-weight:600;color:#18181b;">Manuscript accepted for presentation</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">Dear Dr {{authorName}},</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">We are pleased to inform you that your manuscript has been <strong>accepted for presentation</strong> at <em>{{conferenceName}}</em>, scheduled to be held online from <strong>15–17 December 2026</strong>.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px;background:#fafafa;border:1px solid #e4e4e7;border-radius:8px;">
<tr><td style="padding:18px 20px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
<tr><td style="padding:0 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">PaperID</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{submissionNumber}}</p>
</td></tr>
<tr><td style="padding:12px 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Paper Title</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{paperTitle}}</p>
</td></tr>
</table>
</td></tr>
</table>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">Congratulations on this achievement!</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">For all accepted manuscripts, at least one author must register for the conference to present the paper and ensure its further consideration for inclusion in the conference proceedings.</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">For registration and further details, kindly log in to your account using the link provided below:</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;"><strong>Login Link:</strong></p>


<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 16px;">
<tr><td style="background:#18181b;border-radius:6px;">
<a href="{{registrationUrl}}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">Login to registration</a>
</td></tr>
</table>
<p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#71717a;word-break:break-all;">If the button does not work, paste this address into your browser:<br>{{registrationUrl}}</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">If the above link does not open directly, please copy and paste it into your web browser. Alternatively, you may access your account through the <strong>Registration</strong> tab on the conference website.</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">If you encounter any difficulty accessing your account or retrieving your details, please feel free to reply to this email. We will be happy to assist you.</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">Further details regarding the presentation schedule and other relevant instructions will be communicated to you in due course.</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">We look forward to your active participation in {{conferenceName}}.</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">Best regards,<br>Organizing Committee<br>{{conferenceName}}</p>

</td></tr>
</table>
<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This message was sent by {{conferenceName}}.</p>
<p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This is a system generated mail. For any queries contact: icamcds2026@fresi.org</p>
</td></tr>
</table>
</body>
</html>$acceptance$, $acceptance${{conferenceName}}

Manuscript accepted for presentation

Dear Dr {{authorName}},

We are pleased to inform you that your manuscript has been accepted for presentation at {{conferenceName}}, scheduled to be held online from 15–17 December 2026.

PaperID: {{submissionNumber}}
Paper Title: {{paperTitle}}

Congratulations on this achievement!

For all accepted manuscripts, at least one author must register for the conference to present the paper and ensure its further consideration for inclusion in the conference proceedings.

For registration and further details, kindly log in to your account using the link provided below:

Login Link:

Login to registration: {{registrationUrl}}

If the above link does not open directly, please copy and paste it into your web browser. Alternatively, you may access your account through the Registration tab on the conference website.

If you encounter any difficulty accessing your account or retrieving your details, please feel free to reply to this email. We will be happy to assist you.

Further details regarding the presentation schedule and other relevant instructions will be communicated to you in due course.

We look forward to your active participation in {{conferenceName}}.

Best regards,
Organizing Committee
{{conferenceName}}

This message was sent by {{conferenceName}}.

This is a system generated mail. For any queries contact: icamcds2026@fresi.org$acceptance$, $acceptance$["authorName","conferenceName","submissionNumber","paperTitle","registrationUrl"]$acceptance$::jsonb, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM notification_templates WHERE "organizationId" IS NULL AND key = 'decision.accepted' AND version = 2);
