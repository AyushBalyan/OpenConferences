-- Notification template content v2 (improved copy, HTML layout, plain-text bodies)
UPDATE "notification_templates" SET "isActive" = false WHERE "organizationId" IS NULL AND version = 1;

INSERT INTO "notification_templates" ("id", "organizationId", "key", "version", "locale", "subject", "bodyHtml", "bodyText", "variables", "isActive", "createdAt", "updatedAt")
SELECT 'a2000001-0000-4000-8000-000000000001', NULL, 'auth.email_verify', 2, 'en', 'Verify your email for OpenConferences', '<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Verify your email address</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">Confirm your email to access submissions, reviews, and registrations.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
<tr><td style="padding:28px 32px 20px;border-bottom:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#4f46e5;">OpenConferences</p>
<h1 style="margin:12px 0 0;font-size:22px;line-height:1.35;color:#0f172a;font-weight:700;">Verify your email address</h1>
</td></tr>
<tr><td style="padding:28px 32px;">
<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">Thanks for creating an OpenConferences account.</p><p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">Please confirm your email address to sign in, submit papers, accept reviewer invitations, and manage conference registrations.</p>


<table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px 0 8px;"><tr><td style="border-radius:8px;background:#4f46e5;"><a href="{{verifyUrl}}" style="display:inline-block;padding:13px 28px;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">Verify email address</a></td></tr></table>
<p style="margin:16px 0 0;font-size:13px;line-height:1.55;color:#64748b;">If you did not create an account, you can safely ignore this email. This link may expire after a short period.</p>
</td></tr>
<tr><td style="padding:18px 32px;background:#f8fafc;border-top:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;">Automated message from OpenConferences. Please do not reply to this email.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>', 'Verify your email address

Thanks for creating an OpenConferences account.

Please confirm your email address to sign in and use the platform.

Verify email address: {{verifyUrl}}

If you did not create an account, you can ignore this email.

— OpenConferences', '["verifyUrl"]'::jsonb, true, NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "notification_templates"
  WHERE "organizationId" IS NULL AND "key" = 'auth.email_verify' AND "version" = 2
);
UPDATE "notification_templates" SET "subject" = 'Verify your email for OpenConferences', "bodyHtml" = '<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Verify your email address</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">Confirm your email to access submissions, reviews, and registrations.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
<tr><td style="padding:28px 32px 20px;border-bottom:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#4f46e5;">OpenConferences</p>
<h1 style="margin:12px 0 0;font-size:22px;line-height:1.35;color:#0f172a;font-weight:700;">Verify your email address</h1>
</td></tr>
<tr><td style="padding:28px 32px;">
<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">Thanks for creating an OpenConferences account.</p><p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">Please confirm your email address to sign in, submit papers, accept reviewer invitations, and manage conference registrations.</p>


<table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px 0 8px;"><tr><td style="border-radius:8px;background:#4f46e5;"><a href="{{verifyUrl}}" style="display:inline-block;padding:13px 28px;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">Verify email address</a></td></tr></table>
<p style="margin:16px 0 0;font-size:13px;line-height:1.55;color:#64748b;">If you did not create an account, you can safely ignore this email. This link may expire after a short period.</p>
</td></tr>
<tr><td style="padding:18px 32px;background:#f8fafc;border-top:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;">Automated message from OpenConferences. Please do not reply to this email.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>', "bodyText" = 'Verify your email address

Thanks for creating an OpenConferences account.

Please confirm your email address to sign in and use the platform.

Verify email address: {{verifyUrl}}

If you did not create an account, you can ignore this email.

— OpenConferences', "variables" = '["verifyUrl"]'::jsonb, "isActive" = true, "updatedAt" = NOW()
WHERE "organizationId" IS NULL AND "key" = 'auth.email_verify' AND "version" = 2;

INSERT INTO "notification_templates" ("id", "organizationId", "key", "version", "locale", "subject", "bodyHtml", "bodyText", "variables", "isActive", "createdAt", "updatedAt")
SELECT 'a2000001-0000-4000-8000-000000000002', NULL, 'auth.password_reset', 2, 'en', 'Reset your OpenConferences password', '<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Reset your password</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">Use this link to choose a new password for your account.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
<tr><td style="padding:28px 32px 20px;border-bottom:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#4f46e5;">OpenConferences</p>
<h1 style="margin:12px 0 0;font-size:22px;line-height:1.35;color:#0f172a;font-weight:700;">Reset your password</h1>
</td></tr>
<tr><td style="padding:28px 32px;">
<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">We received a request to reset the password for your OpenConferences account.</p><p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">Click the button below to choose a new password. For your security, this link can only be used once.</p>


<table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px 0 8px;"><tr><td style="border-radius:8px;background:#4f46e5;"><a href="{{resetUrl}}" style="display:inline-block;padding:13px 28px;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">Reset password</a></td></tr></table>
<p style="margin:16px 0 0;font-size:13px;line-height:1.55;color:#64748b;">If you did not request a password reset, you can ignore this email. Your password will not change.</p>
</td></tr>
<tr><td style="padding:18px 32px;background:#f8fafc;border-top:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;">Automated message from OpenConferences. Please do not reply to this email.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>', 'Reset your password

We received a request to reset your OpenConferences password.

Use the link below to choose a new password.

Reset password: {{resetUrl}}

If you did not request this, ignore this email.

— OpenConferences', '["resetUrl"]'::jsonb, true, NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "notification_templates"
  WHERE "organizationId" IS NULL AND "key" = 'auth.password_reset' AND "version" = 2
);
UPDATE "notification_templates" SET "subject" = 'Reset your OpenConferences password', "bodyHtml" = '<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Reset your password</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">Use this link to choose a new password for your account.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
<tr><td style="padding:28px 32px 20px;border-bottom:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#4f46e5;">OpenConferences</p>
<h1 style="margin:12px 0 0;font-size:22px;line-height:1.35;color:#0f172a;font-weight:700;">Reset your password</h1>
</td></tr>
<tr><td style="padding:28px 32px;">
<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">We received a request to reset the password for your OpenConferences account.</p><p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">Click the button below to choose a new password. For your security, this link can only be used once.</p>


<table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px 0 8px;"><tr><td style="border-radius:8px;background:#4f46e5;"><a href="{{resetUrl}}" style="display:inline-block;padding:13px 28px;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">Reset password</a></td></tr></table>
<p style="margin:16px 0 0;font-size:13px;line-height:1.55;color:#64748b;">If you did not request a password reset, you can ignore this email. Your password will not change.</p>
</td></tr>
<tr><td style="padding:18px 32px;background:#f8fafc;border-top:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;">Automated message from OpenConferences. Please do not reply to this email.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>', "bodyText" = 'Reset your password

We received a request to reset your OpenConferences password.

Use the link below to choose a new password.

Reset password: {{resetUrl}}

If you did not request this, ignore this email.

— OpenConferences', "variables" = '["resetUrl"]'::jsonb, "isActive" = true, "updatedAt" = NOW()
WHERE "organizationId" IS NULL AND "key" = 'auth.password_reset' AND "version" = 2;

