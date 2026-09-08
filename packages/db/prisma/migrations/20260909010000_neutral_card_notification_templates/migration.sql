-- Modern neutral card layout for platform notification templates.
-- Black/white/grey palette; updates existing version-2 platform rows in place.

UPDATE "notification_templates"
SET
  "subject" = $card$Your email verification code$card$,
  "bodyHtml" = $card$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Verify your email address</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e4e4e7;border-radius:10px;">

<tr><td style="padding:14px 28px 26px;">
<h1 style="margin:0 0 18px;font-size:21px;line-height:1.35;font-weight:600;color:#18181b;">Verify your email address</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">Thanks for creating an account.</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">Enter this code in the browser window where you signed up. Do not share this code with anyone.</p>


<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 16px;background:#fafafa;border:1px solid #e4e4e7;border-radius:8px;">
<tr><td style="padding:20px;text-align:center;">
<p style="margin:0;font-size:32px;line-height:1.2;font-weight:700;letter-spacing:0.28em;color:#18181b;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;">{{otp}}</p>
<p style="margin:8px 0 0;font-size:13px;line-height:1.5;color:#71717a;">This code expires in {{expiresMinutes}} minutes.</p>
</td></tr>
</table>

<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:4px 0 0;">
<tr><td style="padding:16px 0 0;border-top:1px solid #e4e4e7;">
<p style="margin:0;font-size:13px;line-height:1.6;color:#71717a;">If you did not create an account, you can safely ignore this email. Someone else may have typed your address by mistake.</p>
</td></tr>
</table>
</td></tr>
</table>
<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This is an automated message. Please do not reply.</p>
</td></tr>
</table>
</body>
</html>$card$,
  "bodyText" = $card$Verify your email address

Thanks for creating an account.

Enter this code in the browser window where you signed up. Do not share this code with anyone.

Your code: {{otp}}
This code expires in {{expiresMinutes}} minutes.

If you did not create an account, you can safely ignore this email. Someone else may have typed your address by mistake.

This is an automated message. Please do not reply.$card$,
  "variables" = '["otp","expiresMinutes"]'::jsonb,
  "isActive" = true,
  "updatedAt" = NOW()
WHERE "organizationId" IS NULL AND "key" = 'auth.email_verify' AND "version" = 2;

UPDATE "notification_templates"
SET
  "subject" = $card$Reset your password$card$,
  "bodyHtml" = $card$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Reset your password</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e4e4e7;border-radius:10px;">

<tr><td style="padding:14px 28px 26px;">
<h1 style="margin:0 0 18px;font-size:21px;line-height:1.35;font-weight:600;color:#18181b;">Reset your password</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">We received a request to reset the password for your account.</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">Open the link below to choose a new password. For your security, this link can only be used once.</p>



<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 16px;">
<tr><td style="background:#18181b;border-radius:6px;">
<a href="{{resetUrl}}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">Reset password</a>
</td></tr>
</table>
<p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#71717a;word-break:break-all;">If the button does not work, paste this address into your browser:<br>{{resetUrl}}</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:4px 0 0;">
<tr><td style="padding:16px 0 0;border-top:1px solid #e4e4e7;">
<p style="margin:0;font-size:13px;line-height:1.6;color:#71717a;">If you did not request a password reset, you can ignore this email. Your password will not change.</p>
</td></tr>
</table>
</td></tr>
</table>
<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This is an automated message. Please do not reply.</p>
</td></tr>
</table>
</body>
</html>$card$,
  "bodyText" = $card$Reset your password

We received a request to reset the password for your account.

Open the link below to choose a new password. For your security, this link can only be used once.

Reset password: {{resetUrl}}

If you did not request a password reset, you can ignore this email. Your password will not change.

This is an automated message. Please do not reply.$card$,
  "variables" = '["resetUrl"]'::jsonb,
  "isActive" = true,
  "updatedAt" = NOW()
WHERE "organizationId" IS NULL AND "key" = 'auth.password_reset' AND "version" = 2;

UPDATE "notification_templates"
SET
  "subject" = $card$Your verification code$card$,
  "bodyHtml" = $card$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Your verification code</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e4e4e7;border-radius:10px;">

<tr><td style="padding:14px 28px 26px;">
<h1 style="margin:0 0 18px;font-size:21px;line-height:1.35;font-weight:600;color:#18181b;">Your verification code</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">Use this code to finish signing in or enable two-factor authentication on your account.</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">Enter the code in the browser window where you requested it. Do not share this code with anyone.</p>


