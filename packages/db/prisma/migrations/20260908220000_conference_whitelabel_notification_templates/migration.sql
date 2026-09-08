-- Conference white-label platform templates (render-time {{conferenceName}}; no product name).
-- Updates existing version-2 platform rows in place.

UPDATE "notification_templates"
SET
  "subject" = $whitelabel$Your email verification code$whitelabel$,
  "bodyHtml" = $whitelabel$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Verify your email address</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">Enter this code to verify your email address.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
<tr><td style="padding:28px 32px 20px;border-bottom:1px solid #f1f5f9;">

<h1 style="margin:0;font-size:22px;line-height:1.35;color:#0f172a;font-weight:700;">Verify your email address</h1>
</td></tr>
<tr><td style="padding:28px 32px;">
<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">Thanks for creating an account.</p><p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">Enter this code in the browser window where you signed up. Do not share this code with anyone.</p>

<div style="font-size:32px;font-weight:700;letter-spacing:8px;text-align:center;margin:8px 0 8px;padding:20px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;color:#0f172a;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;">{{otp}}</div><p style="margin:0 0 16px;font-size:14px;line-height:1.55;color:#64748b;text-align:center;">Expires in {{expiresMinutes}} minutes</p>

<p style="margin:16px 0 0;font-size:13px;line-height:1.55;color:#64748b;">If you did not create an account, you can safely ignore this email. Someone else may have typed your address by mistake.</p>
</td></tr>
<tr><td style="padding:18px 32px;background:#f8fafc;border-top:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;">This is an automated message. Please do not reply to this email.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>$whitelabel$,
  "bodyText" = $whitelabel$Verify your email address

Thanks for creating an account.

Code: {{otp}}

This code expires in {{expiresMinutes}} minutes.

Enter the code in the browser window where you signed up. Do not share it with anyone.

If you did not create an account, you can ignore this email.$whitelabel$,
  "variables" = '["otp","expiresMinutes"]'::jsonb,
  "isActive" = true,
  "updatedAt" = NOW()
WHERE "organizationId" IS NULL AND "key" = 'auth.email_verify' AND "version" = 2;

UPDATE "notification_templates"
SET
  "subject" = $whitelabel$Reset your password$whitelabel$,
  "bodyHtml" = $whitelabel$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Reset your password</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">Use this link to choose a new password for your account.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
<tr><td style="padding:28px 32px 20px;border-bottom:1px solid #f1f5f9;">

<h1 style="margin:0;font-size:22px;line-height:1.35;color:#0f172a;font-weight:700;">Reset your password</h1>
</td></tr>
<tr><td style="padding:28px 32px;">
<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">We received a request to reset the password for your account.</p><p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">Click the button below to choose a new password. For your security, this link can only be used once.</p>


<table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px 0 8px;"><tr><td style="border-radius:8px;background:#4f46e5;"><a href="{{resetUrl}}" style="display:inline-block;padding:13px 28px;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">Reset password</a></td></tr></table>
<p style="margin:16px 0 0;font-size:13px;line-height:1.55;color:#64748b;">If you did not request a password reset, you can ignore this email. Your password will not change.</p>
</td></tr>
<tr><td style="padding:18px 32px;background:#f8fafc;border-top:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;">This is an automated message. Please do not reply to this email.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>$whitelabel$,
  "bodyText" = $whitelabel$Reset your password

We received a request to reset your password.

Use the link below to choose a new password.

Reset password: {{resetUrl}}

If you did not request this, ignore this email.$whitelabel$,
  "variables" = '["resetUrl"]'::jsonb,
  "isActive" = true,
  "updatedAt" = NOW()
WHERE "organizationId" IS NULL AND "key" = 'auth.password_reset' AND "version" = 2;

UPDATE "notification_templates"
SET
  "subject" = $whitelabel$Your verification code$whitelabel$,
  "bodyHtml" = $whitelabel$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Your verification code</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">Your verification code expires shortly.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
<tr><td style="padding:28px 32px 20px;border-bottom:1px solid #f1f5f9;">

<h1 style="margin:0;font-size:22px;line-height:1.35;color:#0f172a;font-weight:700;">Your verification code</h1>
</td></tr>
<tr><td style="padding:28px 32px;">
<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">Use this code to finish signing in or enable two-factor authentication on your account.</p><p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">Enter the code in the browser window where you requested it. Do not share this code with anyone.</p>