INSERT INTO "notification_templates" ("id", "organizationId", "key", "version", "locale", "subject", "bodyHtml", "bodyText", "variables", "isActive", "createdAt", "updatedAt")
SELECT 'a2000001-0000-4000-8000-000000000003', NULL, 'submission.confirmed', 2, 'en', 'Submission received: {{paperTitle}}', '<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Submission confirmed</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">Your paper has been successfully submitted.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
<tr><td style="padding:28px 32px 20px;border-bottom:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#4f46e5;">OpenConferences</p>
<h1 style="margin:12px 0 0;font-size:22px;line-height:1.35;color:#0f172a;font-weight:700;">Submission confirmed</h1>
</td></tr>
<tr><td style="padding:28px 32px;">
<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">Your paper has been successfully submitted to the conference.</p><p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">You can return to OpenConferences at any time to view submission details, upload revisions, and track review progress.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;"><tr><td style="padding:12px 16px;"><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Paper title</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{paperTitle}}</td></tr></td></tr></table>


<p style="margin:16px 0 0;font-size:13px;line-height:1.55;color:#64748b;">You will receive further updates by email as your submission moves through review and decision stages.</p>
</td></tr>
<tr><td style="padding:18px 32px;background:#f8fafc;border-top:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;">Automated message from OpenConferences. Please do not reply to this email.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>', 'Submission confirmed

Your paper has been successfully submitted to the conference.

Paper title: paperTitle

— OpenConferences', '["paperTitle"]'::jsonb, true, NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "notification_templates"
  WHERE "organizationId" IS NULL AND "key" = 'submission.confirmed' AND "version" = 2
);
UPDATE "notification_templates" SET "subject" = 'Submission received: {{paperTitle}}', "bodyHtml" = '<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Submission confirmed</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">Your paper has been successfully submitted.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
<tr><td style="padding:28px 32px 20px;border-bottom:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#4f46e5;">OpenConferences</p>
<h1 style="margin:12px 0 0;font-size:22px;line-height:1.35;color:#0f172a;font-weight:700;">Submission confirmed</h1>
</td></tr>
<tr><td style="padding:28px 32px;">
<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">Your paper has been successfully submitted to the conference.</p><p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">You can return to OpenConferences at any time to view submission details, upload revisions, and track review progress.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;"><tr><td style="padding:12px 16px;"><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Paper title</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{paperTitle}}</td></tr></td></tr></table>


<p style="margin:16px 0 0;font-size:13px;line-height:1.55;color:#64748b;">You will receive further updates by email as your submission moves through review and decision stages.</p>
</td></tr>
<tr><td style="padding:18px 32px;background:#f8fafc;border-top:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;">Automated message from OpenConferences. Please do not reply to this email.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>', "bodyText" = 'Submission confirmed

Your paper has been successfully submitted to the conference.

Paper title: paperTitle

— OpenConferences', "variables" = '["paperTitle"]'::jsonb, "isActive" = true, "updatedAt" = NOW()
WHERE "organizationId" IS NULL AND "key" = 'submission.confirmed' AND "version" = 2;

INSERT INTO "notification_templates" ("id", "organizationId", "key", "version", "locale", "subject", "bodyHtml", "bodyText", "variables", "isActive", "createdAt", "updatedAt")
SELECT 'a2000001-0000-4000-8000-000000000004', NULL, 'reviewer.invitation', 2, 'en', 'Reviewer invitation — {{conferenceName}}', '<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>You are invited to review</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">You have been invited to join the program committee as a reviewer.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
<tr><td style="padding:28px 32px 20px;border-bottom:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#4f46e5;">OpenConferences</p>
<h1 style="margin:12px 0 0;font-size:22px;line-height:1.35;color:#0f172a;font-weight:700;">You are invited to review</h1>
</td></tr>
<tr><td style="padding:28px 32px;">
<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">The organizers of <strong>{{conferenceName}}</strong> have invited you to serve as a reviewer.</p><p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">Sign up or sign in with this email address to accept the invitation and access assigned papers, bidding, and review forms.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;"><tr><td style="padding:12px 16px;"><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Invitation expires</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{expiresAt}}</td></tr></td></tr></table>

<table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px 0 8px;"><tr><td style="border-radius:8px;background:#4f46e5;"><a href="{{signupUrl}}" style="display:inline-block;padding:13px 28px;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">Accept invitation</a></td></tr></table>
<p style="margin:16px 0 0;font-size:13px;line-height:1.55;color:#64748b;">Use the same email address that received this invitation. If you were not expecting this invite, you may decline or ignore this message.</p>
</td></tr>
<tr><td style="padding:18px 32px;background:#f8fafc;border-top:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;">Automated message from OpenConferences. Please do not reply to this email.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>', 'Reviewer invitation

You have been invited to review for {{conferenceName}}.

Sign up or sign in with this email address to accept.

Invitation expires: expiresAt

Accept invitation: {{signupUrl}}

— OpenConferences', '["conferenceName","signupUrl","expiresAt"]'::jsonb, true, NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "notification_templates"
  WHERE "organizationId" IS NULL AND "key" = 'reviewer.invitation' AND "version" = 2
);
UPDATE "notification_templates" SET "subject" = 'Reviewer invitation — {{conferenceName}}', "bodyHtml" = '<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>You are invited to review</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">You have been invited to join the program committee as a reviewer.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
<tr><td style="padding:28px 32px 20px;border-bottom:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#4f46e5;">OpenConferences</p>
<h1 style="margin:12px 0 0;font-size:22px;line-height:1.35;color:#0f172a;font-weight:700;">You are invited to review</h1>
</td></tr>
<tr><td style="padding:28px 32px;">
<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">The organizers of <strong>{{conferenceName}}</strong> have invited you to serve as a reviewer.</p><p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">Sign up or sign in with this email address to accept the invitation and access assigned papers, bidding, and review forms.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;"><tr><td style="padding:12px 16px;"><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Invitation expires</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{expiresAt}}</td></tr></td></tr></table>

<table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px 0 8px;"><tr><td style="border-radius:8px;background:#4f46e5;"><a href="{{signupUrl}}" style="display:inline-block;padding:13px 28px;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">Accept invitation</a></td></tr></table>
<p style="margin:16px 0 0;font-size:13px;line-height:1.55;color:#64748b;">Use the same email address that received this invitation. If you were not expecting this invite, you may decline or ignore this message.</p>
</td></tr>
<tr><td style="padding:18px 32px;background:#f8fafc;border-top:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;">Automated message from OpenConferences. Please do not reply to this email.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>', "bodyText" = 'Reviewer invitation

You have been invited to review for {{conferenceName}}.

Sign up or sign in with this email address to accept.

Invitation expires: expiresAt

Accept invitation: {{signupUrl}}

— OpenConferences', "variables" = '["conferenceName","signupUrl","expiresAt"]'::jsonb, "isActive" = true, "updatedAt" = NOW()
WHERE "organizationId" IS NULL AND "key" = 'reviewer.invitation' AND "version" = 2;

