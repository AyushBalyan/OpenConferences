-- The acceptance letter now carries the committee's note when one was written.
-- Templates customised by an organisation are left as they are.
UPDATE "notification_templates" SET
  "bodyHtml" = $tpl$<!DOCTYPE html>
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
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">Dear {{authorName}},</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">We are pleased to inform you that your manuscript has been <strong>accepted for presentation</strong> at <em>{{conferenceName}}</em>, subject to the incorporation of reviewers’ comments, if any.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px;background:#fafafa;border:1px solid #e4e4e7;border-radius:8px;">
<tr><td style="padding:18px 20px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
<tr><td style="padding:0 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Paper ID</p>
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
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">{{rationaleBlock}}</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">For all accepted manuscripts, at least one author must register for the conference to present the paper and ensure its further consideration for inclusion in the conference proceedings.</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">Please ensure that your camera-ready manuscript follows the conference manuscript format and incorporates the reviewers’ suggestions, if any.</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">For registration and further details, kindly log in to your account using the link provided below:</p>


<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 16px;">
<tr><td style="background:#18181b;border-radius:6px;">
<a href="{{registrationUrl}}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">Login to registration</a>
</td></tr>
</table>
<p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#71717a;word-break:break-all;">If the button does not work, paste this address into your browser:<br>{{registrationUrl}}</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">You may also access your account through the <strong>Registration</strong> tab on the conference website.</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">If you encounter any difficulty accessing your account or retrieving your details, please feel free to reply to this email. We will be happy to assist you.</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">Further details regarding the presentation schedule and other relevant instructions will be communicated to you in due course.</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">We look forward to your active participation in {{conferenceName}}.</p>
<p style="margin:0;font-size:15px;line-height:1.65;color:#52525b;">Best regards,<br>Organising Committee<br>{{conferenceName}}</p>

</td></tr>
</table>
<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This message was sent by {{conferenceName}}.</p>
<p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This is a system generated mail. For any queries contact: {{contactEmail}}</p>
</td></tr>
</table>
</body>
</html>$tpl$,
  "bodyText" = $tpl${{conferenceName}}

Manuscript accepted for presentation

Dear {{authorName}},

We are pleased to inform you that your manuscript has been accepted for presentation at {{conferenceName}}, subject to the incorporation of reviewers’ comments, if any.

Paper ID: {{submissionNumber}}
Paper Title: {{paperTitle}}

Congratulations on this achievement!

{{rationaleBlock}}

For all accepted manuscripts, at least one author must register for the conference to present the paper and ensure its further consideration for inclusion in the conference proceedings.

Please ensure that your camera-ready manuscript follows the conference manuscript format and incorporates the reviewers’ suggestions, if any.

For registration and further details, kindly log in to your account using the link provided below:

Login to registration: {{registrationUrl}}

You may also access your account through the Registration tab on the conference website.

If you encounter any difficulty accessing your account or retrieving your details, please feel free to reply to this email. We will be happy to assist you.

Further details regarding the presentation schedule and other relevant instructions will be communicated to you in due course.

We look forward to your active participation in {{conferenceName}}.

Best regards,
Organising Committee
{{conferenceName}}

This message was sent by {{conferenceName}}.

This is a system generated mail. For any queries contact: {{contactEmail}}$tpl$,
  "variables" = $tpl$["authorName","conferenceName","submissionNumber","paperTitle","rationaleBlock","registrationUrl","contactEmail"]$tpl$::jsonb,
  "updatedAt" = now()
WHERE "key" = 'decision.accepted' AND "organizationId" IS NULL;