<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 16px;background:#fafafa;border:1px solid #e4e4e7;border-radius:8px;">
<tr><td style="padding:20px;text-align:center;">
<p style="margin:0;font-size:32px;line-height:1.2;font-weight:700;letter-spacing:0.28em;color:#18181b;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;">{{otp}}</p>
<p style="margin:8px 0 0;font-size:13px;line-height:1.5;color:#71717a;">This code expires in {{expiresMinutes}} minutes.</p>
</td></tr>
</table>

<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:4px 0 0;">
<tr><td style="padding:16px 0 0;border-top:1px solid #e4e4e7;">
<p style="margin:0;font-size:13px;line-height:1.6;color:#71717a;">If you did not request this code, you can ignore this email. Someone else may have typed your address by mistake.</p>
</td></tr>
</table>
</td></tr>
</table>
<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This is an automated message. Please do not reply.</p>
</td></tr>
</table>
</body>
</html>$card$,
  "bodyText" = $card$Your verification code

Use this code to finish signing in or enable two-factor authentication on your account.

Enter the code in the browser window where you requested it. Do not share this code with anyone.

Your code: {{otp}}
This code expires in {{expiresMinutes}} minutes.

If you did not request this code, you can ignore this email. Someone else may have typed your address by mistake.

This is an automated message. Please do not reply.$card$,
  "variables" = '["otp","expiresMinutes"]'::jsonb,
  "isActive" = true,
  "updatedAt" = NOW()
WHERE "organizationId" IS NULL AND "key" = 'auth.mfa_otp' AND "version" = 2;

UPDATE "notification_templates"
SET
  "subject" = $card$Submission received: {{paperTitle}}$card$,
  "bodyHtml" = $card$<!DOCTYPE html>
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
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Track</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{trackName}}</p>
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
<tr><td style="padding:12px 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Keywords</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{keywords}}</p>
</td></tr>
<tr><td style="padding:12px 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Abstract</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{abstract}}</p>
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
</html>$card$,
  "bodyText" = $card${{conferenceName}}

Submission confirmed

Your paper has been received for {{conferenceName}}.

Please keep this message as a record of the submission.

Paper: {{paperTitle}}
Track: {{trackName}}
Corresponding author: {{authorName}}
Email: {{authorEmail}}
Affiliation: {{authorAffiliation}}
Authors: {{authorList}}
Keywords: {{keywords}}
Abstract: {{abstract}}

You will receive further updates by email as this submission moves through review.

This message was sent by {{conferenceName}}.$card$,
  "variables" = '["paperTitle","conferenceName","trackName","authorName","authorEmail","authorAffiliation","authorList","keywords","abstract"]'::jsonb,
  "isActive" = true,
  "updatedAt" = NOW()
WHERE "organizationId" IS NULL AND "key" = 'submission.confirmed' AND "version" = 2;

UPDATE "notification_templates"
SET
  "subject" = $card$New submission: {{paperTitle}} ({{conferenceName}})$card$,
  "bodyHtml" = $card$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>New paper submission</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e4e4e7;border-radius:10px;">
<tr><td style="padding:22px 28px 0;">
<p style="margin:0;font-size:12px;line-height:1.4;letter-spacing:0.1em;text-transform:uppercase;font-weight:600;color:#71717a;">{{conferenceName}}</p>
</td></tr>
<tr><td style="padding:14px 28px 26px;">
<h1 style="margin:0 0 18px;font-size:21px;line-height:1.35;font-weight:600;color:#18181b;">New paper submission</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">A new paper has been submitted.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px;background:#fafafa;border:1px solid #e4e4e7;border-radius:8px;">
<tr><td style="padding:18px 20px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
<tr><td style="padding:0 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Paper title</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{paperTitle}}</p>
</td></tr>
<tr><td style="padding:12px 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Corresponding author</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{authorEmail}}</p>
</td></tr>
</table>
</td></tr>
</table>


<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 16px;">
<tr><td style="background:#18181b;border-radius:6px;">
<a href="{{paperUrl}}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">View submission</a>
</td></tr>
</table>
<p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#71717a;word-break:break-all;">If the button does not work, paste this address into your browser:<br>{{paperUrl}}</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:4px 0 0;">
<tr><td style="padding:16px 0 0;border-top:1px solid #e4e4e7;">
<p style="margin:0;font-size:13px;line-height:1.6;color:#71717a;">This is an operations alert for every new submission.</p>
</td></tr>
</table>
</td></tr>
</table>
<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This message was sent by {{conferenceName}}.</p>
</td></tr>
</table>
</body>
</html>$card$,
  "bodyText" = $card${{conferenceName}}

New paper submission

A new paper has been submitted.