INSERT INTO "notification_templates" ("id", "organizationId", "key", "version", "locale", "subject", "bodyHtml", "bodyText", "variables", "isActive", "createdAt", "updatedAt")
SELECT 'a2000001-0000-4000-8000-000000000005', NULL, 'assignment.notified', 2, 'en', 'New review assignment: {{paperTitle}}', '<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>New review assignment</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">A paper has been assigned to you for review.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
<tr><td style="padding:28px 32px 20px;border-bottom:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#4f46e5;">OpenConferences</p>
<h1 style="margin:12px 0 0;font-size:22px;line-height:1.35;color:#0f172a;font-weight:700;">New review assignment</h1>
</td></tr>
<tr><td style="padding:28px 32px;">
<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">You have been assigned a paper to review. Please sign in to OpenConferences to read the submission, declare any conflicts of interest, and submit your review before the due date.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;"><tr><td style="padding:12px 16px;"><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Paper</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{paperTitle}}</td></tr><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Review round</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{roundNumber}}</td></tr><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Due date</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{dueAt}}</td></tr></td></tr></table>


<p style="margin:16px 0 0;font-size:13px;line-height:1.55;color:#64748b;">If you have a conflict of interest with this submission, declare it in the platform before starting your review.</p>
</td></tr>
<tr><td style="padding:18px 32px;background:#f8fafc;border-top:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;">Automated message from OpenConferences. Please do not reply to this email.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>', 'New review assignment

You have been assigned a paper to review. Please sign in to OpenConferences to complete your review.

Paper: paperTitle
Review round: roundNumber
Due date: dueAt

— OpenConferences', '["paperTitle","roundNumber","dueAt"]'::jsonb, true, NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "notification_templates"
  WHERE "organizationId" IS NULL AND "key" = 'assignment.notified' AND "version" = 2
);
UPDATE "notification_templates" SET "subject" = 'New review assignment: {{paperTitle}}', "bodyHtml" = '<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>New review assignment</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">A paper has been assigned to you for review.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
<tr><td style="padding:28px 32px 20px;border-bottom:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#4f46e5;">OpenConferences</p>
<h1 style="margin:12px 0 0;font-size:22px;line-height:1.35;color:#0f172a;font-weight:700;">New review assignment</h1>
</td></tr>
<tr><td style="padding:28px 32px;">
<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">You have been assigned a paper to review. Please sign in to OpenConferences to read the submission, declare any conflicts of interest, and submit your review before the due date.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;"><tr><td style="padding:12px 16px;"><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Paper</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{paperTitle}}</td></tr><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Review round</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{roundNumber}}</td></tr><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Due date</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{dueAt}}</td></tr></td></tr></table>


<p style="margin:16px 0 0;font-size:13px;line-height:1.55;color:#64748b;">If you have a conflict of interest with this submission, declare it in the platform before starting your review.</p>
</td></tr>
<tr><td style="padding:18px 32px;background:#f8fafc;border-top:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;">Automated message from OpenConferences. Please do not reply to this email.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>', "bodyText" = 'New review assignment

You have been assigned a paper to review. Please sign in to OpenConferences to complete your review.

Paper: paperTitle
Review round: roundNumber
Due date: dueAt

— OpenConferences', "variables" = '["paperTitle","roundNumber","dueAt"]'::jsonb, "isActive" = true, "updatedAt" = NOW()
WHERE "organizationId" IS NULL AND "key" = 'assignment.notified' AND "version" = 2;

INSERT INTO "notification_templates" ("id", "organizationId", "key", "version", "locale", "subject", "bodyHtml", "bodyText", "variables", "isActive", "createdAt", "updatedAt")
SELECT 'a2000001-0000-4000-8000-000000000006', NULL, 'review.reminder', 2, 'en', 'Review due soon: {{paperTitle}}', '<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Review deadline approaching</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">Friendly reminder to submit your assigned review.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
<tr><td style="padding:28px 32px 20px;border-bottom:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#4f46e5;">OpenConferences</p>
<h1 style="margin:12px 0 0;font-size:22px;line-height:1.35;color:#0f172a;font-weight:700;">Review deadline approaching</h1>
</td></tr>
<tr><td style="padding:28px 32px;">
<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">This is a reminder that your review for the paper below is due soon.</p><p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">Please sign in to OpenConferences to submit your review or update your draft before the deadline.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;"><tr><td style="padding:12px 16px;"><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Paper</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{paperTitle}}</td></tr><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Due date</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{dueAt}}</td></tr></td></tr></table>


<p style="margin:16px 0 0;font-size:13px;line-height:1.55;color:#64748b;">Late reviews may delay editorial decisions for authors.</p>
</td></tr>
<tr><td style="padding:18px 32px;background:#f8fafc;border-top:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;">Automated message from OpenConferences. Please do not reply to this email.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>', 'Review deadline approaching

Please submit your review before the due date.

Paper: paperTitle
Due date: dueAt

— OpenConferences', '["paperTitle","dueAt"]'::jsonb, true, NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "notification_templates"
  WHERE "organizationId" IS NULL AND "key" = 'review.reminder' AND "version" = 2
);
UPDATE "notification_templates" SET "subject" = 'Review due soon: {{paperTitle}}', "bodyHtml" = '<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Review deadline approaching</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">Friendly reminder to submit your assigned review.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
<tr><td style="padding:28px 32px 20px;border-bottom:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#4f46e5;">OpenConferences</p>
<h1 style="margin:12px 0 0;font-size:22px;line-height:1.35;color:#0f172a;font-weight:700;">Review deadline approaching</h1>
</td></tr>
<tr><td style="padding:28px 32px;">
<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">This is a reminder that your review for the paper below is due soon.</p><p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">Please sign in to OpenConferences to submit your review or update your draft before the deadline.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;"><tr><td style="padding:12px 16px;"><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Paper</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{paperTitle}}</td></tr><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Due date</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{dueAt}}</td></tr></td></tr></table>


<p style="margin:16px 0 0;font-size:13px;line-height:1.55;color:#64748b;">Late reviews may delay editorial decisions for authors.</p>
</td></tr>
<tr><td style="padding:18px 32px;background:#f8fafc;border-top:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;">Automated message from OpenConferences. Please do not reply to this email.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>', "bodyText" = 'Review deadline approaching

Please submit your review before the due date.

Paper: paperTitle
Due date: dueAt

— OpenConferences', "variables" = '["paperTitle","dueAt"]'::jsonb, "isActive" = true, "updatedAt" = NOW()
WHERE "organizationId" IS NULL AND "key" = 'review.reminder' AND "version" = 2;