<div style="font-size:32px;font-weight:700;letter-spacing:8px;text-align:center;margin:8px 0 8px;padding:20px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;color:#0f172a;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;">{{otp}}</div><p style="margin:0 0 16px;font-size:14px;line-height:1.55;color:#64748b;text-align:center;">Expires in {{expiresMinutes}} minutes</p>

<p style="margin:16px 0 0;font-size:13px;line-height:1.55;color:#64748b;">If you did not request this code, you can ignore this email. Someone else may have typed your address by mistake.</p>
</td></tr>
<tr><td style="padding:18px 32px;background:#f8fafc;border-top:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;">This is an automated message. Please do not reply to this email.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>$whitelabel$,
  "bodyText" = $whitelabel$Your verification code

Use this code to finish signing in or enable two-factor authentication on your account.

Code: {{otp}}

This code expires in {{expiresMinutes}} minutes.

Do not share this code with anyone.

If you did not request this code, you can ignore this email.$whitelabel$,
  "variables" = '["otp","expiresMinutes"]'::jsonb,
  "isActive" = true,
  "updatedAt" = NOW()
WHERE "organizationId" IS NULL AND "key" = 'auth.mfa_otp' AND "version" = 2;

UPDATE "notification_templates"
SET
  "subject" = $whitelabel$Submission received: {{paperTitle}}$whitelabel$,
  "bodyHtml" = $whitelabel$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Submission confirmed</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">Your paper has been successfully submitted.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
<tr><td style="padding:28px 32px 20px;border-bottom:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#4f46e5;">{{conferenceName}}</p>
<h1 style="margin:12px 0 0;font-size:22px;line-height:1.35;color:#0f172a;font-weight:700;">Submission confirmed</h1>
</td></tr>
<tr><td style="padding:28px 32px;">
<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">Your paper has been successfully submitted to {{conferenceName}}.</p><p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">You can return to the {{conferenceName}} dashboard at any time to view submission details, upload revisions, and track review progress.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;"><tr><td style="padding:12px 16px;"><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Conference</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{conferenceName}}</td></tr><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Paper title</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{paperTitle}}</td></tr></td></tr></table>


<p style="margin:16px 0 0;font-size:13px;line-height:1.55;color:#64748b;">You will receive further updates by email as your submission moves through review and decision stages.</p>
</td></tr>
<tr><td style="padding:18px 32px;background:#f8fafc;border-top:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;">Automated message from {{conferenceName}}. Please do not reply to this email.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>$whitelabel$,
  "bodyText" = $whitelabel$Submission confirmed

Your paper has been successfully submitted to {{conferenceName}}.

Conference: {{conferenceName}}
Paper title: {{paperTitle}}

— {{conferenceName}}$whitelabel$,
  "variables" = '["paperTitle","conferenceName"]'::jsonb,
  "isActive" = true,
  "updatedAt" = NOW()
WHERE "organizationId" IS NULL AND "key" = 'submission.confirmed' AND "version" = 2;

UPDATE "notification_templates"
SET
  "subject" = $whitelabel$New submission: {{paperTitle}} ({{conferenceName}})$whitelabel$,
  "bodyHtml" = $whitelabel$<!DOCTYPE html>
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
<p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#4f46e5;">{{conferenceName}}</p>
<h1 style="margin:12px 0 0;font-size:22px;line-height:1.35;color:#0f172a;font-weight:700;">New paper submission</h1>
</td></tr>
<tr><td style="padding:28px 32px;">
<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">A paper was submitted to {{conferenceName}}.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;"><tr><td style="padding:12px 16px;"><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Conference</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{conferenceName}}</td></tr><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Paper title</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{paperTitle}}</td></tr><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Corresponding author</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{authorEmail}}</td></tr></td></tr></table>

<table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px 0 8px;"><tr><td style="border-radius:8px;background:#4f46e5;"><a href="{{paperUrl}}" style="display:inline-block;padding:13px 28px;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">View submission</a></td></tr></table>
<p style="margin:16px 0 0;font-size:13px;line-height:1.55;color:#64748b;">This is an operations alert for every new {{conferenceName}} submission.</p>
</td></tr>
<tr><td style="padding:18px 32px;background:#f8fafc;border-top:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;">Automated message from {{conferenceName}}. Please do not reply to this email.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>$whitelabel$,
  "bodyText" = $whitelabel$New paper submission

A paper was submitted to {{conferenceName}}.

Conference: {{conferenceName}}
Paper title: {{paperTitle}}
Corresponding author: {{authorEmail}}

View submission: {{paperUrl}}

This is an operations alert for every new {{conferenceName}} submission.