Paper title: {{paperTitle}}
Corresponding author: {{authorEmail}}

View submission: {{paperUrl}}

This is an operations alert for every new submission.

This message was sent by {{conferenceName}}.$card$,
  "variables" = '["paperTitle","conferenceName","authorEmail","paperUrl"]'::jsonb,
  "isActive" = true,
  "updatedAt" = NOW()
WHERE "organizationId" IS NULL AND "key" = 'submission.ops_alert' AND "version" = 2;

UPDATE "notification_templates"
SET
  "subject" = $card$Reviewer invitation for {{conferenceName}}$card$,
  "bodyHtml" = $card$<!DOCTYPE html>
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
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">Please accept the invitation using the link below. Sign in with the same email address that received this message.</p>
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
</html>$card$,
  "bodyText" = $card${{conferenceName}}

Reviewer invitation

Dear colleague,

You have been invited to serve as a reviewer for {{conferenceName}}. The program organizers would value your expertise in evaluating submissions for this conference.

Please accept the invitation using the link below. Sign in with the same email address that received this message.

Expires: {{expiresAt}}

Accept invitation: {{signupUrl}}

If you were not expecting this invitation, you may safely ignore this email.

This message was sent by {{conferenceName}}.$card$,
  "variables" = '["conferenceName","signupUrl","expiresAt"]'::jsonb,
  "isActive" = true,
  "updatedAt" = NOW()
WHERE "organizationId" IS NULL AND "key" = 'reviewer.invitation' AND "version" = 2;

UPDATE "notification_templates"
SET
  "subject" = $card$New review assignment: {{paperTitle}}$card$,
  "bodyHtml" = $card$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>New review assignment</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e4e4e7;border-radius:10px;">
<tr><td style="padding:22px 28px 0;">
<p style="margin:0;font-size:12px;line-height:1.4;letter-spacing:0.1em;text-transform:uppercase;font-weight:600;color:#71717a;">{{conferenceName}}</p>
</td></tr>
<tr><td style="padding:14px 28px 26px;">
<h1 style="margin:0 0 18px;font-size:21px;line-height:1.35;font-weight:600;color:#18181b;">New review assignment</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">You have been assigned a paper to review.</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">Please submit your review before the due date below.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px;background:#fafafa;border:1px solid #e4e4e7;border-radius:8px;">
<tr><td style="padding:18px 20px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
<tr><td style="padding:0 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Paper</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{paperTitle}}</p>
</td></tr>
<tr><td style="padding:12px 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Review round</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{roundNumber}}</p>
</td></tr>
<tr><td style="padding:12px 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Due date</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{dueAt}}</p>
</td></tr>
</table>
</td></tr>
</table>



<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:4px 0 0;">
<tr><td style="padding:16px 0 0;border-top:1px solid #e4e4e7;">
<p style="margin:0;font-size:13px;line-height:1.6;color:#71717a;">If you have a conflict of interest with this submission, please declare it before starting your review.</p>
</td></tr>
</table>
</td></tr>
</table>
<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This message was sent by {{conferenceName}}.</p>
</td></tr>
</table>
</body>
</html>$card$,
  "bodyText" = $card${{conferenceName}}

New review assignment

You have been assigned a paper to review.

Please submit your review before the due date below.

Paper: {{paperTitle}}
Review round: {{roundNumber}}
Due date: {{dueAt}}

If you have a conflict of interest with this submission, please declare it before starting your review.

This message was sent by {{conferenceName}}.$card$,
  "variables" = '["paperTitle","roundNumber","dueAt","conferenceName"]'::jsonb,
  "isActive" = true,
  "updatedAt" = NOW()
WHERE "organizationId" IS NULL AND "key" = 'assignment.notified' AND "version" = 2;

UPDATE "notification_templates"
SET
  "subject" = $card$Review due soon: {{paperTitle}}$card$,
  "bodyHtml" = $card$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Review deadline approaching</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e4e4e7;border-radius:10px;">
<tr><td style="padding:22px 28px 0;">
<p style="margin:0;font-size:12px;line-height:1.4;letter-spacing:0.1em;text-transform:uppercase;font-weight:600;color:#71717a;">{{conferenceName}}</p>
</td></tr>
<tr><td style="padding:14px 28px 26px;">
<h1 style="margin:0 0 18px;font-size:21px;line-height:1.35;font-weight:600;color:#18181b;">Review deadline approaching</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">This is a reminder that your review for {{conferenceName}} is due soon.</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">Please submit your review before the due date below.</p>
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