INSERT INTO "notification_templates" ("id", "organizationId", "key", "version", "locale", "subject", "bodyHtml", "bodyText", "variables", "isActive", "createdAt", "updatedAt")
SELECT 'a2000001-0000-4000-8000-000000000007', NULL, 'decision.notified', 2, 'en', 'Editorial decision — {{outcomeLabel}}: {{paperTitle}}', '<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Editorial decision: {{outcomeLabel}}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">The editorial decision for your submission is now available.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
<tr><td style="padding:28px 32px 20px;border-bottom:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#4f46e5;">OpenConferences</p>
<h1 style="margin:12px 0 0;font-size:22px;line-height:1.35;color:#0f172a;font-weight:700;">Editorial decision: {{outcomeLabel}}</h1>
</td></tr>
<tr><td style="padding:28px 32px;">
<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">The program committee has reached an editorial decision regarding your submission.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;"><tr><td style="padding:12px 16px;"><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Paper</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{paperTitle}}</td></tr><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Decision</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{outcomeLabel}}</td></tr></td></tr></table>
<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#334155;">{{rationaleBlock}}</p><p style="margin:0;font-size:15px;line-height:1.6;color:#334155;">{{acceptBlock}}</p>

<p style="margin:16px 0 0;font-size:13px;line-height:1.55;color:#64748b;">Sign in to OpenConferences to view full details, reviewer feedback (when released), and next steps for your submission.</p>
</td></tr>
<tr><td style="padding:18px 32px;background:#f8fafc;border-top:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;">Automated message from OpenConferences. Please do not reply to this email.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>', 'Editorial decision: {{outcomeLabel}}

The program committee has reached a decision on your submission.

Paper: paperTitle
Decision: outcomeLabel

{{rationaleBlock}}

{{acceptBlock}}

— OpenConferences', '["paperTitle","outcomeLabel","rationaleBlock","acceptBlock"]'::jsonb, true, NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "notification_templates"
  WHERE "organizationId" IS NULL AND "key" = 'decision.notified' AND "version" = 2
);
UPDATE "notification_templates" SET "subject" = 'Editorial decision — {{outcomeLabel}}: {{paperTitle}}', "bodyHtml" = '<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Editorial decision: {{outcomeLabel}}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">The editorial decision for your submission is now available.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
<tr><td style="padding:28px 32px 20px;border-bottom:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#4f46e5;">OpenConferences</p>
<h1 style="margin:12px 0 0;font-size:22px;line-height:1.35;color:#0f172a;font-weight:700;">Editorial decision: {{outcomeLabel}}</h1>
</td></tr>
<tr><td style="padding:28px 32px;">
<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">The program committee has reached an editorial decision regarding your submission.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;"><tr><td style="padding:12px 16px;"><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Paper</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{paperTitle}}</td></tr><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Decision</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{outcomeLabel}}</td></tr></td></tr></table>
<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#334155;">{{rationaleBlock}}</p><p style="margin:0;font-size:15px;line-height:1.6;color:#334155;">{{acceptBlock}}</p>

<p style="margin:16px 0 0;font-size:13px;line-height:1.55;color:#64748b;">Sign in to OpenConferences to view full details, reviewer feedback (when released), and next steps for your submission.</p>
</td></tr>
<tr><td style="padding:18px 32px;background:#f8fafc;border-top:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;">Automated message from OpenConferences. Please do not reply to this email.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>', "bodyText" = 'Editorial decision: {{outcomeLabel}}

The program committee has reached a decision on your submission.

Paper: paperTitle
Decision: outcomeLabel

{{rationaleBlock}}

{{acceptBlock}}

— OpenConferences', "variables" = '["paperTitle","outcomeLabel","rationaleBlock","acceptBlock"]'::jsonb, "isActive" = true, "updatedAt" = NOW()
WHERE "organizationId" IS NULL AND "key" = 'decision.notified' AND "version" = 2;

INSERT INTO "notification_templates" ("id", "organizationId", "key", "version", "locale", "subject", "bodyHtml", "bodyText", "variables", "isActive", "createdAt", "updatedAt")
SELECT 'a2000001-0000-4000-8000-000000000008', NULL, 'review.released', 2, 'en', 'Reviewer feedback available: {{paperTitle}}', '<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Reviewer feedback released</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">Review feedback for your paper is now visible in your dashboard.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
<tr><td style="padding:28px 32px 20px;border-bottom:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#4f46e5;">OpenConferences</p>
<h1 style="margin:12px 0 0;font-size:22px;line-height:1.35;color:#0f172a;font-weight:700;">Reviewer feedback released</h1>
</td></tr>
<tr><td style="padding:28px 32px;">
<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">Review feedback for your submission is now available in OpenConferences.</p><p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">You may read the released reviews and, if the conference allows it, submit a rebuttal before the rebuttal deadline.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;"><tr><td style="padding:12px 16px;"><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Paper</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{paperTitle}}</td></tr></td></tr></table>


<p style="margin:16px 0 0;font-size:13px;line-height:1.55;color:#64748b;">Sign in to your author dashboard to read reviews and respond.</p>
</td></tr>
<tr><td style="padding:18px 32px;background:#f8fafc;border-top:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;">Automated message from OpenConferences. Please do not reply to this email.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>', 'Reviewer feedback released

Review feedback for your paper is now available.

Sign in to OpenConferences to read reviews and submit a rebuttal if applicable.

Paper: paperTitle

— OpenConferences', '["paperTitle"]'::jsonb, true, NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "notification_templates"
  WHERE "organizationId" IS NULL AND "key" = 'review.released' AND "version" = 2
);
UPDATE "notification_templates" SET "subject" = 'Reviewer feedback available: {{paperTitle}}', "bodyHtml" = '<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Reviewer feedback released</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">Review feedback for your paper is now visible in your dashboard.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
<tr><td style="padding:28px 32px 20px;border-bottom:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#4f46e5;">OpenConferences</p>
<h1 style="margin:12px 0 0;font-size:22px;line-height:1.35;color:#0f172a;font-weight:700;">Reviewer feedback released</h1>
</td></tr>
<tr><td style="padding:28px 32px;">
<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">Review feedback for your submission is now available in OpenConferences.</p><p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">You may read the released reviews and, if the conference allows it, submit a rebuttal before the rebuttal deadline.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;"><tr><td style="padding:12px 16px;"><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Paper</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{paperTitle}}</td></tr></td></tr></table>


<p style="margin:16px 0 0;font-size:13px;line-height:1.55;color:#64748b;">Sign in to your author dashboard to read reviews and respond.</p>
</td></tr>
<tr><td style="padding:18px 32px;background:#f8fafc;border-top:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;">Automated message from OpenConferences. Please do not reply to this email.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>', "bodyText" = 'Reviewer feedback released

Review feedback for your paper is now available.

Sign in to OpenConferences to read reviews and submit a rebuttal if applicable.

Paper: paperTitle

— OpenConferences', "variables" = '["paperTitle"]'::jsonb, "isActive" = true, "updatedAt" = NOW()
WHERE "organizationId" IS NULL AND "key" = 'review.released' AND "version" = 2;