— {{conferenceName}}$whitelabel$,
  "variables" = '["paperTitle","conferenceName","authorEmail","paperUrl"]'::jsonb,
  "isActive" = true,
  "updatedAt" = NOW()
WHERE "organizationId" IS NULL AND "key" = 'submission.ops_alert' AND "version" = 2;

UPDATE "notification_templates"
SET
  "subject" = $whitelabel$Reviewer invitation for {{conferenceName}}$whitelabel$,
  "bodyHtml" = $whitelabel$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Reviewer invitation</title>
</head>
<body style="margin:0;padding:24px;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.6;color:#222222;">
<p style="margin:0 0 16px;">Dear colleague,</p>
<p style="margin:0 0 16px;">You have been invited to serve as a reviewer for <strong>{{conferenceName}}</strong>. The program organizers would value your expertise in evaluating submissions for this conference.</p>
<p style="margin:0 0 16px;">Please accept the invitation using the button below. Sign in with the same email address that received this message. This invitation expires on {{expiresAt}}.</p>
<p style="margin:24px 0;">
<a href="{{signupUrl}}" style="display:inline-block;padding:12px 24px;background-color:#1a56db;color:#ffffff;text-decoration:none;border-radius:4px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:600;">Accept invitation</a>
</p>
<p style="margin:0 0 8px;font-size:14px;color:#555555;">If the button above does not work, copy and paste this link into your browser:</p>
<p style="margin:0 0 24px;font-size:14px;word-break:break-all;"><a href="{{signupUrl}}" style="color:#1a56db;">{{signupUrl}}</a></p>
<p style="margin:0;font-size:14px;color:#555555;">If you were not expecting this invitation, you may safely ignore this email.</p>
</body>
</html>$whitelabel$,
  "bodyText" = $whitelabel$Reviewer invitation

Dear colleague,

You have been invited to serve as a reviewer for {{conferenceName}}. The program organizers would value your expertise in evaluating submissions for this conference.

Please accept the invitation using the link below. Sign in with the same email address that received this message. This invitation expires on {{expiresAt}}.

Accept invitation: {{signupUrl}}

If the link above does not work, copy and paste it into your browser.

If you were not expecting this invitation, you may safely ignore this email.

— {{conferenceName}}$whitelabel$,
  "variables" = '["conferenceName","signupUrl","expiresAt"]'::jsonb,
  "isActive" = true,
  "updatedAt" = NOW()
WHERE "organizationId" IS NULL AND "key" = 'reviewer.invitation' AND "version" = 2;

UPDATE "notification_templates"
SET
  "subject" = $whitelabel$New review assignment: {{paperTitle}}$whitelabel$,
  "bodyHtml" = $whitelabel$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>New review assignment</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">A paper has been assigned to you for review.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
<tr><td style="padding:28px 32px 20px;border-bottom:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#4f46e5;">{{conferenceName}}</p>
<h1 style="margin:12px 0 0;font-size:22px;line-height:1.35;color:#0f172a;font-weight:700;">New review assignment</h1>
</td></tr>
<tr><td style="padding:28px 32px;">
<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">You have been assigned a paper to review for {{conferenceName}}. Please sign in to the {{conferenceName}} dashboard to read the submission, declare any conflicts of interest, and submit your review before the due date.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;"><tr><td style="padding:12px 16px;"><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Conference</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{conferenceName}}</td></tr><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Paper</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{paperTitle}}</td></tr><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Review round</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{roundNumber}}</td></tr><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Due date</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{dueAt}}</td></tr></td></tr></table>


<p style="margin:16px 0 0;font-size:13px;line-height:1.55;color:#64748b;">If you have a conflict of interest with this submission, declare it in the platform before starting your review.</p>
</td></tr>
<tr><td style="padding:18px 32px;background:#f8fafc;border-top:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;">Automated message from {{conferenceName}}. Please do not reply to this email.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>$whitelabel$,
  "bodyText" = $whitelabel$New review assignment

You have been assigned a paper to review for {{conferenceName}}. Please sign in to the {{conferenceName}} dashboard to complete your review.

Conference: {{conferenceName}}
Paper: {{paperTitle}}
Review round: {{roundNumber}}
Due date: {{dueAt}}

— {{conferenceName}}$whitelabel$,
  "variables" = '["paperTitle","roundNumber","dueAt","conferenceName"]'::jsonb,
  "isActive" = true,
  "updatedAt" = NOW()