<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:4px 0 0;">
<tr><td style="padding:16px 0 0;border-top:1px solid #e4e4e7;">
<p style="margin:0;font-size:13px;line-height:1.6;color:#71717a;">Late reviews may delay editorial decisions for authors.</p>
</td></tr>
</table>
</td></tr>
</table>
<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This message was sent by {{conferenceName}}.</p>
</td></tr>
</table>
</body>
</html>$card$,
  "bodyText" = $card${{conferenceName}}

Review deadline approaching

This is a reminder that your review for {{conferenceName}} is due soon.

Please submit your review before the due date below.

Paper: {{paperTitle}}
Due date: {{dueAt}}

Late reviews may delay editorial decisions for authors.

This message was sent by {{conferenceName}}.$card$,
  "variables" = '["paperTitle","dueAt","conferenceName"]'::jsonb,
  "isActive" = true,
  "updatedAt" = NOW()
WHERE "organizationId" IS NULL AND "key" = 'review.reminder' AND "version" = 2;

UPDATE "notification_templates"
SET
  "subject" = $card$Editorial decision — {{outcomeLabel}}: {{paperTitle}}$card$,
  "bodyHtml" = $card$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Editorial decision: {{outcomeLabel}}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e4e4e7;border-radius:10px;">
<tr><td style="padding:22px 28px 0;">
<p style="margin:0;font-size:12px;line-height:1.4;letter-spacing:0.1em;text-transform:uppercase;font-weight:600;color:#71717a;">{{conferenceName}}</p>
</td></tr>
<tr><td style="padding:14px 28px 26px;">
<h1 style="margin:0 0 18px;font-size:21px;line-height:1.35;font-weight:600;color:#18181b;">Editorial decision: {{outcomeLabel}}</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">The program committee has reached an editorial decision on your submission.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px;background:#fafafa;border:1px solid #e4e4e7;border-radius:8px;">
<tr><td style="padding:18px 20px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
<tr><td style="padding:0 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Paper</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{paperTitle}}</p>
</td></tr>
<tr><td style="padding:12px 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Decision</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{outcomeLabel}}</p>
</td></tr>
</table>
</td></tr>
</table>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">{{rationaleBlock}}</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">{{acceptBlock}}</p>



</td></tr>
</table>
<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This message was sent by {{conferenceName}}.</p>
</td></tr>
</table>
</body>
</html>$card$,
  "bodyText" = $card${{conferenceName}}

Editorial decision: {{outcomeLabel}}

The program committee has reached an editorial decision on your submission.

Paper: {{paperTitle}}
Decision: {{outcomeLabel}}

{{rationaleBlock}}

{{acceptBlock}}

This message was sent by {{conferenceName}}.$card$,
  "variables" = '["paperTitle","outcomeLabel","rationaleBlock","acceptBlock","conferenceName"]'::jsonb,
  "isActive" = true,
  "updatedAt" = NOW()
WHERE "organizationId" IS NULL AND "key" = 'decision.notified' AND "version" = 2;

UPDATE "notification_templates"
SET
  "subject" = $card$Reviewer feedback available: {{paperTitle}}$card$,
  "bodyHtml" = $card$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Reviewer feedback released</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e4e4e7;border-radius:10px;">
<tr><td style="padding:22px 28px 0;">
<p style="margin:0;font-size:12px;line-height:1.4;letter-spacing:0.1em;text-transform:uppercase;font-weight:600;color:#71717a;">{{conferenceName}}</p>
</td></tr>
<tr><td style="padding:14px 28px 26px;">
<h1 style="margin:0 0 18px;font-size:21px;line-height:1.35;font-weight:600;color:#18181b;">Reviewer feedback released</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">Review feedback for your submission to {{conferenceName}} is now available.</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">You may read the released reviews and, if allowed, submit a rebuttal before the deadline.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px;background:#fafafa;border:1px solid #e4e4e7;border-radius:8px;">
<tr><td style="padding:18px 20px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
<tr><td style="padding:0 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Paper</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{paperTitle}}</p>
</td></tr>
</table>
</td></tr>
</table>




</td></tr>
</table>
<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This message was sent by {{conferenceName}}.</p>
</td></tr>
</table>
</body>
</html>$card$,
  "bodyText" = $card${{conferenceName}}

Reviewer feedback released

Review feedback for your submission to {{conferenceName}} is now available.

You may read the released reviews and, if allowed, submit a rebuttal before the deadline.

Paper: {{paperTitle}}

This message was sent by {{conferenceName}}.$card$,
  "variables" = '["paperTitle","conferenceName"]'::jsonb,
  "isActive" = true,
  "updatedAt" = NOW()