INSERT INTO "notification_templates" ("id", "organizationId", "key", "version", "locale", "subject", "bodyHtml", "bodyText", "variables", "isActive", "createdAt", "updatedAt")
SELECT 'a2000001-0000-4000-8000-000000000009', NULL, 'cameraready.reminder', 2, 'en', 'Camera-ready due soon: {{paperTitle}}', '<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Camera-ready deadline approaching</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">Upload your final camera-ready version before the deadline.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
<tr><td style="padding:28px 32px 20px;border-bottom:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#4f46e5;">OpenConferences</p>
<h1 style="margin:12px 0 0;font-size:22px;line-height:1.35;color:#0f172a;font-weight:700;">Camera-ready deadline approaching</h1>
</td></tr>
<tr><td style="padding:28px 32px;">
<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">Your accepted paper requires a camera-ready version before it can be included in the conference proceedings.</p><p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">Please upload the final PDF through OpenConferences before the deadline below.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;"><tr><td style="padding:12px 16px;"><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Paper</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{paperTitle}}</td></tr><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Deadline</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{deadlineAt}}</td></tr></td></tr></table>


<p style="margin:16px 0 0;font-size:13px;line-height:1.55;color:#64748b;">Missing the camera-ready deadline may affect publication of your paper.</p>
</td></tr>
<tr><td style="padding:18px 32px;background:#f8fafc;border-top:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;">Automated message from OpenConferences. Please do not reply to this email.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>', 'Camera-ready deadline approaching

Please upload your camera-ready version before the deadline.

Paper: paperTitle
Deadline: deadlineAt

— OpenConferences', '["paperTitle","deadlineAt"]'::jsonb, true, NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "notification_templates"
  WHERE "organizationId" IS NULL AND "key" = 'cameraready.reminder' AND "version" = 2
);
UPDATE "notification_templates" SET "subject" = 'Camera-ready due soon: {{paperTitle}}', "bodyHtml" = '<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Camera-ready deadline approaching</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">Upload your final camera-ready version before the deadline.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
<tr><td style="padding:28px 32px 20px;border-bottom:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#4f46e5;">OpenConferences</p>
<h1 style="margin:12px 0 0;font-size:22px;line-height:1.35;color:#0f172a;font-weight:700;">Camera-ready deadline approaching</h1>
</td></tr>
<tr><td style="padding:28px 32px;">
<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">Your accepted paper requires a camera-ready version before it can be included in the conference proceedings.</p><p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">Please upload the final PDF through OpenConferences before the deadline below.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;"><tr><td style="padding:12px 16px;"><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Paper</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{paperTitle}}</td></tr><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Deadline</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{deadlineAt}}</td></tr></td></tr></table>


<p style="margin:16px 0 0;font-size:13px;line-height:1.55;color:#64748b;">Missing the camera-ready deadline may affect publication of your paper.</p>
</td></tr>
<tr><td style="padding:18px 32px;background:#f8fafc;border-top:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;">Automated message from OpenConferences. Please do not reply to this email.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>', "bodyText" = 'Camera-ready deadline approaching

Please upload your camera-ready version before the deadline.

Paper: paperTitle
Deadline: deadlineAt

— OpenConferences', "variables" = '["paperTitle","deadlineAt"]'::jsonb, "isActive" = true, "updatedAt" = NOW()
WHERE "organizationId" IS NULL AND "key" = 'cameraready.reminder' AND "version" = 2;

INSERT INTO "notification_templates" ("id", "organizationId", "key", "version", "locale", "subject", "bodyHtml", "bodyText", "variables", "isActive", "createdAt", "updatedAt")
SELECT 'a2000001-0000-4000-8000-000000000010', NULL, 'registration.window_open', 2, 'en', 'Registration now open — {{paperTitle}}', '<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Registration is now open</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">Complete conference registration for your accepted paper.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
<tr><td style="padding:28px 32px 20px;border-bottom:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#4f46e5;">OpenConferences</p>
<h1 style="margin:12px 0 0;font-size:22px;line-height:1.35;color:#0f172a;font-weight:700;">Registration is now open</h1>
</td></tr>
<tr><td style="padding:28px 32px;">
<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">Congratulations — your paper has been accepted.</p><p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">Conference registration is now open. Please complete registration and payment before the deadline to confirm your participation.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;"><tr><td style="padding:12px 16px;"><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Paper</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{paperTitle}}</td></tr><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Registration deadline</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{deadlineAt}}</td></tr></td></tr></table>


<p style="margin:16px 0 0;font-size:13px;line-height:1.55;color:#64748b;">Important: failure to register and pay by the deadline may result in withdrawal of your paper from the program.</p>
</td></tr>
<tr><td style="padding:18px 32px;background:#f8fafc;border-top:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;">Automated message from OpenConferences. Please do not reply to this email.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>', 'Registration is now open

Your paper has been accepted. Please complete registration before the deadline.

Paper: paperTitle
Registration deadline: deadlineAt

Non-payment by the deadline may withdraw your paper.

— OpenConferences', '["paperTitle","deadlineAt"]'::jsonb, true, NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "notification_templates"
  WHERE "organizationId" IS NULL AND "key" = 'registration.window_open' AND "version" = 2
);
UPDATE "notification_templates" SET "subject" = 'Registration now open — {{paperTitle}}', "bodyHtml" = '<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Registration is now open</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">Complete conference registration for your accepted paper.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
<tr><td style="padding:28px 32px 20px;border-bottom:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#4f46e5;">OpenConferences</p>
<h1 style="margin:12px 0 0;font-size:22px;line-height:1.35;color:#0f172a;font-weight:700;">Registration is now open</h1>
</td></tr>
<tr><td style="padding:28px 32px;">
<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">Congratulations — your paper has been accepted.</p><p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">Conference registration is now open. Please complete registration and payment before the deadline to confirm your participation.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;"><tr><td style="padding:12px 16px;"><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Paper</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{paperTitle}}</td></tr><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Registration deadline</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{deadlineAt}}</td></tr></td></tr></table>


<p style="margin:16px 0 0;font-size:13px;line-height:1.55;color:#64748b;">Important: failure to register and pay by the deadline may result in withdrawal of your paper from the program.</p>
</td></tr>
<tr><td style="padding:18px 32px;background:#f8fafc;border-top:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;">Automated message from OpenConferences. Please do not reply to this email.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>', "bodyText" = 'Registration is now open

Your paper has been accepted. Please complete registration before the deadline.

Paper: paperTitle
Registration deadline: deadlineAt

Non-payment by the deadline may withdraw your paper.

— OpenConferences', "variables" = '["paperTitle","deadlineAt"]'::jsonb, "isActive" = true, "updatedAt" = NOW()
WHERE "organizationId" IS NULL AND "key" = 'registration.window_open' AND "version" = 2;

INSERT INTO "notification_templates" ("id", "organizationId", "key", "version", "locale", "subject", "bodyHtml", "bodyText", "variables", "isActive", "createdAt", "updatedAt")
SELECT 'a2000001-0000-4000-8000-000000000011', NULL, 'registration.early_bird_ending', 2, 'en', 'Early-bird registration ends soon', '<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Early-bird registration ending soon</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">Save on registration fees before the early-bird period ends.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
<tr><td style="padding:28px 32px 20px;border-bottom:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#4f46e5;">OpenConferences</p>
<h1 style="margin:12px 0 0;font-size:22px;line-height:1.35;color:#0f172a;font-weight:700;">Early-bird registration ending soon</h1>
</td></tr>
<tr><td style="padding:28px 32px;">
<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">Early-bird registration pricing for your accepted paper will end soon.</p><p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">Complete your registration before the early-bird deadline to lock in the reduced rate.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;"><tr><td style="padding:12px 16px;"><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Paper</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{paperTitle}}</td></tr><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Early-bird ends</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{earlyBirdEndsAt}}</td></tr></td></tr></table>