WHERE "organizationId" IS NULL AND "key" = 'assignment.notified' AND "version" = 2;

UPDATE "notification_templates"
SET
  "subject" = $whitelabel$Review due soon: {{paperTitle}}$whitelabel$,
  "bodyHtml" = $whitelabel$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Review deadline approaching</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">Friendly reminder to submit your assigned review.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
<tr><td style="padding:28px 32px 20px;border-bottom:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#4f46e5;">{{conferenceName}}</p>
<h1 style="margin:12px 0 0;font-size:22px;line-height:1.35;color:#0f172a;font-weight:700;">Review deadline approaching</h1>
</td></tr>
<tr><td style="padding:28px 32px;">
<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">This is a reminder that your {{conferenceName}} review for the paper below is due soon.</p><p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">Please sign in to the {{conferenceName}} dashboard to submit your review or update your draft before the deadline.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;"><tr><td style="padding:12px 16px;"><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Conference</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{conferenceName}}</td></tr><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Paper</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{paperTitle}}</td></tr><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Due date</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{dueAt}}</td></tr></td></tr></table>


<p style="margin:16px 0 0;font-size:13px;line-height:1.55;color:#64748b;">Late reviews may delay editorial decisions for authors.</p>
</td></tr>
<tr><td style="padding:18px 32px;background:#f8fafc;border-top:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;">Automated message from {{conferenceName}}. Please do not reply to this email.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>$whitelabel$,
  "bodyText" = $whitelabel$Review deadline approaching

Please submit your review before the due date.

Conference: {{conferenceName}}
Paper: {{paperTitle}}
Due date: {{dueAt}}

— {{conferenceName}}$whitelabel$,
  "variables" = '["paperTitle","dueAt","conferenceName"]'::jsonb,
  "isActive" = true,
  "updatedAt" = NOW()
WHERE "organizationId" IS NULL AND "key" = 'review.reminder' AND "version" = 2;

UPDATE "notification_templates"
SET
  "subject" = $whitelabel$Editorial decision — {{outcomeLabel}}: {{paperTitle}}$whitelabel$,
  "bodyHtml" = $whitelabel$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Editorial decision: {{outcomeLabel}}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">The editorial decision for your submission is now available.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
<tr><td style="padding:28px 32px 20px;border-bottom:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#4f46e5;">{{conferenceName}}</p>
<h1 style="margin:12px 0 0;font-size:22px;line-height:1.35;color:#0f172a;font-weight:700;">Editorial decision: {{outcomeLabel}}</h1>
</td></tr>
<tr><td style="padding:28px 32px;">
<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">The {{conferenceName}} program committee has reached an editorial decision regarding your submission.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;"><tr><td style="padding:12px 16px;"><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Conference</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{conferenceName}}</td></tr><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Paper</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{paperTitle}}</td></tr><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Decision</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{outcomeLabel}}</td></tr></td></tr></table>
<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#334155;">{{rationaleBlock}}</p><p style="margin:0;font-size:15px;line-height:1.6;color:#334155;">{{acceptBlock}}</p>

<p style="margin:16px 0 0;font-size:13px;line-height:1.55;color:#64748b;">Sign in to the {{conferenceName}} dashboard to view full details, reviewer feedback (when released), and next steps for your submission.</p>
</td></tr>
<tr><td style="padding:18px 32px;background:#f8fafc;border-top:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;">Automated message from {{conferenceName}}. Please do not reply to this email.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>$whitelabel$,
  "bodyText" = $whitelabel$Editorial decision: {{outcomeLabel}}

The {{conferenceName}} program committee has reached a decision on your submission.

Conference: {{conferenceName}}
Paper: {{paperTitle}}
Decision: {{outcomeLabel}}

{{rationaleBlock}}

{{acceptBlock}}

— {{conferenceName}}$whitelabel$,
  "variables" = '["paperTitle","outcomeLabel","rationaleBlock","acceptBlock","conferenceName"]'::jsonb,
  "isActive" = true,
  "updatedAt" = NOW()
WHERE "organizationId" IS NULL AND "key" = 'decision.notified' AND "version" = 2;

UPDATE "notification_templates"
SET
  "subject" = $whitelabel$Reviewer feedback available: {{paperTitle}}$whitelabel$,
  "bodyHtml" = $whitelabel$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Reviewer feedback released</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">Review feedback for your paper is now visible in your dashboard.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