WHERE "organizationId" IS NULL AND "key" = 'review.released' AND "version" = 2;

UPDATE "notification_templates"
SET
  "subject" = $card$Camera-ready due soon: {{paperTitle}}$card$,
  "bodyHtml" = $card$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Camera-ready deadline approaching</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e4e4e7;border-radius:10px;">
<tr><td style="padding:22px 28px 0;">
<p style="margin:0;font-size:12px;line-height:1.4;letter-spacing:0.1em;text-transform:uppercase;font-weight:600;color:#71717a;">{{conferenceName}}</p>
</td></tr>
<tr><td style="padding:14px 28px 26px;">
<h1 style="margin:0 0 18px;font-size:21px;line-height:1.35;font-weight:600;color:#18181b;">Camera-ready deadline approaching</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">Your accepted paper requires a camera-ready PDF before it can be included in the {{conferenceName}} proceedings.</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">Please upload the final PDF before the deadline below.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px;background:#fafafa;border:1px solid #e4e4e7;border-radius:8px;">
<tr><td style="padding:18px 20px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
<tr><td style="padding:0 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Paper</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{paperTitle}}</p>
</td></tr>
<tr><td style="padding:12px 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Deadline</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{deadlineAt}}</p>
</td></tr>
</table>
</td></tr>
</table>



<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:4px 0 0;">
<tr><td style="padding:16px 0 0;border-top:1px solid #e4e4e7;">
<p style="margin:0;font-size:13px;line-height:1.6;color:#71717a;">Missing the camera-ready deadline may affect publication of your paper.</p>
</td></tr>
</table>
</td></tr>
</table>
<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This message was sent by {{conferenceName}}.</p>
</td></tr>
</table>
</body>
</html>$card$,
  "bodyText" = $card${{conferenceName}}

Camera-ready deadline approaching

Your accepted paper requires a camera-ready PDF before it can be included in the {{conferenceName}} proceedings.

Please upload the final PDF before the deadline below.

Paper: {{paperTitle}}
Deadline: {{deadlineAt}}

Missing the camera-ready deadline may affect publication of your paper.

This message was sent by {{conferenceName}}.$card$,
  "variables" = '["paperTitle","deadlineAt","conferenceName"]'::jsonb,
  "isActive" = true,
  "updatedAt" = NOW()
WHERE "organizationId" IS NULL AND "key" = 'cameraready.reminder' AND "version" = 2;

UPDATE "notification_templates"
SET
  "subject" = $card$Registration now open — {{paperTitle}}$card$,
  "bodyHtml" = $card$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Registration is now open</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e4e4e7;border-radius:10px;">
<tr><td style="padding:22px 28px 0;">
<p style="margin:0;font-size:12px;line-height:1.4;letter-spacing:0.1em;text-transform:uppercase;font-weight:600;color:#71717a;">{{conferenceName}}</p>
</td></tr>
<tr><td style="padding:14px 28px 26px;">
<h1 style="margin:0 0 18px;font-size:21px;line-height:1.35;font-weight:600;color:#18181b;">Registration is now open</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">Congratulations — your paper has been accepted to {{conferenceName}}.</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">Registration is now open. Please complete registration and payment before the deadline to confirm your participation.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px;background:#fafafa;border:1px solid #e4e4e7;border-radius:8px;">
<tr><td style="padding:18px 20px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
<tr><td style="padding:0 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Paper</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{paperTitle}}</p>
</td></tr>
<tr><td style="padding:12px 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Registration deadline</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{deadlineAt}}</p>
</td></tr>
</table>
</td></tr>
</table>



<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:4px 0 0;">
<tr><td style="padding:16px 0 0;border-top:1px solid #e4e4e7;">
<p style="margin:0;font-size:13px;line-height:1.6;color:#71717a;">Papers that remain unpaid after the registration deadline may be withdrawn from the program.</p>
</td></tr>
</table>
</td></tr>
</table>
<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This message was sent by {{conferenceName}}.</p>
</td></tr>
</table>
</body>
</html>$card$,
  "bodyText" = $card${{conferenceName}}

Registration is now open

Congratulations — your paper has been accepted to {{conferenceName}}.

Registration is now open. Please complete registration and payment before the deadline to confirm your participation.

Paper: {{paperTitle}}
Registration deadline: {{deadlineAt}}

Papers that remain unpaid after the registration deadline may be withdrawn from the program.

This message was sent by {{conferenceName}}.$card$,
  "variables" = '["paperTitle","deadlineAt","conferenceName"]'::jsonb,
  "isActive" = true,
  "updatedAt" = NOW()