<p style="margin:16px 0 0;font-size:13px;line-height:1.55;color:#64748b;">After this date, standard registration fees will apply.</p>
</td></tr>
<tr><td style="padding:18px 32px;background:#f8fafc;border-top:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;">Automated message from OpenConferences. Please do not reply to this email.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>', 'Early-bird registration ending soon

Complete registration before early-bird pricing ends.

Paper: paperTitle
Early-bird ends: earlyBirdEndsAt

— OpenConferences', '["paperTitle","earlyBirdEndsAt"]'::jsonb, true, NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "notification_templates"
  WHERE "organizationId" IS NULL AND "key" = 'registration.early_bird_ending' AND "version" = 2
);
UPDATE "notification_templates" SET "subject" = 'Early-bird registration ends soon', "bodyHtml" = '<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Early-bird registration ending soon</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">Save on registration fees before the early-bird period ends.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
<tr><td style="padding:28px 32px 20px;border-bottom:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#4f46e5;">OpenConferences</p>
<h1 style="margin:12px 0 0;font-size:22px;line-height:1.35;color:#0f172a;font-weight:700;">Early-bird registration ending soon</h1>
</td></tr>
<tr><td style="padding:28px 32px;">
<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">Early-bird registration pricing for your accepted paper will end soon.</p><p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">Complete your registration before the early-bird deadline to lock in the reduced rate.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;"><tr><td style="padding:12px 16px;"><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Paper</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{paperTitle}}</td></tr><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Early-bird ends</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{earlyBirdEndsAt}}</td></tr></td></tr></table>


<p style="margin:16px 0 0;font-size:13px;line-height:1.55;color:#64748b;">After this date, standard registration fees will apply.</p>
</td></tr>
<tr><td style="padding:18px 32px;background:#f8fafc;border-top:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;">Automated message from OpenConferences. Please do not reply to this email.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>', "bodyText" = 'Early-bird registration ending soon

Complete registration before early-bird pricing ends.

Paper: paperTitle
Early-bird ends: earlyBirdEndsAt

— OpenConferences', "variables" = '["paperTitle","earlyBirdEndsAt"]'::jsonb, "isActive" = true, "updatedAt" = NOW()
WHERE "organizationId" IS NULL AND "key" = 'registration.early_bird_ending' AND "version" = 2;

INSERT INTO "notification_templates" ("id", "organizationId", "key", "version", "locale", "subject", "bodyHtml", "bodyText", "variables", "isActive", "createdAt", "updatedAt")
SELECT 'a2000001-0000-4000-8000-000000000012', NULL, 'registration.confirmed', 2, 'en', 'Registration confirmed — {{paperTitle}}', '<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Registration confirmed</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">Your conference registration payment was received.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
<tr><td style="padding:28px 32px 20px;border-bottom:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#4f46e5;">OpenConferences</p>
<h1 style="margin:12px 0 0;font-size:22px;line-height:1.35;color:#0f172a;font-weight:700;">Registration confirmed</h1>
</td></tr>
<tr><td style="padding:28px 32px;">
<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">Thank you — your registration payment has been received and your participation is confirmed.</p><p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">You can download your invoice and view registration details in OpenConferences.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;"><tr><td style="padding:12px 16px;"><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Paper</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{paperTitle}}</td></tr><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Amount paid</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{amountFormatted}}</td></tr></td></tr></table>


<p style="margin:16px 0 0;font-size:13px;line-height:1.55;color:#64748b;">Keep this email for your records.</p>
</td></tr>
<tr><td style="padding:18px 32px;background:#f8fafc;border-top:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;">Automated message from OpenConferences. Please do not reply to this email.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>', 'Registration confirmed

Your registration payment has been received.

Paper: paperTitle
Amount paid: amountFormatted

— OpenConferences', '["paperTitle","amountFormatted"]'::jsonb, true, NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "notification_templates"
  WHERE "organizationId" IS NULL AND "key" = 'registration.confirmed' AND "version" = 2
);
UPDATE "notification_templates" SET "subject" = 'Registration confirmed — {{paperTitle}}', "bodyHtml" = '<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Registration confirmed</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">Your conference registration payment was received.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
<tr><td style="padding:28px 32px 20px;border-bottom:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#4f46e5;">OpenConferences</p>
<h1 style="margin:12px 0 0;font-size:22px;line-height:1.35;color:#0f172a;font-weight:700;">Registration confirmed</h1>
</td></tr>
<tr><td style="padding:28px 32px;">
<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">Thank you — your registration payment has been received and your participation is confirmed.</p><p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">You can download your invoice and view registration details in OpenConferences.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;"><tr><td style="padding:12px 16px;"><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Paper</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{paperTitle}}</td></tr><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Amount paid</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{amountFormatted}}</td></tr></td></tr></table>


<p style="margin:16px 0 0;font-size:13px;line-height:1.55;color:#64748b;">Keep this email for your records.</p>
</td></tr>
<tr><td style="padding:18px 32px;background:#f8fafc;border-top:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;">Automated message from OpenConferences. Please do not reply to this email.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>', "bodyText" = 'Registration confirmed

Your registration payment has been received.

Paper: paperTitle
Amount paid: amountFormatted

— OpenConferences', "variables" = '["paperTitle","amountFormatted"]'::jsonb, "isActive" = true, "updatedAt" = NOW()
WHERE "organizationId" IS NULL AND "key" = 'registration.confirmed' AND "version" = 2;

INSERT INTO "notification_templates" ("id", "organizationId", "key", "version", "locale", "subject", "bodyHtml", "bodyText", "variables", "isActive", "createdAt", "updatedAt")
SELECT 'a2000001-0000-4000-8000-000000000013', NULL, 'registration.verification_approved', 2, 'en', 'Student verification approved', '<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Student verification approved</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">Your student registration verification was approved.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
<tr><td style="padding:28px 32px 20px;border-bottom:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#4f46e5;">OpenConferences</p>
<h1 style="margin:12px 0 0;font-size:22px;line-height:1.35;color:#0f172a;font-weight:700;">Student verification approved</h1>
</td></tr>
<tr><td style="padding:28px 32px;">
<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">Your student status documentation has been reviewed and approved.</p><p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">Your registration now reflects the approved student rate. No further action is required unless prompted in your dashboard.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;"><tr><td style="padding:12px 16px;"><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Paper</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{paperTitle}}</td></tr></td></tr></table>



</td></tr>
<tr><td style="padding:18px 32px;background:#f8fafc;border-top:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;">Automated message from OpenConferences. Please do not reply to this email.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>', 'Student verification approved

Your student verification has been approved.

Paper: paperTitle