<tr><td style="padding:28px 32px 20px;border-bottom:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#4f46e5;">{{conferenceName}}</p>
<h1 style="margin:12px 0 0;font-size:22px;line-height:1.35;color:#0f172a;font-weight:700;">Reviewer feedback released</h1>
</td></tr>
<tr><td style="padding:28px 32px;">
<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">Review feedback for your {{conferenceName}} submission is now available.</p><p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">You may read the released reviews and, if the conference allows it, submit a rebuttal before the rebuttal deadline.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;"><tr><td style="padding:12px 16px;"><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Conference</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{conferenceName}}</td></tr><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Paper</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{paperTitle}}</td></tr></td></tr></table>


<p style="margin:16px 0 0;font-size:13px;line-height:1.55;color:#64748b;">Sign in to your author dashboard to read reviews and respond.</p>
</td></tr>
<tr><td style="padding:18px 32px;background:#f8fafc;border-top:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;">Automated message from {{conferenceName}}. Please do not reply to this email.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>$whitelabel$,
  "bodyText" = $whitelabel$Reviewer feedback released

Review feedback for your paper is now available.

Sign in to the {{conferenceName}} dashboard to read reviews and submit a rebuttal if applicable.

Conference: {{conferenceName}}
Paper: {{paperTitle}}

— {{conferenceName}}$whitelabel$,
  "variables" = '["paperTitle","conferenceName"]'::jsonb,
  "isActive" = true,
  "updatedAt" = NOW()
WHERE "organizationId" IS NULL AND "key" = 'review.released' AND "version" = 2;

UPDATE "notification_templates"
SET
  "subject" = $whitelabel$Camera-ready due soon: {{paperTitle}}$whitelabel$,
  "bodyHtml" = $whitelabel$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Camera-ready deadline approaching</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">Upload your final camera-ready version before the deadline.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
<tr><td style="padding:28px 32px 20px;border-bottom:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#4f46e5;">{{conferenceName}}</p>
<h1 style="margin:12px 0 0;font-size:22px;line-height:1.35;color:#0f172a;font-weight:700;">Camera-ready deadline approaching</h1>
</td></tr>
<tr><td style="padding:28px 32px;">
<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">Your accepted paper requires a camera-ready version before it can be included in the {{conferenceName}} proceedings.</p><p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">Please upload the final PDF through the {{conferenceName}} dashboard before the deadline below.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;"><tr><td style="padding:12px 16px;"><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Conference</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{conferenceName}}</td></tr><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Paper</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{paperTitle}}</td></tr><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Deadline</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{deadlineAt}}</td></tr></td></tr></table>


<p style="margin:16px 0 0;font-size:13px;line-height:1.55;color:#64748b;">Missing the camera-ready deadline may affect publication of your paper.</p>
</td></tr>
<tr><td style="padding:18px 32px;background:#f8fafc;border-top:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;">Automated message from {{conferenceName}}. Please do not reply to this email.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>$whitelabel$,
  "bodyText" = $whitelabel$Camera-ready deadline approaching

Please upload your camera-ready version before the deadline.

Conference: {{conferenceName}}
Paper: {{paperTitle}}
Deadline: {{deadlineAt}}

— {{conferenceName}}$whitelabel$,
  "variables" = '["paperTitle","deadlineAt","conferenceName"]'::jsonb,
  "isActive" = true,
  "updatedAt" = NOW()
WHERE "organizationId" IS NULL AND "key" = 'cameraready.reminder' AND "version" = 2;

UPDATE "notification_templates"
SET
  "subject" = $whitelabel$Registration now open — {{paperTitle}}$whitelabel$,
  "bodyHtml" = $whitelabel$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Registration is now open</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">Complete conference registration for your accepted paper.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
<tr><td style="padding:28px 32px 20px;border-bottom:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#4f46e5;">{{conferenceName}}</p>
<h1 style="margin:12px 0 0;font-size:22px;line-height:1.35;color:#0f172a;font-weight:700;">Registration is now open</h1>
</td></tr>
<tr><td style="padding:28px 32px;">
<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">Congratulations — your paper has been accepted to {{conferenceName}}.</p><p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">Registration is now open. Please complete registration and payment before the deadline to confirm your participation.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;"><tr><td style="padding:12px 16px;"><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Conference</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{conferenceName}}</td></tr><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Paper</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{paperTitle}}</td></tr><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Registration deadline</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{deadlineAt}}</td></tr></td></tr></table>