WHERE "organizationId" IS NULL AND "key" = 'registration.window_open' AND "version" = 2;

UPDATE "notification_templates"
SET
  "subject" = $card$Early-bird registration ends soon$card$,
  "bodyHtml" = $card$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Early-bird registration ending soon</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e4e4e7;border-radius:10px;">
<tr><td style="padding:22px 28px 0;">
<p style="margin:0;font-size:12px;line-height:1.4;letter-spacing:0.1em;text-transform:uppercase;font-weight:600;color:#71717a;">{{conferenceName}}</p>
</td></tr>
<tr><td style="padding:14px 28px 26px;">
<h1 style="margin:0 0 18px;font-size:21px;line-height:1.35;font-weight:600;color:#18181b;">Early-bird registration ending soon</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">Early-bird registration pricing for your accepted paper will end soon.</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">Complete your registration before the early-bird deadline to lock in the reduced rate.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px;background:#fafafa;border:1px solid #e4e4e7;border-radius:8px;">
<tr><td style="padding:18px 20px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
<tr><td style="padding:0 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Paper</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{paperTitle}}</p>
</td></tr>
<tr><td style="padding:12px 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Early-bird ends</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{earlyBirdEndsAt}}</p>
</td></tr>
</table>
</td></tr>
</table>



<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:4px 0 0;">
<tr><td style="padding:16px 0 0;border-top:1px solid #e4e4e7;">
<p style="margin:0;font-size:13px;line-height:1.6;color:#71717a;">After this date, standard registration fees will apply.</p>
</td></tr>
</table>
</td></tr>
</table>
<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This message was sent by {{conferenceName}}.</p>
</td></tr>
</table>
</body>
</html>$card$,
  "bodyText" = $card${{conferenceName}}

Early-bird registration ending soon

Early-bird registration pricing for your accepted paper will end soon.

Complete your registration before the early-bird deadline to lock in the reduced rate.

Paper: {{paperTitle}}
Early-bird ends: {{earlyBirdEndsAt}}

After this date, standard registration fees will apply.

This message was sent by {{conferenceName}}.$card$,
  "variables" = '["paperTitle","earlyBirdEndsAt","conferenceName"]'::jsonb,
  "isActive" = true,
  "updatedAt" = NOW()
WHERE "organizationId" IS NULL AND "key" = 'registration.early_bird_ending' AND "version" = 2;

UPDATE "notification_templates"
SET
  "subject" = $card$Registration confirmed — {{paperTitle}}$card$,
  "bodyHtml" = $card$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Registration confirmed</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e4e4e7;border-radius:10px;">
<tr><td style="padding:22px 28px 0;">
<p style="margin:0;font-size:12px;line-height:1.4;letter-spacing:0.1em;text-transform:uppercase;font-weight:600;color:#71717a;">{{conferenceName}}</p>
</td></tr>
<tr><td style="padding:14px 28px 26px;">
<h1 style="margin:0 0 18px;font-size:21px;line-height:1.35;font-weight:600;color:#18181b;">Registration confirmed</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">Thank you — your registration payment has been received and your participation is confirmed.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px;background:#fafafa;border:1px solid #e4e4e7;border-radius:8px;">
<tr><td style="padding:18px 20px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
<tr><td style="padding:0 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Paper</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{paperTitle}}</p>
</td></tr>
<tr><td style="padding:12px 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Amount paid</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{amountFormatted}}</p>
</td></tr>
</table>
</td></tr>
</table>



<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:4px 0 0;">
<tr><td style="padding:16px 0 0;border-top:1px solid #e4e4e7;">
<p style="margin:0;font-size:13px;line-height:1.6;color:#71717a;">Keep this email for your records.</p>
</td></tr>
</table>
</td></tr>
</table>
<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This message was sent by {{conferenceName}}.</p>
</td></tr>
</table>
</body>
</html>$card$,
  "bodyText" = $card${{conferenceName}}

Registration confirmed

Thank you — your registration payment has been received and your participation is confirmed.

Paper: {{paperTitle}}
Amount paid: {{amountFormatted}}

Keep this email for your records.

This message was sent by {{conferenceName}}.$card$,
  "variables" = '["paperTitle","amountFormatted","conferenceName"]'::jsonb,
  "isActive" = true,
  "updatedAt" = NOW()
WHERE "organizationId" IS NULL AND "key" = 'registration.confirmed' AND "version" = 2;

UPDATE "notification_templates"
SET
  "subject" = $card$Student verification approved$card$,
  "bodyHtml" = $card$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Student verification approved</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e4e4e7;border-radius:10px;">
