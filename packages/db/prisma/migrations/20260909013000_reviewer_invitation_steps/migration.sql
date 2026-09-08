-- Add simple accept instructions to reviewer.invitation.

UPDATE "notification_templates"
SET
  "subject" = $steps$Reviewer invitation for {{conferenceName}}$steps$,
  "bodyHtml" = $steps$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Reviewer invitation</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e4e4e7;border-radius:10px;">
<tr><td style="padding:22px 28px 0;">
<p style="margin:0;font-size:12px;line-height:1.4;letter-spacing:0.1em;text-transform:uppercase;font-weight:600;color:#71717a;">{{conferenceName}}</p>
</td></tr>
<tr><td style="padding:14px 28px 26px;">
<h1 style="margin:0 0 18px;font-size:21px;line-height:1.35;font-weight:600;color:#18181b;">Reviewer invitation</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">Dear colleague,</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">You have been invited to serve as a reviewer for {{conferenceName}}. The program organizers would value your expertise in evaluating submissions for this conference.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px;background:#fafafa;border:1px solid #e4e4e7;border-radius:8px;">
<tr><td style="padding:18px 20px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
<tr><td style="padding:0 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Expires</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{expiresAt}}</p>
</td></tr>
</table>
</td></tr>
</table>

<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px;background:#fafafa;border:1px solid #e4e4e7;border-radius:8px;">
<tr><td style="padding:18px 20px;">
<p style="margin:0 0 12px;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">How to accept</p>
<p style="margin:0 0 0;font-size:15px;line-height:1.55;color:#18181b;"><span style="color:#71717a;">1.</span> Open the invitation link below.</p>
<p style="margin:10px 0 0;font-size:15px;line-height:1.55;color:#18181b;"><span style="color:#71717a;">2.</span> Sign in with the same email address that received this message. If you are new, you will be asked to choose a name and password.</p>
<p style="margin:10px 0 0;font-size:15px;line-height:1.55;color:#18181b;"><span style="color:#71717a;">3.</span> After you accept, you can bid on papers and declare any conflicts of interest.</p>
</td></tr>
</table>

<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 16px;">
<tr><td style="background:#18181b;border-radius:6px;">
<a href="{{signupUrl}}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">Accept invitation</a>
</td></tr>
</table>
<p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#71717a;word-break:break-all;">If the button does not work, paste this address into your browser:<br>{{signupUrl}}</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:4px 0 0;">
<tr><td style="padding:16px 0 0;border-top:1px solid #e4e4e7;">
<p style="margin:0;font-size:13px;line-height:1.6;color:#71717a;">If you were not expecting this invitation, you may safely ignore this email.</p>
</td></tr>
</table>
</td></tr>
</table>
<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This message was sent by {{conferenceName}}.</p>
</td></tr>
</table>
</body>
</html>$steps$,
  "bodyText" = $steps${{conferenceName}}

Reviewer invitation

Dear colleague,

You have been invited to serve as a reviewer for {{conferenceName}}. The program organizers would value your expertise in evaluating submissions for this conference.

Expires: {{expiresAt}}

How to accept
1. Open the invitation link below.
2. Sign in with the same email address that received this message. If you are new, you will be asked to choose a name and password.
3. After you accept, you can bid on papers and declare any conflicts of interest.

Accept invitation: {{signupUrl}}

If you were not expecting this invitation, you may safely ignore this email.

This message was sent by {{conferenceName}}.$steps$,
  "variables" = '["conferenceName","signupUrl","expiresAt"]'::jsonb,
  "isActive" = true,
  "updatedAt" = NOW()
WHERE "organizationId" IS NULL AND "key" = 'reviewer.invitation' AND "version" = 2;