<p style="margin:16px 0 0;font-size:13px;line-height:1.55;color:#64748b;">Important: failure to register and pay by the deadline may result in withdrawal of your paper from the program.</p>
</td></tr>
<tr><td style="padding:18px 32px;background:#f8fafc;border-top:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;">Automated message from {{conferenceName}}. Please do not reply to this email.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>$whitelabel$,
  "bodyText" = $whitelabel$Registration is now open

Your paper has been accepted to {{conferenceName}}. Please complete registration before the deadline.

Conference: {{conferenceName}}
Paper: {{paperTitle}}
Registration deadline: {{deadlineAt}}

Non-payment by the deadline may withdraw your paper.

— {{conferenceName}}$whitelabel$,
  "variables" = '["paperTitle","deadlineAt","conferenceName"]'::jsonb,
  "isActive" = true,
  "updatedAt" = NOW()
WHERE "organizationId" IS NULL AND "key" = 'registration.window_open' AND "version" = 2;

UPDATE "notification_templates"
SET
  "subject" = $whitelabel$Early-bird registration ends soon$whitelabel$,
  "bodyHtml" = $whitelabel$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Early-bird registration ending soon</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">Save on registration fees before the early-bird period ends.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
<tr><td style="padding:28px 32px 20px;border-bottom:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#4f46e5;">{{conferenceName}}</p>
<h1 style="margin:12px 0 0;font-size:22px;line-height:1.35;color:#0f172a;font-weight:700;">Early-bird registration ending soon</h1>
</td></tr>
<tr><td style="padding:28px 32px;">
<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">Early-bird registration pricing for your accepted {{conferenceName}} paper will end soon.</p><p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">Complete your registration before the early-bird deadline to lock in the reduced rate.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;"><tr><td style="padding:12px 16px;"><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Conference</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{conferenceName}}</td></tr><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Paper</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{paperTitle}}</td></tr><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Early-bird ends</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{earlyBirdEndsAt}}</td></tr></td></tr></table>


<p style="margin:16px 0 0;font-size:13px;line-height:1.55;color:#64748b;">After this date, standard registration fees will apply.</p>
</td></tr>
<tr><td style="padding:18px 32px;background:#f8fafc;border-top:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;">Automated message from {{conferenceName}}. Please do not reply to this email.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>$whitelabel$,
  "bodyText" = $whitelabel$Early-bird registration ending soon

Complete {{conferenceName}} registration before early-bird pricing ends.

Conference: {{conferenceName}}
Paper: {{paperTitle}}
Early-bird ends: {{earlyBirdEndsAt}}

— {{conferenceName}}$whitelabel$,
  "variables" = '["paperTitle","earlyBirdEndsAt","conferenceName"]'::jsonb,
  "isActive" = true,
  "updatedAt" = NOW()
WHERE "organizationId" IS NULL AND "key" = 'registration.early_bird_ending' AND "version" = 2;

UPDATE "notification_templates"
SET
  "subject" = $whitelabel$Registration confirmed — {{paperTitle}}$whitelabel$,
  "bodyHtml" = $whitelabel$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Registration confirmed</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">Your {{conferenceName}} registration payment was received.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
<tr><td style="padding:28px 32px 20px;border-bottom:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#4f46e5;">{{conferenceName}}</p>
<h1 style="margin:12px 0 0;font-size:22px;line-height:1.35;color:#0f172a;font-weight:700;">Registration confirmed</h1>
</td></tr>
<tr><td style="padding:28px 32px;">
<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">Thank you — your {{conferenceName}} registration payment has been received and your participation is confirmed.</p><p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">You can download your invoice and view registration details in the {{conferenceName}} dashboard.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;"><tr><td style="padding:12px 16px;"><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Conference</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{conferenceName}}</td></tr><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Paper</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{paperTitle}}</td></tr><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Amount paid</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{amountFormatted}}</td></tr></td></tr></table>


<p style="margin:16px 0 0;font-size:13px;line-height:1.55;color:#64748b;">Keep this email for your records.</p>
</td></tr>
<tr><td style="padding:18px 32px;background:#f8fafc;border-top:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;">Automated message from {{conferenceName}}. Please do not reply to this email.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>$whitelabel$,
  "bodyText" = $whitelabel$Registration confirmed

Your {{conferenceName}} registration payment has been received.

Conference: {{conferenceName}}
Paper: {{paperTitle}}
Amount paid: {{amountFormatted}}

— {{conferenceName}}$whitelabel$,
  "variables" = '["paperTitle","amountFormatted","conferenceName"]'::jsonb,
  "isActive" = true,
  "updatedAt" = NOW()
WHERE "organizationId" IS NULL AND "key" = 'registration.confirmed' AND "version" = 2;