<tr><td style="padding:22px 28px 0;">
<p style="margin:0;font-size:12px;line-height:1.4;letter-spacing:0.1em;text-transform:uppercase;font-weight:600;color:#71717a;">{{conferenceName}}</p>
</td></tr>
<tr><td style="padding:14px 28px 26px;">
<h1 style="margin:0 0 18px;font-size:21px;line-height:1.35;font-weight:600;color:#18181b;">Student verification approved</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">Your student status documentation has been reviewed and approved.</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">Your registration now reflects the approved student rate. No further action is required.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px;background:#fafafa;border:1px solid #e4e4e7;border-radius:8px;">
<tr><td style="padding:18px 20px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
<tr><td style="padding:0 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Paper</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{paperTitle}}</p>
</td></tr>
</table>
</td></tr>
</table>




</td></tr>
</table>
<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This message was sent by {{conferenceName}}.</p>
</td></tr>
</table>
</body>
</html>$card$,
  "bodyText" = $card${{conferenceName}}

Student verification approved

Your student status documentation has been reviewed and approved.

Your registration now reflects the approved student rate. No further action is required.

Paper: {{paperTitle}}

This message was sent by {{conferenceName}}.$card$,
  "variables" = '["paperTitle","conferenceName"]'::jsonb,
  "isActive" = true,
  "updatedAt" = NOW()
WHERE "organizationId" IS NULL AND "key" = 'registration.verification_approved' AND "version" = 2;

UPDATE "notification_templates"
SET
  "subject" = $card$Action needed: student verification$card$,
  "bodyHtml" = $card$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Student verification — clarification needed</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e4e4e7;border-radius:10px;">
<tr><td style="padding:22px 28px 0;">
<p style="margin:0;font-size:12px;line-height:1.4;letter-spacing:0.1em;text-transform:uppercase;font-weight:600;color:#71717a;">{{conferenceName}}</p>
</td></tr>
<tr><td style="padding:14px 28px 26px;">
<h1 style="margin:0 0 18px;font-size:21px;line-height:1.35;font-weight:600;color:#18181b;">Student verification — clarification needed</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">We need additional documents to complete your student verification.</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">Please review the committee note below and upload the requested materials when you sign in.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px;background:#fafafa;border:1px solid #e4e4e7;border-radius:8px;">
<tr><td style="padding:18px 20px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
<tr><td style="padding:0 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Paper</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{paperTitle}}</p>
</td></tr>
<tr><td style="padding:12px 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Committee note</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{note}}</p>
</td></tr>
</table>
</td></tr>
</table>



<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:4px 0 0;">
<tr><td style="padding:16px 0 0;border-top:1px solid #e4e4e7;">
<p style="margin:0;font-size:13px;line-height:1.6;color:#71717a;">Your registration may remain on hold until verification is complete.</p>
</td></tr>
</table>
</td></tr>
</table>
<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This message was sent by {{conferenceName}}.</p>
</td></tr>
</table>
</body>
</html>$card$,
  "bodyText" = $card${{conferenceName}}

Student verification — clarification needed

We need additional documents to complete your student verification.

Please review the committee note below and upload the requested materials when you sign in.

Paper: {{paperTitle}}
Committee note: {{note}}

Your registration may remain on hold until verification is complete.

This message was sent by {{conferenceName}}.$card$,
  "variables" = '["paperTitle","note","conferenceName"]'::jsonb,
  "isActive" = true,
  "updatedAt" = NOW()
WHERE "organizationId" IS NULL AND "key" = 'registration.clarification_requested' AND "version" = 2;

UPDATE "notification_templates"
SET
  "subject" = $card$Additional registration payment required$card$,
  "bodyHtml" = $card$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Additional payment required</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e4e4e7;border-radius:10px;">
<tr><td style="padding:22px 28px 0;">
<p style="margin:0;font-size:12px;line-height:1.4;letter-spacing:0.1em;text-transform:uppercase;font-weight:600;color:#71717a;">{{conferenceName}}</p>
</td></tr>
<tr><td style="padding:14px 28px 26px;">
<h1 style="margin:0 0 18px;font-size:21px;line-height:1.35;font-weight:600;color:#18181b;">Additional payment required</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">Your student verification was not approved at the discounted rate.</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">An additional registration payment is required to complete your registration.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px;background:#fafafa;border:1px solid #e4e4e7;border-radius:8px;">
<tr><td style="padding:18px 20px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
<tr><td style="padding:0 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Paper</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{paperTitle}}</p>
</td></tr>
<tr><td style="padding:12px 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Amount due</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{amountFormatted}}</p>
</td></tr>
</table>
</td></tr>
</table>