— OpenConferences', '["paperTitle"]'::jsonb, true, NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "notification_templates"
  WHERE "organizationId" IS NULL AND "key" = 'registration.verification_approved' AND "version" = 2
);
UPDATE "notification_templates" SET "subject" = 'Student verification approved', "bodyHtml" = '<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Student verification approved</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">Your student registration verification was approved.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
<tr><td style="padding:28px 32px 20px;border-bottom:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#4f46e5;">OpenConferences</p>
<h1 style="margin:12px 0 0;font-size:22px;line-height:1.35;color:#0f172a;font-weight:700;">Student verification approved</h1>
</td></tr>
<tr><td style="padding:28px 32px;">
<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">Your student status documentation has been reviewed and approved.</p><p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">Your registration now reflects the approved student rate. No further action is required unless prompted in your dashboard.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;"><tr><td style="padding:12px 16px;"><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Paper</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{paperTitle}}</td></tr></td></tr></table>



</td></tr>
<tr><td style="padding:18px 32px;background:#f8fafc;border-top:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;">Automated message from OpenConferences. Please do not reply to this email.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>', "bodyText" = 'Student verification approved

Your student verification has been approved.

Paper: paperTitle

— OpenConferences', "variables" = '["paperTitle"]'::jsonb, "isActive" = true, "updatedAt" = NOW()
WHERE "organizationId" IS NULL AND "key" = 'registration.verification_approved' AND "version" = 2;

INSERT INTO "notification_templates" ("id", "organizationId", "key", "version", "locale", "subject", "bodyHtml", "bodyText", "variables", "isActive", "createdAt", "updatedAt")
SELECT 'a2000001-0000-4000-8000-000000000014', NULL, 'registration.clarification_requested', 2, 'en', 'Action needed: student verification', '<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Student verification — clarification needed</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">Additional information is needed for your student verification.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
<tr><td style="padding:28px 32px 20px;border-bottom:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#4f46e5;">OpenConferences</p>
<h1 style="margin:12px 0 0;font-size:22px;line-height:1.35;color:#0f172a;font-weight:700;">Student verification — clarification needed</h1>
</td></tr>
<tr><td style="padding:28px 32px;">
<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">We need additional information to complete your student verification.</p><p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">Please review the note below and upload the requested documentation in OpenConferences.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;"><tr><td style="padding:12px 16px;"><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Paper</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{paperTitle}}</td></tr><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Committee note</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{note}}</td></tr></td></tr></table>


<p style="margin:16px 0 0;font-size:13px;line-height:1.55;color:#64748b;">Your registration may remain on hold until verification is complete.</p>
</td></tr>
<tr><td style="padding:18px 32px;background:#f8fafc;border-top:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;">Automated message from OpenConferences. Please do not reply to this email.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>', 'Student verification — clarification needed

Additional information is needed for your student verification.

Paper: paperTitle
Committee note: note

— OpenConferences', '["paperTitle","note"]'::jsonb, true, NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "notification_templates"
  WHERE "organizationId" IS NULL AND "key" = 'registration.clarification_requested' AND "version" = 2
);
UPDATE "notification_templates" SET "subject" = 'Action needed: student verification', "bodyHtml" = '<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Student verification — clarification needed</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">Additional information is needed for your student verification.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
<tr><td style="padding:28px 32px 20px;border-bottom:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#4f46e5;">OpenConferences</p>
<h1 style="margin:12px 0 0;font-size:22px;line-height:1.35;color:#0f172a;font-weight:700;">Student verification — clarification needed</h1>
</td></tr>
<tr><td style="padding:28px 32px;">
<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">We need additional information to complete your student verification.</p><p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">Please review the note below and upload the requested documentation in OpenConferences.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;"><tr><td style="padding:12px 16px;"><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Paper</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{paperTitle}}</td></tr><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Committee note</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{note}}</td></tr></td></tr></table>


<p style="margin:16px 0 0;font-size:13px;line-height:1.55;color:#64748b;">Your registration may remain on hold until verification is complete.</p>
</td></tr>
<tr><td style="padding:18px 32px;background:#f8fafc;border-top:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;">Automated message from OpenConferences. Please do not reply to this email.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>', "bodyText" = 'Student verification — clarification needed

Additional information is needed for your student verification.

Paper: paperTitle
Committee note: note

— OpenConferences', "variables" = '["paperTitle","note"]'::jsonb, "isActive" = true, "updatedAt" = NOW()
WHERE "organizationId" IS NULL AND "key" = 'registration.clarification_requested' AND "version" = 2;

INSERT INTO "notification_templates" ("id", "organizationId", "key", "version", "locale", "subject", "bodyHtml", "bodyText", "variables", "isActive", "createdAt", "updatedAt")
SELECT 'a2000001-0000-4000-8000-000000000015', NULL, 'registration.additional_payment_required', 2, 'en', 'Additional registration payment required', '<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Additional payment required</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">An additional payment is required to complete registration.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
<tr><td style="padding:28px 32px 20px;border-bottom:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#4f46e5;">OpenConferences</p>
<h1 style="margin:12px 0 0;font-size:22px;line-height:1.35;color:#0f172a;font-weight:700;">Additional payment required</h1>
</td></tr>
<tr><td style="padding:28px 32px;">
<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">Your student verification was not approved at the discounted rate.</p><p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">An additional registration payment is required to complete your registration for the conference.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;"><tr><td style="padding:12px 16px;"><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Paper</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{paperTitle}}</td></tr><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Amount due</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{amountFormatted}}</td></tr></td></tr></table>


<p style="margin:16px 0 0;font-size:13px;line-height:1.55;color:#64748b;">Sign in to OpenConferences to complete the additional payment before the registration deadline.</p>
</td></tr>
<tr><td style="padding:18px 32px;background:#f8fafc;border-top:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;">Automated message from OpenConferences. Please do not reply to this email.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>', 'Additional payment required

An additional registration payment is required.

Paper: paperTitle
Amount due: amountFormatted

— OpenConferences', '["paperTitle","amountFormatted"]'::jsonb, true, NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "notification_templates"
  WHERE "organizationId" IS NULL AND "key" = 'registration.additional_payment_required' AND "version" = 2
);
UPDATE "notification_templates" SET "subject" = 'Additional registration payment required', "bodyHtml" = '<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Additional payment required</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">An additional payment is required to complete registration.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
<tr><td style="padding:28px 32px 20px;border-bottom:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#4f46e5;">OpenConferences</p>
<h1 style="margin:12px 0 0;font-size:22px;line-height:1.35;color:#0f172a;font-weight:700;">Additional payment required</h1>
</td></tr>
<tr><td style="padding:28px 32px;">
<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">Your student verification was not approved at the discounted rate.</p><p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">An additional registration payment is required to complete your registration for the conference.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;"><tr><td style="padding:12px 16px;"><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Paper</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{paperTitle}}</td></tr><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Amount due</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{amountFormatted}}</td></tr></td></tr></table>


<p style="margin:16px 0 0;font-size:13px;line-height:1.55;color:#64748b;">Sign in to OpenConferences to complete the additional payment before the registration deadline.</p>
</td></tr>
<tr><td style="padding:18px 32px;background:#f8fafc;border-top:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;">Automated message from OpenConferences. Please do not reply to this email.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>', "bodyText" = 'Additional payment required