UPDATE "notification_templates"
SET
  "subject" = $whitelabel$Student verification approved$whitelabel$,
  "bodyHtml" = $whitelabel$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Student verification approved</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">Your student registration verification was approved.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
<tr><td style="padding:28px 32px 20px;border-bottom:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#4f46e5;">{{conferenceName}}</p>
<h1 style="margin:12px 0 0;font-size:22px;line-height:1.35;color:#0f172a;font-weight:700;">Student verification approved</h1>
</td></tr>
<tr><td style="padding:28px 32px;">
<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">Your student status documentation for {{conferenceName}} has been reviewed and approved.</p><p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">Your registration now reflects the approved student rate. No further action is required unless prompted in your dashboard.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;"><tr><td style="padding:12px 16px;"><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Conference</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{conferenceName}}</td></tr><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Paper</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{paperTitle}}</td></tr></td></tr></table>



</td></tr>
<tr><td style="padding:18px 32px;background:#f8fafc;border-top:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;">Automated message from {{conferenceName}}. Please do not reply to this email.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>$whitelabel$,
  "bodyText" = $whitelabel$Student verification approved

Your {{conferenceName}} student verification has been approved.

Conference: {{conferenceName}}
Paper: {{paperTitle}}

— {{conferenceName}}$whitelabel$,
  "variables" = '["paperTitle","conferenceName"]'::jsonb,
  "isActive" = true,
  "updatedAt" = NOW()
WHERE "organizationId" IS NULL AND "key" = 'registration.verification_approved' AND "version" = 2;

UPDATE "notification_templates"
SET
  "subject" = $whitelabel$Action needed: student verification$whitelabel$,
  "bodyHtml" = $whitelabel$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Student verification — clarification needed</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">Additional information is needed for your student verification.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
<tr><td style="padding:28px 32px 20px;border-bottom:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#4f46e5;">{{conferenceName}}</p>
<h1 style="margin:12px 0 0;font-size:22px;line-height:1.35;color:#0f172a;font-weight:700;">Student verification — clarification needed</h1>
</td></tr>
<tr><td style="padding:28px 32px;">
<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">We need additional information to complete your {{conferenceName}} student verification.</p><p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">Please review the note below and upload the requested documentation in the {{conferenceName}} dashboard.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;"><tr><td style="padding:12px 16px;"><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Conference</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{conferenceName}}</td></tr><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Paper</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{paperTitle}}</td></tr><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Committee note</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{note}}</td></tr></td></tr></table>


<p style="margin:16px 0 0;font-size:13px;line-height:1.55;color:#64748b;">Your registration may remain on hold until verification is complete.</p>
</td></tr>
<tr><td style="padding:18px 32px;background:#f8fafc;border-top:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;">Automated message from {{conferenceName}}. Please do not reply to this email.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>$whitelabel$,
  "bodyText" = $whitelabel$Student verification — clarification needed

Additional information is needed for your {{conferenceName}} student verification.

Conference: {{conferenceName}}
Paper: {{paperTitle}}
Committee note: {{note}}

— {{conferenceName}}$whitelabel$,
  "variables" = '["paperTitle","note","conferenceName"]'::jsonb,
  "isActive" = true,
  "updatedAt" = NOW()
WHERE "organizationId" IS NULL AND "key" = 'registration.clarification_requested' AND "version" = 2;

UPDATE "notification_templates"
SET
  "subject" = $whitelabel$Additional registration payment required$whitelabel$,
  "bodyHtml" = $whitelabel$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Additional payment required</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">An additional payment is required to complete registration.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
<tr><td style="padding:28px 32px 20px;border-bottom:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#4f46e5;">{{conferenceName}}</p>
<h1 style="margin:12px 0 0;font-size:22px;line-height:1.35;color:#0f172a;font-weight:700;">Additional payment required</h1>
</td></tr>
<tr><td style="padding:28px 32px;">
<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">Your student verification was not approved at the discounted rate.</p><p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">An additional registration payment is required to complete your {{conferenceName}} registration.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;"><tr><td style="padding:12px 16px;"><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Conference</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{conferenceName}}</td></tr><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Paper</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{paperTitle}}</td></tr><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Amount due</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{amountFormatted}}</td></tr></td></tr></table>