</td></tr>
</table>
<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This message was sent by {{conferenceName}}.</p>
</td></tr>
</table>
</body>
</html>$card$,
  "bodyText" = $card${{conferenceName}}

Additional payment required

Your student verification was not approved at the discounted rate.

An additional registration payment is required to complete your registration.

Paper: {{paperTitle}}
Amount due: {{amountFormatted}}

This message was sent by {{conferenceName}}.$card$,
  "variables" = '["paperTitle","amountFormatted","conferenceName"]'::jsonb,
  "isActive" = true,
  "updatedAt" = NOW()
WHERE "organizationId" IS NULL AND "key" = 'registration.additional_payment_required' AND "version" = 2;

UPDATE "notification_templates"
SET
  "subject" = $card$Registration deadline approaching$card$,
  "bodyHtml" = $card$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Registration deadline approaching</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e4e4e7;border-radius:10px;">
<tr><td style="padding:22px 28px 0;">
<p style="margin:0;font-size:12px;line-height:1.4;letter-spacing:0.1em;text-transform:uppercase;font-weight:600;color:#71717a;">{{conferenceName}}</p>
</td></tr>
<tr><td style="padding:14px 28px 26px;">
<h1 style="margin:0 0 18px;font-size:21px;line-height:1.35;font-weight:600;color:#18181b;">Registration deadline approaching</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">Your accepted paper still requires completed registration and payment.</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">Please complete registration before the deadline below.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px;background:#fafafa;border:1px solid #e4e4e7;border-radius:8px;">
<tr><td style="padding:18px 20px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
<tr><td style="padding:0 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Paper</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{paperTitle}}</p>
</td></tr>
<tr><td style="padding:12px 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Registration deadline</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{deadlineAt}}</p>
</td></tr>
</table>
</td></tr>
</table>



<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:4px 0 0;">
<tr><td style="padding:16px 0 0;border-top:1px solid #e4e4e7;">
<p style="margin:0;font-size:13px;line-height:1.6;color:#71717a;">Papers with unpaid registration after the deadline may be withdrawn for non-payment.</p>
</td></tr>
</table>
</td></tr>
</table>
<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This message was sent by {{conferenceName}}.</p>
</td></tr>
</table>
</body>
</html>$card$,
  "bodyText" = $card${{conferenceName}}

Registration deadline approaching

Your accepted paper still requires completed registration and payment.

Please complete registration before the deadline below.

Paper: {{paperTitle}}
Registration deadline: {{deadlineAt}}

Papers with unpaid registration after the deadline may be withdrawn for non-payment.

This message was sent by {{conferenceName}}.$card$,
  "variables" = '["paperTitle","deadlineAt","conferenceName"]'::jsonb,
  "isActive" = true,
  "updatedAt" = NOW()
WHERE "organizationId" IS NULL AND "key" = 'registration.deadline_reminder' AND "version" = 2;

UPDATE "notification_templates"
SET
  "subject" = $card$Registration discarded — payment not received$card$,
  "bodyHtml" = $card$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Registration discarded</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e4e4e7;border-radius:10px;">
<tr><td style="padding:22px 28px 0;">
<p style="margin:0;font-size:12px;line-height:1.4;letter-spacing:0.1em;text-transform:uppercase;font-weight:600;color:#71717a;">{{conferenceName}}</p>
</td></tr>
<tr><td style="padding:14px 28px 26px;">
<h1 style="margin:0 0 18px;font-size:21px;line-height:1.35;font-weight:600;color:#18181b;">Registration discarded</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">Your registration has been discarded because payment was not received by the deadline.</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">If you believe this is a mistake, please contact the conference organizers.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px;background:#fafafa;border:1px solid #e4e4e7;border-radius:8px;">
<tr><td style="padding:18px 20px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
<tr><td style="padding:0 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Paper</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{paperTitle}}</p>
</td></tr>
</table>
</td></tr>
</table>




</td></tr>
</table>
<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This message was sent by {{conferenceName}}.</p>
</td></tr>
</table>
</body>
</html>$card$,
  "bodyText" = $card${{conferenceName}}

Registration discarded

Your registration has been discarded because payment was not received by the deadline.

If you believe this is a mistake, please contact the conference organizers.

Paper: {{paperTitle}}

This message was sent by {{conferenceName}}.$card$,
  "variables" = '["paperTitle","conferenceName"]'::jsonb,
  "isActive" = true,
  "updatedAt" = NOW()
WHERE "organizationId" IS NULL AND "key" = 'registration.discarded' AND "version" = 2;