An additional registration payment is required.

Paper: paperTitle
Amount due: amountFormatted

— OpenConferences', "variables" = '["paperTitle","amountFormatted"]'::jsonb, "isActive" = true, "updatedAt" = NOW()
WHERE "organizationId" IS NULL AND "key" = 'registration.additional_payment_required' AND "version" = 2;

INSERT INTO "notification_templates" ("id", "organizationId", "key", "version", "locale", "subject", "bodyHtml", "bodyText", "variables", "isActive", "createdAt", "updatedAt")
SELECT 'a2000001-0000-4000-8000-000000000016', NULL, 'registration.deadline_reminder', 2, 'en', 'Registration deadline approaching', '<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Registration deadline approaching</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">Complete registration before the deadline to keep your paper on the program.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
<tr><td style="padding:28px 32px 20px;border-bottom:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#4f46e5;">OpenConferences</p>
<h1 style="margin:12px 0 0;font-size:22px;line-height:1.35;color:#0f172a;font-weight:700;">Registration deadline approaching</h1>
</td></tr>
<tr><td style="padding:28px 32px;">
<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">Your accepted paper still requires completed registration and payment.</p><p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">Please finalize registration before the deadline below to avoid withdrawal of your paper from the conference program.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;"><tr><td style="padding:12px 16px;"><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Paper</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{paperTitle}}</td></tr><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Registration deadline</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{deadlineAt}}</td></tr></td></tr></table>


<p style="margin:16px 0 0;font-size:13px;line-height:1.55;color:#64748b;">Important: papers with unpaid registration after the deadline may be withdrawn for non-payment.</p>
</td></tr>
<tr><td style="padding:18px 32px;background:#f8fafc;border-top:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;">Automated message from OpenConferences. Please do not reply to this email.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>', 'Registration deadline approaching

Please complete registration before the deadline.

Paper: paperTitle
Registration deadline: deadlineAt

Non-payment by the deadline may withdraw your paper.

— OpenConferences', '["paperTitle","deadlineAt"]'::jsonb, true, NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "notification_templates"
  WHERE "organizationId" IS NULL AND "key" = 'registration.deadline_reminder' AND "version" = 2
);
UPDATE "notification_templates" SET "subject" = 'Registration deadline approaching', "bodyHtml" = '<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Registration deadline approaching</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">Complete registration before the deadline to keep your paper on the program.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
<tr><td style="padding:28px 32px 20px;border-bottom:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#4f46e5;">OpenConferences</p>
<h1 style="margin:12px 0 0;font-size:22px;line-height:1.35;color:#0f172a;font-weight:700;">Registration deadline approaching</h1>
</td></tr>
<tr><td style="padding:28px 32px;">
<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">Your accepted paper still requires completed registration and payment.</p><p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">Please finalize registration before the deadline below to avoid withdrawal of your paper from the conference program.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;"><tr><td style="padding:12px 16px;"><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Paper</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{paperTitle}}</td></tr><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Registration deadline</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{deadlineAt}}</td></tr></td></tr></table>


<p style="margin:16px 0 0;font-size:13px;line-height:1.55;color:#64748b;">Important: papers with unpaid registration after the deadline may be withdrawn for non-payment.</p>
</td></tr>
<tr><td style="padding:18px 32px;background:#f8fafc;border-top:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;">Automated message from OpenConferences. Please do not reply to this email.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>', "bodyText" = 'Registration deadline approaching

Please complete registration before the deadline.

Paper: paperTitle
Registration deadline: deadlineAt

Non-payment by the deadline may withdraw your paper.

— OpenConferences', "variables" = '["paperTitle","deadlineAt"]'::jsonb, "isActive" = true, "updatedAt" = NOW()
WHERE "organizationId" IS NULL AND "key" = 'registration.deadline_reminder' AND "version" = 2;

INSERT INTO "notification_templates" ("id", "organizationId", "key", "version", "locale", "subject", "bodyHtml", "bodyText", "variables", "isActive", "createdAt", "updatedAt")
SELECT 'a2000001-0000-4000-8000-000000000017', NULL, 'registration.discarded', 2, 'en', 'Registration closed — {{paperTitle}}', '<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Registration not completed</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">Registration was not completed before the deadline.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
<tr><td style="padding:28px 32px 20px;border-bottom:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#4f46e5;">OpenConferences</p>
<h1 style="margin:12px 0 0;font-size:22px;line-height:1.35;color:#0f172a;font-weight:700;">Registration not completed</h1>
</td></tr>
<tr><td style="padding:28px 32px;">
<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">Registration for your accepted paper was not completed before the deadline.</p><p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">As a result, your registration has been marked as discarded due to non-payment, and your paper may be withdrawn from the conference program.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;"><tr><td style="padding:12px 16px;"><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Paper</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{paperTitle}}</td></tr></td></tr></table>


<p style="margin:16px 0 0;font-size:13px;line-height:1.55;color:#64748b;">If you believe this is an error or need assistance, please contact the conference organizers directly.</p>
</td></tr>
<tr><td style="padding:18px 32px;background:#f8fafc;border-top:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;">Automated message from OpenConferences. Please do not reply to this email.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>', 'Registration not completed

Registration was not completed before the deadline and has been discarded due to non-payment.

Paper: paperTitle

— OpenConferences', '["paperTitle"]'::jsonb, true, NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "notification_templates"
  WHERE "organizationId" IS NULL AND "key" = 'registration.discarded' AND "version" = 2
);
UPDATE "notification_templates" SET "subject" = 'Registration closed — {{paperTitle}}', "bodyHtml" = '<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Registration not completed</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">Registration was not completed before the deadline.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
<tr><td style="padding:28px 32px 20px;border-bottom:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#4f46e5;">OpenConferences</p>
<h1 style="margin:12px 0 0;font-size:22px;line-height:1.35;color:#0f172a;font-weight:700;">Registration not completed</h1>
</td></tr>
<tr><td style="padding:28px 32px;">
<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">Registration for your accepted paper was not completed before the deadline.</p><p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">As a result, your registration has been marked as discarded due to non-payment, and your paper may be withdrawn from the conference program.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;"><tr><td style="padding:12px 16px;"><tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">Paper</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">{{paperTitle}}</td></tr></td></tr></table>


<p style="margin:16px 0 0;font-size:13px;line-height:1.55;color:#64748b;">If you believe this is an error or need assistance, please contact the conference organizers directly.</p>
</td></tr>
<tr><td style="padding:18px 32px;background:#f8fafc;border-top:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;">Automated message from OpenConferences. Please do not reply to this email.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>', "bodyText" = 'Registration not completed

Registration was not completed before the deadline and has been discarded due to non-payment.

Paper: paperTitle

— OpenConferences', "variables" = '["paperTitle"]'::jsonb, "isActive" = true, "updatedAt" = NOW()
WHERE "organizationId" IS NULL AND "key" = 'registration.discarded' AND "version" = 2;