<p style="margin:16px 0 0;font-size:13px;line-height:1.55;color:#64748b;">Sign in to the {{conferenceName}} dashboard to complete the additional payment before the registration deadline.</p>
</td></tr>
<tr><td style="padding:18px 32px;background:#f8fafc;border-top:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;">Automated message from {{conferenceName}}. Please do not reply to this email.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>$whitelabel$,
  "bodyText" = $whitelabel$Additional payment required

An additional {{conferenceName}} registration payment is required.

Conference: {{conferenceName}}
Paper: {{paperTitle}}
Amount due: {{amountFormatted}}

— {{conferenceName}}$whitelabel$,
  "variables" = '["paperTitle","amountFormatted","conferenceName"]'::jsonb,
  "isActive" = true,
  "updatedAt" = NOW()
WHERE "organizationId" IS NULL AND "key" = 'registration.additional_payment_required' AND "version" = 2;

UPDATE "notification_templates"
SET
  "subject" = $whitelabel$Registration deadline approaching$whitelabel$,
  "bodyHtml" = $whitelabel$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Registration deadline approaching</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">Complete registration before the deadline to keep your paper on the program.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
<tr><td style="padding:28px 32px 20px;border-bottom:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#4f46e5;">{{conferenceName}}</p>
<h1 style="margin:12px 0 0;font-size:22px;line-height:1.35;color:#0f172a;font-weight:700;">Registration deadline approaching</h1>
</td></tr>
<tr><td style="padding:28px 32px;">
<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">Your accepted {{conferenceName}} paper still requires completed registration and payment.</p><p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">Please finalize registration before the deadline below to avoid withdrawal of your paper from the {{conferenceName}} program.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;"><tr><td style="padding:12px 16px;"><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Conference</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{conferenceName}}</td></tr><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Paper</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{paperTitle}}</td></tr><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Registration deadline</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{deadlineAt}}</td></tr></td></tr></table>


<p style="margin:16px 0 0;font-size:13px;line-height:1.55;color:#64748b;">Important: papers with unpaid registration after the deadline may be withdrawn for non-payment.</p>
</td></tr>
<tr><td style="padding:18px 32px;background:#f8fafc;border-top:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;">Automated message from {{conferenceName}}. Please do not reply to this email.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>$whitelabel$,
  "bodyText" = $whitelabel$Registration deadline approaching

Please complete {{conferenceName}} registration before the deadline.

Conference: {{conferenceName}}
Paper: {{paperTitle}}
Registration deadline: {{deadlineAt}}

Non-payment by the deadline may withdraw your paper.

— {{conferenceName}}$whitelabel$,
  "variables" = '["paperTitle","deadlineAt","conferenceName"]'::jsonb,
  "isActive" = true,
  "updatedAt" = NOW()
WHERE "organizationId" IS NULL AND "key" = 'registration.deadline_reminder' AND "version" = 2;

UPDATE "notification_templates"
SET
  "subject" = $whitelabel$Registration closed — {{paperTitle}}$whitelabel$,
  "bodyHtml" = $whitelabel$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Registration not completed</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">Registration was not completed before the deadline.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
<tr><td style="padding:28px 32px 20px;border-bottom:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#4f46e5;">{{conferenceName}}</p>
<h1 style="margin:12px 0 0;font-size:22px;line-height:1.35;color:#0f172a;font-weight:700;">Registration not completed</h1>
</td></tr>
<tr><td style="padding:28px 32px;">
<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">Registration for your accepted {{conferenceName}} paper was not completed before the deadline.</p><p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">As a result, your registration has been marked as discarded due to non-payment, and your paper may be withdrawn from the {{conferenceName}} program.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;"><tr><td style="padding:12px 16px;"><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Conference</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{conferenceName}}</td></tr><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Paper</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{paperTitle}}</td></tr></td></tr></table>


<p style="margin:16px 0 0;font-size:13px;line-height:1.55;color:#64748b;">If you believe this is an error or need assistance, please contact the {{conferenceName}} organizers directly.</p>
</td></tr>
<tr><td style="padding:18px 32px;background:#f8fafc;border-top:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;">Automated message from {{conferenceName}}. Please do not reply to this email.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>$whitelabel$,
  "bodyText" = $whitelabel$Registration not completed

{{conferenceName}} registration was not completed before the deadline and has been discarded due to non-payment.

Conference: {{conferenceName}}
Paper: {{paperTitle}}

— {{conferenceName}}$whitelabel$,
  "variables" = '["paperTitle","conferenceName"]'::jsonb,
  "isActive" = true,
  "updatedAt" = NOW()
WHERE "organizationId" IS NULL AND "key" = 'registration.discarded' AND "version" = 2;
