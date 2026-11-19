-- Refresh every platform email template: readable dates, links, the reason for a
-- student-rate rejection, a configurable contact address and consistent wording.
-- Templates customised by an organisation and emails already sent are left as they are.

-- reviewer.reminder_digest
UPDATE "notification_templates" SET
  "subject" = $tpl$Review reminder: {{conferenceName}}$tpl$,
  "bodyHtml" = $tpl$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Your outstanding reviews</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e4e4e7;border-radius:10px;">

<tr><td style="padding:14px 28px 26px;">
<h1 style="margin:0 0 18px;font-size:21px;line-height:1.35;font-weight:600;color:#18181b;">Your outstanding reviews</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">Hello {{reviewerName}},</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">The organisers of {{conferenceName}} have requested an update on these reviews. Each assignment has its own deadline.</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">{{reviewItems}}</p>




<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 16px;">
<tr><td style="background:#18181b;border-radius:6px;">
<a href="{{reviewUrl}}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">Open your reviews</a>
</td></tr>
</table>
<p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#71717a;word-break:break-all;">If the button does not work, paste this address into your browser:<br>{{reviewUrl}}</p>

<p style="margin:0;font-size:15px;line-height:1.65;color:#52525b;">Regards,<br>Organising Committee<br>{{conferenceName}}</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:4px 0 0;">
<tr><td style="padding:16px 0 0;border-top:1px solid #e4e4e7;">
<p style="margin:0;font-size:13px;line-height:1.6;color:#71717a;">Deadlines are shown in UTC. Please contact the organisers if you need an extension.</p>
</td></tr>
</table>
</td></tr>
</table>
<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This message was sent by {{conferenceName}}.</p>
<p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This is a system generated mail. For any queries contact: {{contactEmail}}</p>
</td></tr>
</table>
</body>
</html>$tpl$,
  "bodyText" = $tpl${{conferenceName}}

Your outstanding reviews

Hello {{reviewerName}},

The organisers of {{conferenceName}} have requested an update on these reviews. Each assignment has its own deadline.

{{reviewItems}}

Open your reviews: {{reviewUrl}}

Regards,
Organising Committee
{{conferenceName}}

Deadlines are shown in UTC. Please contact the organisers if you need an extension.

This message was sent by {{conferenceName}}.

This is a system generated mail. For any queries contact: {{contactEmail}}$tpl$,
  "variables" = $tpl$["conferenceName","reviewerName","reviewItems","reviewUrl","contactEmail"]$tpl$::jsonb,
  "updatedAt" = now()
WHERE "key" = $tpl$reviewer.reminder_digest$tpl$ AND "organizationId" IS NULL;

INSERT INTO "notification_templates"
  ("id", "organizationId", "key", "version", "locale", "subject", "bodyHtml", "bodyText", "variables", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid(), NULL, $tpl$reviewer.reminder_digest$tpl$, 2, 'en', $tpl$Review reminder: {{conferenceName}}$tpl$, $tpl$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Your outstanding reviews</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e4e4e7;border-radius:10px;">

<tr><td style="padding:14px 28px 26px;">
<h1 style="margin:0 0 18px;font-size:21px;line-height:1.35;font-weight:600;color:#18181b;">Your outstanding reviews</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">Hello {{reviewerName}},</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">The organisers of {{conferenceName}} have requested an update on these reviews. Each assignment has its own deadline.</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">{{reviewItems}}</p>




<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 16px;">
<tr><td style="background:#18181b;border-radius:6px;">
<a href="{{reviewUrl}}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">Open your reviews</a>
</td></tr>
</table>
<p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#71717a;word-break:break-all;">If the button does not work, paste this address into your browser:<br>{{reviewUrl}}</p>

<p style="margin:0;font-size:15px;line-height:1.65;color:#52525b;">Regards,<br>Organising Committee<br>{{conferenceName}}</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:4px 0 0;">
<tr><td style="padding:16px 0 0;border-top:1px solid #e4e4e7;">
<p style="margin:0;font-size:13px;line-height:1.6;color:#71717a;">Deadlines are shown in UTC. Please contact the organisers if you need an extension.</p>
</td></tr>
</table>
</td></tr>
</table>
<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This message was sent by {{conferenceName}}.</p>
<p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This is a system generated mail. For any queries contact: {{contactEmail}}</p>
</td></tr>
</table>
</body>
</html>$tpl$, $tpl${{conferenceName}}

Your outstanding reviews

Hello {{reviewerName}},

The organisers of {{conferenceName}} have requested an update on these reviews. Each assignment has its own deadline.

{{reviewItems}}

Open your reviews: {{reviewUrl}}

Regards,
Organising Committee
{{conferenceName}}

Deadlines are shown in UTC. Please contact the organisers if you need an extension.

This message was sent by {{conferenceName}}.

This is a system generated mail. For any queries contact: {{contactEmail}}$tpl$, $tpl$["conferenceName","reviewerName","reviewItems","reviewUrl","contactEmail"]$tpl$::jsonb, true, now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM "notification_templates" WHERE "key" = $tpl$reviewer.reminder_digest$tpl$ AND "organizationId" IS NULL
);

-- auth.email_verify
UPDATE "notification_templates" SET
  "subject" = $tpl$Your email verification code$tpl$,
  "bodyHtml" = $tpl$<!DOCTYPE html>
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
<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This is an automated message.</p>
<p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This is a system generated mail. For any queries contact: {{contactEmail}}</p>
</td></tr>
</table>
</body>
</html>$tpl$,
  "bodyText" = $tpl$Verify your email address

Thanks for creating an account.

Enter this code in the browser window where you signed up. Do not share this code with anyone.

Your code: {{otp}}
This code expires in {{expiresMinutes}} minutes.

If you did not create an account, you can safely ignore this email. Someone else may have typed your address by mistake.

This is an automated message.

This is a system generated mail. For any queries contact: {{contactEmail}}$tpl$,
  "variables" = $tpl$["otp","expiresMinutes","contactEmail"]$tpl$::jsonb,
  "updatedAt" = now()
WHERE "key" = $tpl$auth.email_verify$tpl$ AND "organizationId" IS NULL;

INSERT INTO "notification_templates"
  ("id", "organizationId", "key", "version", "locale", "subject", "bodyHtml", "bodyText", "variables", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid(), NULL, $tpl$auth.email_verify$tpl$, 2, 'en', $tpl$Your email verification code$tpl$, $tpl$<!DOCTYPE html>
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
<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This is an automated message.</p>
<p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This is a system generated mail. For any queries contact: {{contactEmail}}</p>
</td></tr>
</table>
</body>
</html>$tpl$, $tpl$Verify your email address

Thanks for creating an account.

Enter this code in the browser window where you signed up. Do not share this code with anyone.

Your code: {{otp}}
This code expires in {{expiresMinutes}} minutes.

If you did not create an account, you can safely ignore this email. Someone else may have typed your address by mistake.

This is an automated message.

This is a system generated mail. For any queries contact: {{contactEmail}}$tpl$, $tpl$["otp","expiresMinutes","contactEmail"]$tpl$::jsonb, true, now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM "notification_templates" WHERE "key" = $tpl$auth.email_verify$tpl$ AND "organizationId" IS NULL
);

-- auth.password_reset
UPDATE "notification_templates" SET
  "subject" = $tpl$Reset your password$tpl$,
  "bodyHtml" = $tpl$<!DOCTYPE html>
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
<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This is an automated message.</p>
<p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This is a system generated mail. For any queries contact: {{contactEmail}}</p>
</td></tr>
</table>
</body>
</html>$tpl$,
  "bodyText" = $tpl$Reset your password

We received a request to reset the password for your account.

Open the link below to choose a new password. For your security, this link can only be used once.

Reset password: {{resetUrl}}

If you did not request a password reset, you can ignore this email. Your password will not change.

This is an automated message.

This is a system generated mail. For any queries contact: {{contactEmail}}$tpl$,
  "variables" = $tpl$["resetUrl","contactEmail"]$tpl$::jsonb,
  "updatedAt" = now()
WHERE "key" = $tpl$auth.password_reset$tpl$ AND "organizationId" IS NULL;

INSERT INTO "notification_templates"
  ("id", "organizationId", "key", "version", "locale", "subject", "bodyHtml", "bodyText", "variables", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid(), NULL, $tpl$auth.password_reset$tpl$, 2, 'en', $tpl$Reset your password$tpl$, $tpl$<!DOCTYPE html>
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
<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This is an automated message.</p>
<p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This is a system generated mail. For any queries contact: {{contactEmail}}</p>
</td></tr>
</table>
</body>
</html>$tpl$, $tpl$Reset your password

We received a request to reset the password for your account.

Open the link below to choose a new password. For your security, this link can only be used once.

Reset password: {{resetUrl}}

If you did not request a password reset, you can ignore this email. Your password will not change.

This is an automated message.

This is a system generated mail. For any queries contact: {{contactEmail}}$tpl$, $tpl$["resetUrl","contactEmail"]$tpl$::jsonb, true, now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM "notification_templates" WHERE "key" = $tpl$auth.password_reset$tpl$ AND "organizationId" IS NULL
);

-- auth.mfa_otp
UPDATE "notification_templates" SET
  "subject" = $tpl$Your verification code$tpl$,
  "bodyHtml" = $tpl$<!DOCTYPE html>
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
<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This is an automated message.</p>
<p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This is a system generated mail. For any queries contact: {{contactEmail}}</p>
</td></tr>
</table>
</body>
</html>$tpl$,
  "bodyText" = $tpl$Your verification code

Use this code to finish signing in or enable two-factor authentication on your account.

Enter the code in the browser window where you requested it. Do not share this code with anyone.

Your code: {{otp}}
This code expires in {{expiresMinutes}} minutes.

If you did not request this code, you can ignore this email. Someone else may have typed your address by mistake.

This is an automated message.

This is a system generated mail. For any queries contact: {{contactEmail}}$tpl$,
  "variables" = $tpl$["otp","expiresMinutes","contactEmail"]$tpl$::jsonb,
  "updatedAt" = now()
WHERE "key" = $tpl$auth.mfa_otp$tpl$ AND "organizationId" IS NULL;

INSERT INTO "notification_templates"
  ("id", "organizationId", "key", "version", "locale", "subject", "bodyHtml", "bodyText", "variables", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid(), NULL, $tpl$auth.mfa_otp$tpl$, 2, 'en', $tpl$Your verification code$tpl$, $tpl$<!DOCTYPE html>
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
<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This is an automated message.</p>
<p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This is a system generated mail. For any queries contact: {{contactEmail}}</p>
</td></tr>
</table>
</body>
</html>$tpl$, $tpl$Your verification code

Use this code to finish signing in or enable two-factor authentication on your account.

Enter the code in the browser window where you requested it. Do not share this code with anyone.

Your code: {{otp}}
This code expires in {{expiresMinutes}} minutes.

If you did not request this code, you can ignore this email. Someone else may have typed your address by mistake.

This is an automated message.

This is a system generated mail. For any queries contact: {{contactEmail}}$tpl$, $tpl$["otp","expiresMinutes","contactEmail"]$tpl$::jsonb, true, now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM "notification_templates" WHERE "key" = $tpl$auth.mfa_otp$tpl$ AND "organizationId" IS NULL
);

-- submission.confirmed
UPDATE "notification_templates" SET
  "subject" = $tpl$Submission received: {{paperTitle}}$tpl$,
  "bodyHtml" = $tpl$<!DOCTYPE html>
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



<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 16px;">
<tr><td style="background:#18181b;border-radius:6px;">
<a href="{{paperUrl}}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">View your submission</a>
</td></tr>
</table>
<p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#71717a;word-break:break-all;">If the button does not work, paste this address into your browser:<br>{{paperUrl}}</p>

<p style="margin:0;font-size:15px;line-height:1.65;color:#52525b;">Regards,<br>Organising Committee<br>{{conferenceName}}</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:4px 0 0;">
<tr><td style="padding:16px 0 0;border-top:1px solid #e4e4e7;">
<p style="margin:0;font-size:13px;line-height:1.6;color:#71717a;">You will receive further updates by email as this submission moves through review.</p>
</td></tr>
</table>
</td></tr>
</table>
<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This message was sent by {{conferenceName}}.</p>
<p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This is a system generated mail. For any queries contact: {{contactEmail}}</p>
</td></tr>
</table>
</body>
</html>$tpl$,
  "bodyText" = $tpl${{conferenceName}}

Submission confirmed

Your paper has been received for {{conferenceName}}.

Please keep this message as a record of the submission.

Paper: {{paperTitle}}
Corresponding author: {{authorName}}
Email: {{authorEmail}}
Affiliation: {{authorAffiliation}}
Authors: {{authorList}}

View your submission: {{paperUrl}}

Regards,
Organising Committee
{{conferenceName}}

You will receive further updates by email as this submission moves through review.

This message was sent by {{conferenceName}}.

This is a system generated mail. For any queries contact: {{contactEmail}}$tpl$,
  "variables" = $tpl$["paperTitle","paperUrl","conferenceName","authorName","authorEmail","authorAffiliation","authorList","contactEmail"]$tpl$::jsonb,
  "updatedAt" = now()
WHERE "key" = $tpl$submission.confirmed$tpl$ AND "organizationId" IS NULL;

INSERT INTO "notification_templates"
  ("id", "organizationId", "key", "version", "locale", "subject", "bodyHtml", "bodyText", "variables", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid(), NULL, $tpl$submission.confirmed$tpl$, 2, 'en', $tpl$Submission received: {{paperTitle}}$tpl$, $tpl$<!DOCTYPE html>
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



<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 16px;">
<tr><td style="background:#18181b;border-radius:6px;">
<a href="{{paperUrl}}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">View your submission</a>
</td></tr>
</table>
<p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#71717a;word-break:break-all;">If the button does not work, paste this address into your browser:<br>{{paperUrl}}</p>

<p style="margin:0;font-size:15px;line-height:1.65;color:#52525b;">Regards,<br>Organising Committee<br>{{conferenceName}}</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:4px 0 0;">
<tr><td style="padding:16px 0 0;border-top:1px solid #e4e4e7;">
<p style="margin:0;font-size:13px;line-height:1.6;color:#71717a;">You will receive further updates by email as this submission moves through review.</p>
</td></tr>
</table>
</td></tr>
</table>
<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This message was sent by {{conferenceName}}.</p>
<p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This is a system generated mail. For any queries contact: {{contactEmail}}</p>
</td></tr>
</table>
</body>
</html>$tpl$, $tpl${{conferenceName}}

Submission confirmed

Your paper has been received for {{conferenceName}}.

Please keep this message as a record of the submission.

Paper: {{paperTitle}}
Corresponding author: {{authorName}}
Email: {{authorEmail}}
Affiliation: {{authorAffiliation}}
Authors: {{authorList}}

View your submission: {{paperUrl}}

Regards,
Organising Committee
{{conferenceName}}

You will receive further updates by email as this submission moves through review.

This message was sent by {{conferenceName}}.

This is a system generated mail. For any queries contact: {{contactEmail}}$tpl$, $tpl$["paperTitle","paperUrl","conferenceName","authorName","authorEmail","authorAffiliation","authorList","contactEmail"]$tpl$::jsonb, true, now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM "notification_templates" WHERE "key" = $tpl$submission.confirmed$tpl$ AND "organizationId" IS NULL
);

-- revision.confirmed
UPDATE "notification_templates" SET
  "subject" = $tpl$Revised manuscript received: {{submissionNumber}}$tpl$,
  "bodyHtml" = $tpl$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Revised manuscript received</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e4e4e7;border-radius:10px;">
<tr><td style="padding:22px 28px 0;">
<p style="margin:0;font-size:12px;line-height:1.4;letter-spacing:0.1em;text-transform:uppercase;font-weight:600;color:#71717a;">{{conferenceName}}</p>
</td></tr>
<tr><td style="padding:14px 28px 26px;">
<h1 style="margin:0 0 18px;font-size:21px;line-height:1.35;font-weight:600;color:#18181b;">Revised manuscript received</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">Your revised manuscript has passed the file check and has been submitted for the next review cycle at {{conferenceName}}.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px;background:#fafafa;border:1px solid #e4e4e7;border-radius:8px;">
<tr><td style="padding:18px 20px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
<tr><td style="padding:0 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Paper ID</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{submissionNumber}}</p>
</td></tr>
<tr><td style="padding:12px 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Paper title</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{paperTitle}}</p>
</td></tr>
<tr><td style="padding:12px 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Corresponding author</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{authorName}}</p>
</td></tr>
</table>
</td></tr>
</table>



<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 16px;">
<tr><td style="background:#18181b;border-radius:6px;">
<a href="{{paperUrl}}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">View revised submission</a>
</td></tr>
</table>
<p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#71717a;word-break:break-all;">If the button does not work, paste this address into your browser:<br>{{paperUrl}}</p>

<p style="margin:0;font-size:15px;line-height:1.65;color:#52525b;">Regards,<br>Organising Committee<br>{{conferenceName}}</p>

</td></tr>
</table>
<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This message was sent by {{conferenceName}}.</p>
<p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This is a system generated mail. For any queries contact: {{contactEmail}}</p>
</td></tr>
</table>
</body>
</html>$tpl$,
  "bodyText" = $tpl${{conferenceName}}

Revised manuscript received

Your revised manuscript has passed the file check and has been submitted for the next review cycle at {{conferenceName}}.

Paper ID: {{submissionNumber}}
Paper title: {{paperTitle}}
Corresponding author: {{authorName}}

View revised submission: {{paperUrl}}

Regards,
Organising Committee
{{conferenceName}}

This message was sent by {{conferenceName}}.

This is a system generated mail. For any queries contact: {{contactEmail}}$tpl$,
  "variables" = $tpl$["conferenceName","submissionNumber","paperTitle","authorName","paperUrl","contactEmail"]$tpl$::jsonb,
  "updatedAt" = now()
WHERE "key" = $tpl$revision.confirmed$tpl$ AND "organizationId" IS NULL;

INSERT INTO "notification_templates"
  ("id", "organizationId", "key", "version", "locale", "subject", "bodyHtml", "bodyText", "variables", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid(), NULL, $tpl$revision.confirmed$tpl$, 2, 'en', $tpl$Revised manuscript received: {{submissionNumber}}$tpl$, $tpl$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Revised manuscript received</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e4e4e7;border-radius:10px;">
<tr><td style="padding:22px 28px 0;">
<p style="margin:0;font-size:12px;line-height:1.4;letter-spacing:0.1em;text-transform:uppercase;font-weight:600;color:#71717a;">{{conferenceName}}</p>
</td></tr>
<tr><td style="padding:14px 28px 26px;">
<h1 style="margin:0 0 18px;font-size:21px;line-height:1.35;font-weight:600;color:#18181b;">Revised manuscript received</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">Your revised manuscript has passed the file check and has been submitted for the next review cycle at {{conferenceName}}.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px;background:#fafafa;border:1px solid #e4e4e7;border-radius:8px;">
<tr><td style="padding:18px 20px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
<tr><td style="padding:0 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Paper ID</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{submissionNumber}}</p>
</td></tr>
<tr><td style="padding:12px 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Paper title</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{paperTitle}}</p>
</td></tr>
<tr><td style="padding:12px 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Corresponding author</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{authorName}}</p>
</td></tr>
</table>
</td></tr>
</table>



<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 16px;">
<tr><td style="background:#18181b;border-radius:6px;">
<a href="{{paperUrl}}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">View revised submission</a>
</td></tr>
</table>
<p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#71717a;word-break:break-all;">If the button does not work, paste this address into your browser:<br>{{paperUrl}}</p>

<p style="margin:0;font-size:15px;line-height:1.65;color:#52525b;">Regards,<br>Organising Committee<br>{{conferenceName}}</p>

</td></tr>
</table>
<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This message was sent by {{conferenceName}}.</p>
<p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This is a system generated mail. For any queries contact: {{contactEmail}}</p>
</td></tr>
</table>
</body>
</html>$tpl$, $tpl${{conferenceName}}

Revised manuscript received

Your revised manuscript has passed the file check and has been submitted for the next review cycle at {{conferenceName}}.

Paper ID: {{submissionNumber}}
Paper title: {{paperTitle}}
Corresponding author: {{authorName}}

View revised submission: {{paperUrl}}

Regards,
Organising Committee
{{conferenceName}}

This message was sent by {{conferenceName}}.

This is a system generated mail. For any queries contact: {{contactEmail}}$tpl$, $tpl$["conferenceName","submissionNumber","paperTitle","authorName","paperUrl","contactEmail"]$tpl$::jsonb, true, now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM "notification_templates" WHERE "key" = $tpl$revision.confirmed$tpl$ AND "organizationId" IS NULL
);

-- revision.ops_alert
UPDATE "notification_templates" SET
  "subject" = $tpl$Revised manuscript submitted: {{submissionNumber}}$tpl$,
  "bodyHtml" = $tpl$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Revised manuscript submitted</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e4e4e7;border-radius:10px;">
<tr><td style="padding:22px 28px 0;">
<p style="margin:0;font-size:12px;line-height:1.4;letter-spacing:0.1em;text-transform:uppercase;font-weight:600;color:#71717a;">{{conferenceName}}</p>
</td></tr>
<tr><td style="padding:14px 28px 26px;">
<h1 style="margin:0 0 18px;font-size:21px;line-height:1.35;font-weight:600;color:#18181b;">Revised manuscript submitted</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">A revised manuscript has passed the file check. Assign reviewers for the next review cycle.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px;background:#fafafa;border:1px solid #e4e4e7;border-radius:8px;">
<tr><td style="padding:18px 20px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
<tr><td style="padding:0 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Paper ID</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{submissionNumber}}</p>
</td></tr>
<tr><td style="padding:12px 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Paper title</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{paperTitle}}</p>
</td></tr>
<tr><td style="padding:12px 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Corresponding author</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{authorName}}</p>
</td></tr>
</table>
</td></tr>
</table>



<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 16px;">
<tr><td style="background:#18181b;border-radius:6px;">
<a href="{{paperUrl}}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">View revised submission</a>
</td></tr>
</table>
<p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#71717a;word-break:break-all;">If the button does not work, paste this address into your browser:<br>{{paperUrl}}</p>



</td></tr>
</table>
<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This message was sent by {{conferenceName}}.</p>
<p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This is a system generated mail. For any queries contact: {{contactEmail}}</p>
</td></tr>
</table>
</body>
</html>$tpl$,
  "bodyText" = $tpl${{conferenceName}}

Revised manuscript submitted

A revised manuscript has passed the file check. Assign reviewers for the next review cycle.

Paper ID: {{submissionNumber}}
Paper title: {{paperTitle}}
Corresponding author: {{authorName}}

View revised submission: {{paperUrl}}

This message was sent by {{conferenceName}}.

This is a system generated mail. For any queries contact: {{contactEmail}}$tpl$,
  "variables" = $tpl$["conferenceName","submissionNumber","paperTitle","authorName","paperUrl","contactEmail"]$tpl$::jsonb,
  "updatedAt" = now()
WHERE "key" = $tpl$revision.ops_alert$tpl$ AND "organizationId" IS NULL;

INSERT INTO "notification_templates"
  ("id", "organizationId", "key", "version", "locale", "subject", "bodyHtml", "bodyText", "variables", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid(), NULL, $tpl$revision.ops_alert$tpl$, 2, 'en', $tpl$Revised manuscript submitted: {{submissionNumber}}$tpl$, $tpl$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Revised manuscript submitted</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e4e4e7;border-radius:10px;">
<tr><td style="padding:22px 28px 0;">
<p style="margin:0;font-size:12px;line-height:1.4;letter-spacing:0.1em;text-transform:uppercase;font-weight:600;color:#71717a;">{{conferenceName}}</p>
</td></tr>
<tr><td style="padding:14px 28px 26px;">
<h1 style="margin:0 0 18px;font-size:21px;line-height:1.35;font-weight:600;color:#18181b;">Revised manuscript submitted</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">A revised manuscript has passed the file check. Assign reviewers for the next review cycle.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px;background:#fafafa;border:1px solid #e4e4e7;border-radius:8px;">
<tr><td style="padding:18px 20px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
<tr><td style="padding:0 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Paper ID</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{submissionNumber}}</p>
</td></tr>
<tr><td style="padding:12px 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Paper title</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{paperTitle}}</p>
</td></tr>
<tr><td style="padding:12px 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Corresponding author</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{authorName}}</p>
</td></tr>
</table>
</td></tr>
</table>



<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 16px;">
<tr><td style="background:#18181b;border-radius:6px;">
<a href="{{paperUrl}}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">View revised submission</a>
</td></tr>
</table>
<p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#71717a;word-break:break-all;">If the button does not work, paste this address into your browser:<br>{{paperUrl}}</p>



</td></tr>
</table>
<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This message was sent by {{conferenceName}}.</p>
<p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This is a system generated mail. For any queries contact: {{contactEmail}}</p>
</td></tr>
</table>
</body>
</html>$tpl$, $tpl${{conferenceName}}

Revised manuscript submitted

A revised manuscript has passed the file check. Assign reviewers for the next review cycle.

Paper ID: {{submissionNumber}}
Paper title: {{paperTitle}}
Corresponding author: {{authorName}}

View revised submission: {{paperUrl}}

This message was sent by {{conferenceName}}.

This is a system generated mail. For any queries contact: {{contactEmail}}$tpl$, $tpl$["conferenceName","submissionNumber","paperTitle","authorName","paperUrl","contactEmail"]$tpl$::jsonb, true, now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM "notification_templates" WHERE "key" = $tpl$revision.ops_alert$tpl$ AND "organizationId" IS NULL
);

-- submission.ops_alert
UPDATE "notification_templates" SET
  "subject" = $tpl$New submission: {{paperTitle}} ({{conferenceName}})$tpl$,
  "bodyHtml" = $tpl$<!DOCTYPE html>
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
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Paper ID</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{submissionNumber}}</p>
</td></tr>
<tr><td style="padding:12px 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Paper title</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{paperTitle}}</p>
</td></tr>
<tr><td style="padding:12px 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Corresponding author email</p>
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
<p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This is a system generated mail. For any queries contact: {{contactEmail}}</p>
</td></tr>
</table>
</body>
</html>$tpl$,
  "bodyText" = $tpl${{conferenceName}}

New paper submission

A new paper has been submitted.

Paper ID: {{submissionNumber}}
Paper title: {{paperTitle}}
Corresponding author email: {{authorEmail}}

View submission: {{paperUrl}}

This is an operations alert for every new submission.

This message was sent by {{conferenceName}}.

This is a system generated mail. For any queries contact: {{contactEmail}}$tpl$,
  "variables" = $tpl$["paperTitle","conferenceName","authorEmail","paperUrl","submissionNumber","contactEmail"]$tpl$::jsonb,
  "updatedAt" = now()
WHERE "key" = $tpl$submission.ops_alert$tpl$ AND "organizationId" IS NULL;

INSERT INTO "notification_templates"
  ("id", "organizationId", "key", "version", "locale", "subject", "bodyHtml", "bodyText", "variables", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid(), NULL, $tpl$submission.ops_alert$tpl$, 2, 'en', $tpl$New submission: {{paperTitle}} ({{conferenceName}})$tpl$, $tpl$<!DOCTYPE html>
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
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Paper ID</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{submissionNumber}}</p>
</td></tr>
<tr><td style="padding:12px 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Paper title</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{paperTitle}}</p>
</td></tr>
<tr><td style="padding:12px 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Corresponding author email</p>
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
<p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This is a system generated mail. For any queries contact: {{contactEmail}}</p>
</td></tr>
</table>
</body>
</html>$tpl$, $tpl${{conferenceName}}

New paper submission

A new paper has been submitted.

Paper ID: {{submissionNumber}}
Paper title: {{paperTitle}}
Corresponding author email: {{authorEmail}}

View submission: {{paperUrl}}

This is an operations alert for every new submission.

This message was sent by {{conferenceName}}.

This is a system generated mail. For any queries contact: {{contactEmail}}$tpl$, $tpl$["paperTitle","conferenceName","authorEmail","paperUrl","submissionNumber","contactEmail"]$tpl$::jsonb, true, now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM "notification_templates" WHERE "key" = $tpl$submission.ops_alert$tpl$ AND "organizationId" IS NULL
);

-- paper.withdrawn
UPDATE "notification_templates" SET
  "subject" = $tpl$Submission withdrawn: {{paperTitle}}$tpl$,
  "bodyHtml" = $tpl$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Submission withdrawn</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e4e4e7;border-radius:10px;">
<tr><td style="padding:22px 28px 0;">
<p style="margin:0;font-size:12px;line-height:1.4;letter-spacing:0.1em;text-transform:uppercase;font-weight:600;color:#71717a;">{{conferenceName}}</p>
</td></tr>
<tr><td style="padding:14px 28px 26px;">
<h1 style="margin:0 0 18px;font-size:21px;line-height:1.35;font-weight:600;color:#18181b;">Submission withdrawn</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">The paper below has been withdrawn from {{conferenceName}}.</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">This cannot be undone from the submission. Contact the organisers if this was a mistake.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px;background:#fafafa;border:1px solid #e4e4e7;border-radius:8px;">
<tr><td style="padding:18px 20px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
<tr><td style="padding:0 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Paper ID</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{submissionNumber}}</p>
</td></tr>
<tr><td style="padding:12px 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Paper</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{paperTitle}}</p>
</td></tr>
<tr><td style="padding:12px 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Reason</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{reason}}</p>
</td></tr>
</table>
</td></tr>
</table>



<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 16px;">
<tr><td style="background:#18181b;border-radius:6px;">
<a href="{{paperUrl}}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">View the submission</a>
</td></tr>
</table>
<p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#71717a;word-break:break-all;">If the button does not work, paste this address into your browser:<br>{{paperUrl}}</p>

<p style="margin:0;font-size:15px;line-height:1.65;color:#52525b;">Regards,<br>Organising Committee<br>{{conferenceName}}</p>

</td></tr>
</table>
<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This message was sent by {{conferenceName}}.</p>
<p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This is a system generated mail. For any queries contact: {{contactEmail}}</p>
</td></tr>
</table>
</body>
</html>$tpl$,
  "bodyText" = $tpl${{conferenceName}}

Submission withdrawn

The paper below has been withdrawn from {{conferenceName}}.

This cannot be undone from the submission. Contact the organisers if this was a mistake.

Paper ID: {{submissionNumber}}
Paper: {{paperTitle}}
Reason: {{reason}}

View the submission: {{paperUrl}}

Regards,
Organising Committee
{{conferenceName}}

This message was sent by {{conferenceName}}.

This is a system generated mail. For any queries contact: {{contactEmail}}$tpl$,
  "variables" = $tpl$["paperTitle","conferenceName","submissionNumber","reason","paperUrl","contactEmail"]$tpl$::jsonb,
  "updatedAt" = now()
WHERE "key" = $tpl$paper.withdrawn$tpl$ AND "organizationId" IS NULL;

INSERT INTO "notification_templates"
  ("id", "organizationId", "key", "version", "locale", "subject", "bodyHtml", "bodyText", "variables", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid(), NULL, $tpl$paper.withdrawn$tpl$, 2, 'en', $tpl$Submission withdrawn: {{paperTitle}}$tpl$, $tpl$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Submission withdrawn</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e4e4e7;border-radius:10px;">
<tr><td style="padding:22px 28px 0;">
<p style="margin:0;font-size:12px;line-height:1.4;letter-spacing:0.1em;text-transform:uppercase;font-weight:600;color:#71717a;">{{conferenceName}}</p>
</td></tr>
<tr><td style="padding:14px 28px 26px;">
<h1 style="margin:0 0 18px;font-size:21px;line-height:1.35;font-weight:600;color:#18181b;">Submission withdrawn</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">The paper below has been withdrawn from {{conferenceName}}.</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">This cannot be undone from the submission. Contact the organisers if this was a mistake.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px;background:#fafafa;border:1px solid #e4e4e7;border-radius:8px;">
<tr><td style="padding:18px 20px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
<tr><td style="padding:0 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Paper ID</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{submissionNumber}}</p>
</td></tr>
<tr><td style="padding:12px 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Paper</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{paperTitle}}</p>
</td></tr>
<tr><td style="padding:12px 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Reason</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{reason}}</p>
</td></tr>
</table>
</td></tr>
</table>



<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 16px;">
<tr><td style="background:#18181b;border-radius:6px;">
<a href="{{paperUrl}}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">View the submission</a>
</td></tr>
</table>
<p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#71717a;word-break:break-all;">If the button does not work, paste this address into your browser:<br>{{paperUrl}}</p>

<p style="margin:0;font-size:15px;line-height:1.65;color:#52525b;">Regards,<br>Organising Committee<br>{{conferenceName}}</p>

</td></tr>
</table>
<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This message was sent by {{conferenceName}}.</p>
<p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This is a system generated mail. For any queries contact: {{contactEmail}}</p>
</td></tr>
</table>
</body>
</html>$tpl$, $tpl${{conferenceName}}

Submission withdrawn

The paper below has been withdrawn from {{conferenceName}}.

This cannot be undone from the submission. Contact the organisers if this was a mistake.

Paper ID: {{submissionNumber}}
Paper: {{paperTitle}}
Reason: {{reason}}

View the submission: {{paperUrl}}

Regards,
Organising Committee
{{conferenceName}}

This message was sent by {{conferenceName}}.

This is a system generated mail. For any queries contact: {{contactEmail}}$tpl$, $tpl$["paperTitle","conferenceName","submissionNumber","reason","paperUrl","contactEmail"]$tpl$::jsonb, true, now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM "notification_templates" WHERE "key" = $tpl$paper.withdrawn$tpl$ AND "organizationId" IS NULL
);

-- paper.withdrawn.organizer
UPDATE "notification_templates" SET
  "subject" = $tpl$Paper withdrawn: {{paperTitle}} ({{conferenceName}})$tpl$,
  "bodyHtml" = $tpl$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>A paper was withdrawn</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e4e4e7;border-radius:10px;">
<tr><td style="padding:22px 28px 0;">
<p style="margin:0;font-size:12px;line-height:1.4;letter-spacing:0.1em;text-transform:uppercase;font-weight:600;color:#71717a;">{{conferenceName}}</p>
</td></tr>
<tr><td style="padding:14px 28px 26px;">
<h1 style="margin:0 0 18px;font-size:21px;line-height:1.35;font-weight:600;color:#18181b;">A paper was withdrawn</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">{{actorName}} withdrew a paper from {{conferenceName}}.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px;background:#fafafa;border:1px solid #e4e4e7;border-radius:8px;">
<tr><td style="padding:18px 20px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
<tr><td style="padding:0 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Paper ID</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{submissionNumber}}</p>
</td></tr>
<tr><td style="padding:12px 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Paper</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{paperTitle}}</p>
</td></tr>
<tr><td style="padding:12px 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Reason</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{reason}}</p>
</td></tr>
<tr><td style="padding:12px 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Paid registration needs a refund</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{refundNeeded}}</p>
</td></tr>
</table>
</td></tr>
</table>



<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 16px;">
<tr><td style="background:#18181b;border-radius:6px;">
<a href="{{paperUrl}}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">View the submission</a>
</td></tr>
</table>
<p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#71717a;word-break:break-all;">If the button does not work, paste this address into your browser:<br>{{paperUrl}}</p>



</td></tr>
</table>
<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This message was sent by {{conferenceName}}.</p>
<p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This is a system generated mail. For any queries contact: {{contactEmail}}</p>
</td></tr>
</table>
</body>
</html>$tpl$,
  "bodyText" = $tpl${{conferenceName}}

A paper was withdrawn

{{actorName}} withdrew a paper from {{conferenceName}}.

Paper ID: {{submissionNumber}}
Paper: {{paperTitle}}
Reason: {{reason}}
Paid registration needs a refund: {{refundNeeded}}

View the submission: {{paperUrl}}

This message was sent by {{conferenceName}}.

This is a system generated mail. For any queries contact: {{contactEmail}}$tpl$,
  "variables" = $tpl$["paperTitle","paperUrl","conferenceName","submissionNumber","reason","actorName","refundNeeded","contactEmail"]$tpl$::jsonb,
  "updatedAt" = now()
WHERE "key" = $tpl$paper.withdrawn.organizer$tpl$ AND "organizationId" IS NULL;

INSERT INTO "notification_templates"
  ("id", "organizationId", "key", "version", "locale", "subject", "bodyHtml", "bodyText", "variables", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid(), NULL, $tpl$paper.withdrawn.organizer$tpl$, 2, 'en', $tpl$Paper withdrawn: {{paperTitle}} ({{conferenceName}})$tpl$, $tpl$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>A paper was withdrawn</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e4e4e7;border-radius:10px;">
<tr><td style="padding:22px 28px 0;">
<p style="margin:0;font-size:12px;line-height:1.4;letter-spacing:0.1em;text-transform:uppercase;font-weight:600;color:#71717a;">{{conferenceName}}</p>
</td></tr>
<tr><td style="padding:14px 28px 26px;">
<h1 style="margin:0 0 18px;font-size:21px;line-height:1.35;font-weight:600;color:#18181b;">A paper was withdrawn</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">{{actorName}} withdrew a paper from {{conferenceName}}.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px;background:#fafafa;border:1px solid #e4e4e7;border-radius:8px;">
<tr><td style="padding:18px 20px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
<tr><td style="padding:0 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Paper ID</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{submissionNumber}}</p>
</td></tr>
<tr><td style="padding:12px 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Paper</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{paperTitle}}</p>
</td></tr>
<tr><td style="padding:12px 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Reason</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{reason}}</p>
</td></tr>
<tr><td style="padding:12px 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Paid registration needs a refund</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{refundNeeded}}</p>
</td></tr>
</table>
</td></tr>
</table>



<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 16px;">
<tr><td style="background:#18181b;border-radius:6px;">
<a href="{{paperUrl}}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">View the submission</a>
</td></tr>
</table>
<p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#71717a;word-break:break-all;">If the button does not work, paste this address into your browser:<br>{{paperUrl}}</p>



</td></tr>
</table>
<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This message was sent by {{conferenceName}}.</p>
<p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This is a system generated mail. For any queries contact: {{contactEmail}}</p>
</td></tr>
</table>
</body>
</html>$tpl$, $tpl${{conferenceName}}

A paper was withdrawn

{{actorName}} withdrew a paper from {{conferenceName}}.

Paper ID: {{submissionNumber}}
Paper: {{paperTitle}}
Reason: {{reason}}
Paid registration needs a refund: {{refundNeeded}}

View the submission: {{paperUrl}}

This message was sent by {{conferenceName}}.

This is a system generated mail. For any queries contact: {{contactEmail}}$tpl$, $tpl$["paperTitle","paperUrl","conferenceName","submissionNumber","reason","actorName","refundNeeded","contactEmail"]$tpl$::jsonb, true, now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM "notification_templates" WHERE "key" = $tpl$paper.withdrawn.organizer$tpl$ AND "organizationId" IS NULL
);

-- draft.reminder
UPDATE "notification_templates" SET
  "subject" = $tpl$Your draft for {{conferenceName}} is still open$tpl$,
  "bodyHtml" = $tpl$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Finish or remove your draft</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e4e4e7;border-radius:10px;">
<tr><td style="padding:22px 28px 0;">
<p style="margin:0;font-size:12px;line-height:1.4;letter-spacing:0.1em;text-transform:uppercase;font-weight:600;color:#71717a;">{{conferenceName}}</p>
</td></tr>
<tr><td style="padding:14px 28px 26px;">
<h1 style="margin:0 0 18px;font-size:21px;line-height:1.35;font-weight:600;color:#18181b;">Finish or remove your draft</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">A paper you started for {{conferenceName}} is still a draft.</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">You can finish it before the call closes, or delete it if you no longer plan to submit.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px;background:#fafafa;border:1px solid #e4e4e7;border-radius:8px;">
<tr><td style="padding:18px 20px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
<tr><td style="padding:0 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Paper</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{paperTitle}}</p>
</td></tr>
<tr><td style="padding:12px 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Call closes</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{deadlineAt}}</p>
</td></tr>
</table>
</td></tr>
</table>



<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 16px;">
<tr><td style="background:#18181b;border-radius:6px;">
<a href="{{draftUrl}}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">Open draft</a>
</td></tr>
</table>
<p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#71717a;word-break:break-all;">If the button does not work, paste this address into your browser:<br>{{draftUrl}}</p>

<p style="margin:0;font-size:15px;line-height:1.65;color:#52525b;">Regards,<br>Organising Committee<br>{{conferenceName}}</p>

</td></tr>
</table>
<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This message was sent by {{conferenceName}}.</p>
<p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This is a system generated mail. For any queries contact: {{contactEmail}}</p>
</td></tr>
</table>
</body>
</html>$tpl$,
  "bodyText" = $tpl${{conferenceName}}

Finish or remove your draft

A paper you started for {{conferenceName}} is still a draft.

You can finish it before the call closes, or delete it if you no longer plan to submit.

Paper: {{paperTitle}}
Call closes: {{deadlineAt}}

Open draft: {{draftUrl}}

Regards,
Organising Committee
{{conferenceName}}

This message was sent by {{conferenceName}}.

This is a system generated mail. For any queries contact: {{contactEmail}}$tpl$,
  "variables" = $tpl$["paperTitle","conferenceName","deadlineAt","draftUrl","contactEmail"]$tpl$::jsonb,
  "updatedAt" = now()
WHERE "key" = $tpl$draft.reminder$tpl$ AND "organizationId" IS NULL;

INSERT INTO "notification_templates"
  ("id", "organizationId", "key", "version", "locale", "subject", "bodyHtml", "bodyText", "variables", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid(), NULL, $tpl$draft.reminder$tpl$, 2, 'en', $tpl$Your draft for {{conferenceName}} is still open$tpl$, $tpl$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Finish or remove your draft</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e4e4e7;border-radius:10px;">
<tr><td style="padding:22px 28px 0;">
<p style="margin:0;font-size:12px;line-height:1.4;letter-spacing:0.1em;text-transform:uppercase;font-weight:600;color:#71717a;">{{conferenceName}}</p>
</td></tr>
<tr><td style="padding:14px 28px 26px;">
<h1 style="margin:0 0 18px;font-size:21px;line-height:1.35;font-weight:600;color:#18181b;">Finish or remove your draft</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">A paper you started for {{conferenceName}} is still a draft.</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">You can finish it before the call closes, or delete it if you no longer plan to submit.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px;background:#fafafa;border:1px solid #e4e4e7;border-radius:8px;">
<tr><td style="padding:18px 20px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
<tr><td style="padding:0 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Paper</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{paperTitle}}</p>
</td></tr>
<tr><td style="padding:12px 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Call closes</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{deadlineAt}}</p>
</td></tr>
</table>
</td></tr>
</table>



<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 16px;">
<tr><td style="background:#18181b;border-radius:6px;">
<a href="{{draftUrl}}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">Open draft</a>
</td></tr>
</table>
<p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#71717a;word-break:break-all;">If the button does not work, paste this address into your browser:<br>{{draftUrl}}</p>

<p style="margin:0;font-size:15px;line-height:1.65;color:#52525b;">Regards,<br>Organising Committee<br>{{conferenceName}}</p>

</td></tr>
</table>
<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This message was sent by {{conferenceName}}.</p>
<p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This is a system generated mail. For any queries contact: {{contactEmail}}</p>
</td></tr>
</table>
</body>
</html>$tpl$, $tpl${{conferenceName}}

Finish or remove your draft

A paper you started for {{conferenceName}} is still a draft.

You can finish it before the call closes, or delete it if you no longer plan to submit.

Paper: {{paperTitle}}
Call closes: {{deadlineAt}}

Open draft: {{draftUrl}}

Regards,
Organising Committee
{{conferenceName}}

This message was sent by {{conferenceName}}.

This is a system generated mail. For any queries contact: {{contactEmail}}$tpl$, $tpl$["paperTitle","conferenceName","deadlineAt","draftUrl","contactEmail"]$tpl$::jsonb, true, now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM "notification_templates" WHERE "key" = $tpl$draft.reminder$tpl$ AND "organizationId" IS NULL
);

-- reviewer.invitation
UPDATE "notification_templates" SET
  "subject" = $tpl$Reviewer invitation for {{conferenceName}}$tpl$,
  "bodyHtml" = $tpl$<!DOCTYPE html>
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
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">Dear Professor,</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">You have been invited to serve as a reviewer for {{conferenceName}}. The programme organisers would value your expertise in evaluating submissions for this conference.</p>
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
<p style="margin:10px 0 0;font-size:15px;line-height:1.55;color:#18181b;"><span style="color:#71717a;">3.</span> After you accept, the dashboard may appear empty at first. Please wait until a paper is assigned to you.</p>
</td></tr>
</table>

<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 16px;">
<tr><td style="background:#18181b;border-radius:6px;">
<a href="{{signupUrl}}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">Accept invitation</a>
</td></tr>
</table>
<p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#71717a;word-break:break-all;">If the button does not work, paste this address into your browser:<br>{{signupUrl}}</p>

<p style="margin:0;font-size:15px;line-height:1.65;color:#52525b;">Regards,<br>Organising Committee<br>{{conferenceName}}</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:4px 0 0;">
<tr><td style="padding:16px 0 0;border-top:1px solid #e4e4e7;">
<p style="margin:0;font-size:13px;line-height:1.6;color:#71717a;">To decline this invitation, open {{declineUrl}}. You will be asked to confirm; no login is needed.</p>
</td></tr>
</table>
</td></tr>
</table>
<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This message was sent by {{conferenceName}}.</p>
<p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This is a system generated mail. For any queries contact: {{contactEmail}}</p>
</td></tr>
</table>
</body>
</html>$tpl$,
  "bodyText" = $tpl${{conferenceName}}

Reviewer invitation

Dear Professor,

You have been invited to serve as a reviewer for {{conferenceName}}. The programme organisers would value your expertise in evaluating submissions for this conference.

Expires: {{expiresAt}}

How to accept
1. Open the invitation link below.
2. Sign in with the same email address that received this message. If you are new, you will be asked to choose a name and password.
3. After you accept, the dashboard may appear empty at first. Please wait until a paper is assigned to you.

Accept invitation: {{signupUrl}}

Regards,
Organising Committee
{{conferenceName}}

To decline this invitation, open {{declineUrl}}. You will be asked to confirm; no login is needed.

This message was sent by {{conferenceName}}.

This is a system generated mail. For any queries contact: {{contactEmail}}$tpl$,
  "variables" = $tpl$["conferenceName","signupUrl","declineUrl","expiresAt","contactEmail"]$tpl$::jsonb,
  "updatedAt" = now()
WHERE "key" = $tpl$reviewer.invitation$tpl$ AND "organizationId" IS NULL;

INSERT INTO "notification_templates"
  ("id", "organizationId", "key", "version", "locale", "subject", "bodyHtml", "bodyText", "variables", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid(), NULL, $tpl$reviewer.invitation$tpl$, 2, 'en', $tpl$Reviewer invitation for {{conferenceName}}$tpl$, $tpl$<!DOCTYPE html>
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
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">Dear Professor,</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">You have been invited to serve as a reviewer for {{conferenceName}}. The programme organisers would value your expertise in evaluating submissions for this conference.</p>
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
<p style="margin:10px 0 0;font-size:15px;line-height:1.55;color:#18181b;"><span style="color:#71717a;">3.</span> After you accept, the dashboard may appear empty at first. Please wait until a paper is assigned to you.</p>
</td></tr>
</table>

<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 16px;">
<tr><td style="background:#18181b;border-radius:6px;">
<a href="{{signupUrl}}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">Accept invitation</a>
</td></tr>
</table>
<p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#71717a;word-break:break-all;">If the button does not work, paste this address into your browser:<br>{{signupUrl}}</p>

<p style="margin:0;font-size:15px;line-height:1.65;color:#52525b;">Regards,<br>Organising Committee<br>{{conferenceName}}</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:4px 0 0;">
<tr><td style="padding:16px 0 0;border-top:1px solid #e4e4e7;">
<p style="margin:0;font-size:13px;line-height:1.6;color:#71717a;">To decline this invitation, open {{declineUrl}}. You will be asked to confirm; no login is needed.</p>
</td></tr>
</table>
</td></tr>
</table>
<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This message was sent by {{conferenceName}}.</p>
<p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This is a system generated mail. For any queries contact: {{contactEmail}}</p>
</td></tr>
</table>
</body>
</html>$tpl$, $tpl${{conferenceName}}

Reviewer invitation

Dear Professor,

You have been invited to serve as a reviewer for {{conferenceName}}. The programme organisers would value your expertise in evaluating submissions for this conference.

Expires: {{expiresAt}}

How to accept
1. Open the invitation link below.
2. Sign in with the same email address that received this message. If you are new, you will be asked to choose a name and password.
3. After you accept, the dashboard may appear empty at first. Please wait until a paper is assigned to you.

Accept invitation: {{signupUrl}}

Regards,
Organising Committee
{{conferenceName}}

To decline this invitation, open {{declineUrl}}. You will be asked to confirm; no login is needed.

This message was sent by {{conferenceName}}.

This is a system generated mail. For any queries contact: {{contactEmail}}$tpl$, $tpl$["conferenceName","signupUrl","declineUrl","expiresAt","contactEmail"]$tpl$::jsonb, true, now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM "notification_templates" WHERE "key" = $tpl$reviewer.invitation$tpl$ AND "organizationId" IS NULL
);

-- assignment.notified
UPDATE "notification_templates" SET
  "subject" = $tpl$Review request: {{paperTitle}}$tpl$,
  "bodyHtml" = $tpl$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Review request</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e4e4e7;border-radius:10px;">
<tr><td style="padding:22px 28px 0;">
<p style="margin:0;font-size:12px;line-height:1.4;letter-spacing:0.1em;text-transform:uppercase;font-weight:600;color:#71717a;">{{conferenceName}}</p>
</td></tr>
<tr><td style="padding:14px 28px 26px;">
<h1 style="margin:0 0 18px;font-size:21px;line-height:1.35;font-weight:600;color:#18181b;">Review request</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">Dear Dr. {{reviewerName}},</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">Thank you for serving as a member of the Technical Programme Committee of the conference {{conferenceName}}.</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">We would be grateful if you could review the paper below and submit your comments and recommendation by <strong>{{dueAt}}</strong>.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px;background:#fafafa;border:1px solid #e4e4e7;border-radius:8px;">
<tr><td style="padding:18px 20px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
<tr><td style="padding:0 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Paper</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{paperTitle}}</p>
</td></tr>
<tr><td style="padding:12px 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Review cycle</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{roundNumber}}</p>
</td></tr>
<tr><td style="padding:12px 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Review due</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{dueAt}}</p>
</td></tr>
</table>
</td></tr>
</table>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">Your valuable feedback will help us ensure the quality of the conference programme and assist the authors in improving their work.</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">This manuscript is confidential and is shared with you only for review. Please do not copy, forward, or discuss it with anyone outside the review, and do not use its unpublished ideas in your own work. Kindly review the file as received, without altering it.</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">Thank you for your time and valuable contribution to the conference.</p>


<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 16px;">
<tr><td style="background:#18181b;border-radius:6px;">
<a href="{{reviewUrl}}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">Open your review</a>
</td></tr>
</table>
<p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#71717a;word-break:break-all;">If the button does not work, paste this address into your browser:<br>{{reviewUrl}}</p>

<p style="margin:0;font-size:15px;line-height:1.65;color:#52525b;">Regards,<br>Organising Committee<br>{{conferenceName}}</p>

</td></tr>
</table>
<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This message was sent by {{conferenceName}}.</p>
<p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This is a system generated mail. For any queries contact: {{contactEmail}}</p>
</td></tr>
</table>
</body>
</html>$tpl$,
  "bodyText" = $tpl${{conferenceName}}

Review request

Dear Dr. {{reviewerName}},

Thank you for serving as a member of the Technical Programme Committee of the conference {{conferenceName}}.

We would be grateful if you could review the paper below and submit your comments and recommendation by {{dueAt}}.

Paper: {{paperTitle}}
Review cycle: {{roundNumber}}
Review due: {{dueAt}}

Your valuable feedback will help us ensure the quality of the conference programme and assist the authors in improving their work.

This manuscript is confidential and is shared with you only for review. Please do not copy, forward, or discuss it with anyone outside the review, and do not use its unpublished ideas in your own work. Kindly review the file as received, without altering it.

Thank you for your time and valuable contribution to the conference.

Open your review: {{reviewUrl}}

Regards,
Organising Committee
{{conferenceName}}

This message was sent by {{conferenceName}}.

This is a system generated mail. For any queries contact: {{contactEmail}}$tpl$,
  "variables" = $tpl$["reviewerName","paperTitle","conferenceName","roundNumber","dueAt","reviewUrl","contactEmail"]$tpl$::jsonb,
  "updatedAt" = now()
WHERE "key" = $tpl$assignment.notified$tpl$ AND "organizationId" IS NULL;

INSERT INTO "notification_templates"
  ("id", "organizationId", "key", "version", "locale", "subject", "bodyHtml", "bodyText", "variables", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid(), NULL, $tpl$assignment.notified$tpl$, 2, 'en', $tpl$Review request: {{paperTitle}}$tpl$, $tpl$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Review request</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e4e4e7;border-radius:10px;">
<tr><td style="padding:22px 28px 0;">
<p style="margin:0;font-size:12px;line-height:1.4;letter-spacing:0.1em;text-transform:uppercase;font-weight:600;color:#71717a;">{{conferenceName}}</p>
</td></tr>
<tr><td style="padding:14px 28px 26px;">
<h1 style="margin:0 0 18px;font-size:21px;line-height:1.35;font-weight:600;color:#18181b;">Review request</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">Dear Dr. {{reviewerName}},</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">Thank you for serving as a member of the Technical Programme Committee of the conference {{conferenceName}}.</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">We would be grateful if you could review the paper below and submit your comments and recommendation by <strong>{{dueAt}}</strong>.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px;background:#fafafa;border:1px solid #e4e4e7;border-radius:8px;">
<tr><td style="padding:18px 20px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
<tr><td style="padding:0 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Paper</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{paperTitle}}</p>
</td></tr>
<tr><td style="padding:12px 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Review cycle</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{roundNumber}}</p>
</td></tr>
<tr><td style="padding:12px 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Review due</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{dueAt}}</p>
</td></tr>
</table>
</td></tr>
</table>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">Your valuable feedback will help us ensure the quality of the conference programme and assist the authors in improving their work.</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">This manuscript is confidential and is shared with you only for review. Please do not copy, forward, or discuss it with anyone outside the review, and do not use its unpublished ideas in your own work. Kindly review the file as received, without altering it.</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">Thank you for your time and valuable contribution to the conference.</p>


<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 16px;">
<tr><td style="background:#18181b;border-radius:6px;">
<a href="{{reviewUrl}}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">Open your review</a>
</td></tr>
</table>
<p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#71717a;word-break:break-all;">If the button does not work, paste this address into your browser:<br>{{reviewUrl}}</p>

<p style="margin:0;font-size:15px;line-height:1.65;color:#52525b;">Regards,<br>Organising Committee<br>{{conferenceName}}</p>

</td></tr>
</table>
<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This message was sent by {{conferenceName}}.</p>
<p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This is a system generated mail. For any queries contact: {{contactEmail}}</p>
</td></tr>
</table>
</body>
</html>$tpl$, $tpl${{conferenceName}}

Review request

Dear Dr. {{reviewerName}},

Thank you for serving as a member of the Technical Programme Committee of the conference {{conferenceName}}.

We would be grateful if you could review the paper below and submit your comments and recommendation by {{dueAt}}.

Paper: {{paperTitle}}
Review cycle: {{roundNumber}}
Review due: {{dueAt}}

Your valuable feedback will help us ensure the quality of the conference programme and assist the authors in improving their work.

This manuscript is confidential and is shared with you only for review. Please do not copy, forward, or discuss it with anyone outside the review, and do not use its unpublished ideas in your own work. Kindly review the file as received, without altering it.

Thank you for your time and valuable contribution to the conference.

Open your review: {{reviewUrl}}

Regards,
Organising Committee
{{conferenceName}}

This message was sent by {{conferenceName}}.

This is a system generated mail. For any queries contact: {{contactEmail}}$tpl$, $tpl$["reviewerName","paperTitle","conferenceName","roundNumber","dueAt","reviewUrl","contactEmail"]$tpl$::jsonb, true, now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM "notification_templates" WHERE "key" = $tpl$assignment.notified$tpl$ AND "organizationId" IS NULL
);

-- review.reminder
UPDATE "notification_templates" SET
  "subject" = $tpl$Review reminder: {{paperTitle}}$tpl$,
  "bodyHtml" = $tpl$<!DOCTYPE html>
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
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">Dear Dr. {{reviewerName}},</p>
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

<p style="margin:0;font-size:15px;line-height:1.65;color:#52525b;">Regards,<br>Organising Committee<br>{{conferenceName}}</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:4px 0 0;">
<tr><td style="padding:16px 0 0;border-top:1px solid #e4e4e7;">
<p style="margin:0;font-size:13px;line-height:1.6;color:#71717a;">Late reviews may delay editorial decisions for authors.</p>
</td></tr>
</table>
</td></tr>
</table>
<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This message was sent by {{conferenceName}}.</p>
<p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This is a system generated mail. For any queries contact: {{contactEmail}}</p>
</td></tr>
</table>
</body>
</html>$tpl$,
  "bodyText" = $tpl${{conferenceName}}

Review reminder

Dear Dr. {{reviewerName}},

This is a reminder to complete your review for {{conferenceName}}.

Your current deadline is shown below. If it has passed, please submit your review or contact the chair.

Paper: {{paperTitle}}
Due date: {{dueAt}}

Open review assignments: {{reviewUrl}}

Regards,
Organising Committee
{{conferenceName}}

Late reviews may delay editorial decisions for authors.

This message was sent by {{conferenceName}}.

This is a system generated mail. For any queries contact: {{contactEmail}}$tpl$,
  "variables" = $tpl$["reviewerName","paperTitle","dueAt","conferenceName","reviewUrl","contactEmail"]$tpl$::jsonb,
  "updatedAt" = now()
WHERE "key" = $tpl$review.reminder$tpl$ AND "organizationId" IS NULL;

INSERT INTO "notification_templates"
  ("id", "organizationId", "key", "version", "locale", "subject", "bodyHtml", "bodyText", "variables", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid(), NULL, $tpl$review.reminder$tpl$, 2, 'en', $tpl$Review reminder: {{paperTitle}}$tpl$, $tpl$<!DOCTYPE html>
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
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">Dear Dr. {{reviewerName}},</p>
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

<p style="margin:0;font-size:15px;line-height:1.65;color:#52525b;">Regards,<br>Organising Committee<br>{{conferenceName}}</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:4px 0 0;">
<tr><td style="padding:16px 0 0;border-top:1px solid #e4e4e7;">
<p style="margin:0;font-size:13px;line-height:1.6;color:#71717a;">Late reviews may delay editorial decisions for authors.</p>
</td></tr>
</table>
</td></tr>
</table>
<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This message was sent by {{conferenceName}}.</p>
<p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This is a system generated mail. For any queries contact: {{contactEmail}}</p>
</td></tr>
</table>
</body>
</html>$tpl$, $tpl${{conferenceName}}

Review reminder

Dear Dr. {{reviewerName}},

This is a reminder to complete your review for {{conferenceName}}.

Your current deadline is shown below. If it has passed, please submit your review or contact the chair.

Paper: {{paperTitle}}
Due date: {{dueAt}}

Open review assignments: {{reviewUrl}}

Regards,
Organising Committee
{{conferenceName}}

Late reviews may delay editorial decisions for authors.

This message was sent by {{conferenceName}}.

This is a system generated mail. For any queries contact: {{contactEmail}}$tpl$, $tpl$["reviewerName","paperTitle","dueAt","conferenceName","reviewUrl","contactEmail"]$tpl$::jsonb, true, now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM "notification_templates" WHERE "key" = $tpl$review.reminder$tpl$ AND "organizationId" IS NULL
);

-- review.thank_you
UPDATE "notification_templates" SET
  "subject" = $tpl$Thank you for your review: {{paperTitle}}$tpl$,
  "bodyHtml" = $tpl$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Thank you for your review</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e4e4e7;border-radius:10px;">
<tr><td style="padding:22px 28px 0;">
<p style="margin:0;font-size:12px;line-height:1.4;letter-spacing:0.1em;text-transform:uppercase;font-weight:600;color:#71717a;">{{conferenceName}}</p>
</td></tr>
<tr><td style="padding:14px 28px 26px;">
<h1 style="margin:0 0 18px;font-size:21px;line-height:1.35;font-weight:600;color:#18181b;">Thank you for your review</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">Dear Dr. {{reviewerName}},</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">Thank you for submitting your review of "{{paperTitle}}" for {{conferenceName}}.</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">Your comments have been received. The programme committee will use them when it reaches a decision.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px;background:#fafafa;border:1px solid #e4e4e7;border-radius:8px;">
<tr><td style="padding:18px 20px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
<tr><td style="padding:0 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Paper ID</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{submissionNumber}}</p>
</td></tr>
<tr><td style="padding:12px 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Paper</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{paperTitle}}</p>
</td></tr>
</table>
</td></tr>
</table>





<p style="margin:0;font-size:15px;line-height:1.65;color:#52525b;">Regards,<br>Organising Committee<br>{{conferenceName}}</p>

</td></tr>
</table>
<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This message was sent by {{conferenceName}}.</p>
<p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This is a system generated mail. For any queries contact: {{contactEmail}}</p>
</td></tr>
</table>
</body>
</html>$tpl$,
  "bodyText" = $tpl${{conferenceName}}

Thank you for your review

Dear Dr. {{reviewerName}},

Thank you for submitting your review of "{{paperTitle}}" for {{conferenceName}}.

Your comments have been received. The programme committee will use them when it reaches a decision.

Paper ID: {{submissionNumber}}
Paper: {{paperTitle}}

Regards,
Organising Committee
{{conferenceName}}

This message was sent by {{conferenceName}}.

This is a system generated mail. For any queries contact: {{contactEmail}}$tpl$,
  "variables" = $tpl$["reviewerName","paperTitle","conferenceName","submissionNumber","contactEmail"]$tpl$::jsonb,
  "updatedAt" = now()
WHERE "key" = $tpl$review.thank_you$tpl$ AND "organizationId" IS NULL;

INSERT INTO "notification_templates"
  ("id", "organizationId", "key", "version", "locale", "subject", "bodyHtml", "bodyText", "variables", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid(), NULL, $tpl$review.thank_you$tpl$, 2, 'en', $tpl$Thank you for your review: {{paperTitle}}$tpl$, $tpl$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Thank you for your review</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e4e4e7;border-radius:10px;">
<tr><td style="padding:22px 28px 0;">
<p style="margin:0;font-size:12px;line-height:1.4;letter-spacing:0.1em;text-transform:uppercase;font-weight:600;color:#71717a;">{{conferenceName}}</p>
</td></tr>
<tr><td style="padding:14px 28px 26px;">
<h1 style="margin:0 0 18px;font-size:21px;line-height:1.35;font-weight:600;color:#18181b;">Thank you for your review</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">Dear Dr. {{reviewerName}},</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">Thank you for submitting your review of "{{paperTitle}}" for {{conferenceName}}.</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">Your comments have been received. The programme committee will use them when it reaches a decision.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px;background:#fafafa;border:1px solid #e4e4e7;border-radius:8px;">
<tr><td style="padding:18px 20px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
<tr><td style="padding:0 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Paper ID</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{submissionNumber}}</p>
</td></tr>
<tr><td style="padding:12px 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Paper</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{paperTitle}}</p>
</td></tr>
</table>
</td></tr>
</table>





<p style="margin:0;font-size:15px;line-height:1.65;color:#52525b;">Regards,<br>Organising Committee<br>{{conferenceName}}</p>

</td></tr>
</table>
<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This message was sent by {{conferenceName}}.</p>
<p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This is a system generated mail. For any queries contact: {{contactEmail}}</p>
</td></tr>
</table>
</body>
</html>$tpl$, $tpl${{conferenceName}}

Thank you for your review

Dear Dr. {{reviewerName}},

Thank you for submitting your review of "{{paperTitle}}" for {{conferenceName}}.

Your comments have been received. The programme committee will use them when it reaches a decision.

Paper ID: {{submissionNumber}}
Paper: {{paperTitle}}

Regards,
Organising Committee
{{conferenceName}}

This message was sent by {{conferenceName}}.

This is a system generated mail. For any queries contact: {{contactEmail}}$tpl$, $tpl$["reviewerName","paperTitle","conferenceName","submissionNumber","contactEmail"]$tpl$::jsonb, true, now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM "notification_templates" WHERE "key" = $tpl$review.thank_you$tpl$ AND "organizationId" IS NULL
);

-- decision.accepted
UPDATE "notification_templates" SET
  "subject" = $tpl$Paper accepted — {{submissionNumber}} | {{conferenceName}}$tpl$,
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
  "variables" = $tpl$["authorName","conferenceName","submissionNumber","paperTitle","registrationUrl","contactEmail"]$tpl$::jsonb,
  "updatedAt" = now()
WHERE "key" = $tpl$decision.accepted$tpl$ AND "organizationId" IS NULL;

INSERT INTO "notification_templates"
  ("id", "organizationId", "key", "version", "locale", "subject", "bodyHtml", "bodyText", "variables", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid(), NULL, $tpl$decision.accepted$tpl$, 2, 'en', $tpl$Paper accepted — {{submissionNumber}} | {{conferenceName}}$tpl$, $tpl$<!DOCTYPE html>
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
</html>$tpl$, $tpl${{conferenceName}}

Manuscript accepted for presentation

Dear {{authorName}},

We are pleased to inform you that your manuscript has been accepted for presentation at {{conferenceName}}, subject to the incorporation of reviewers’ comments, if any.

Paper ID: {{submissionNumber}}
Paper Title: {{paperTitle}}

Congratulations on this achievement!

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

This is a system generated mail. For any queries contact: {{contactEmail}}$tpl$, $tpl$["authorName","conferenceName","submissionNumber","paperTitle","registrationUrl","contactEmail"]$tpl$::jsonb, true, now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM "notification_templates" WHERE "key" = $tpl$decision.accepted$tpl$ AND "organizationId" IS NULL
);

-- decision.notified
UPDATE "notification_templates" SET
  "subject" = $tpl$Decision on your submission: {{paperTitle}}$tpl$,
  "bodyHtml" = $tpl$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Decision on your submission</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e4e4e7;border-radius:10px;">
<tr><td style="padding:22px 28px 0;">
<p style="margin:0;font-size:12px;line-height:1.4;letter-spacing:0.1em;text-transform:uppercase;font-weight:600;color:#71717a;">{{conferenceName}}</p>
</td></tr>
<tr><td style="padding:14px 28px 26px;">
<h1 style="margin:0 0 18px;font-size:21px;line-height:1.35;font-weight:600;color:#18181b;">Decision on your submission</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">Dear {{authorName}},</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">The programme committee has reached a decision on your submission to {{conferenceName}}.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px;background:#fafafa;border:1px solid #e4e4e7;border-radius:8px;">
<tr><td style="padding:18px 20px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
<tr><td style="padding:0 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Paper ID</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{submissionNumber}}</p>
</td></tr>
<tr><td style="padding:12px 0 0;">
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


<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 16px;">
<tr><td style="background:#18181b;border-radius:6px;">
<a href="{{paperUrl}}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">View your submission</a>
</td></tr>
</table>
<p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#71717a;word-break:break-all;">If the button does not work, paste this address into your browser:<br>{{paperUrl}}</p>

<p style="margin:0;font-size:15px;line-height:1.65;color:#52525b;">Regards,<br>Organising Committee<br>{{conferenceName}}</p>

</td></tr>
</table>
<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This message was sent by {{conferenceName}}.</p>
<p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This is a system generated mail. For any queries contact: {{contactEmail}}</p>
</td></tr>
</table>
</body>
</html>$tpl$,
  "bodyText" = $tpl${{conferenceName}}

Decision on your submission

Dear {{authorName}},

The programme committee has reached a decision on your submission to {{conferenceName}}.

Paper ID: {{submissionNumber}}
Paper: {{paperTitle}}
Decision: {{outcomeLabel}}

{{rationaleBlock}}

{{acceptBlock}}

View your submission: {{paperUrl}}

Regards,
Organising Committee
{{conferenceName}}

This message was sent by {{conferenceName}}.

This is a system generated mail. For any queries contact: {{contactEmail}}$tpl$,
  "variables" = $tpl$["authorName","submissionNumber","paperTitle","outcomeLabel","rationaleBlock","acceptBlock","paperUrl","conferenceName","contactEmail"]$tpl$::jsonb,
  "updatedAt" = now()
WHERE "key" = $tpl$decision.notified$tpl$ AND "organizationId" IS NULL;

INSERT INTO "notification_templates"
  ("id", "organizationId", "key", "version", "locale", "subject", "bodyHtml", "bodyText", "variables", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid(), NULL, $tpl$decision.notified$tpl$, 2, 'en', $tpl$Decision on your submission: {{paperTitle}}$tpl$, $tpl$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Decision on your submission</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e4e4e7;border-radius:10px;">
<tr><td style="padding:22px 28px 0;">
<p style="margin:0;font-size:12px;line-height:1.4;letter-spacing:0.1em;text-transform:uppercase;font-weight:600;color:#71717a;">{{conferenceName}}</p>
</td></tr>
<tr><td style="padding:14px 28px 26px;">
<h1 style="margin:0 0 18px;font-size:21px;line-height:1.35;font-weight:600;color:#18181b;">Decision on your submission</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">Dear {{authorName}},</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">The programme committee has reached a decision on your submission to {{conferenceName}}.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px;background:#fafafa;border:1px solid #e4e4e7;border-radius:8px;">
<tr><td style="padding:18px 20px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
<tr><td style="padding:0 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Paper ID</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{submissionNumber}}</p>
</td></tr>
<tr><td style="padding:12px 0 0;">
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


<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 16px;">
<tr><td style="background:#18181b;border-radius:6px;">
<a href="{{paperUrl}}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">View your submission</a>
</td></tr>
</table>
<p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#71717a;word-break:break-all;">If the button does not work, paste this address into your browser:<br>{{paperUrl}}</p>

<p style="margin:0;font-size:15px;line-height:1.65;color:#52525b;">Regards,<br>Organising Committee<br>{{conferenceName}}</p>

</td></tr>
</table>
<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This message was sent by {{conferenceName}}.</p>
<p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This is a system generated mail. For any queries contact: {{contactEmail}}</p>
</td></tr>
</table>
</body>
</html>$tpl$, $tpl${{conferenceName}}

Decision on your submission

Dear {{authorName}},

The programme committee has reached a decision on your submission to {{conferenceName}}.

Paper ID: {{submissionNumber}}
Paper: {{paperTitle}}
Decision: {{outcomeLabel}}

{{rationaleBlock}}

{{acceptBlock}}

View your submission: {{paperUrl}}

Regards,
Organising Committee
{{conferenceName}}

This message was sent by {{conferenceName}}.

This is a system generated mail. For any queries contact: {{contactEmail}}$tpl$, $tpl$["authorName","submissionNumber","paperTitle","outcomeLabel","rationaleBlock","acceptBlock","paperUrl","conferenceName","contactEmail"]$tpl$::jsonb, true, now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM "notification_templates" WHERE "key" = $tpl$decision.notified$tpl$ AND "organizationId" IS NULL
);

-- review.released
UPDATE "notification_templates" SET
  "subject" = $tpl$Reviewer feedback available: {{paperTitle}}$tpl$,
  "bodyHtml" = $tpl$<!DOCTYPE html>
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



<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 16px;">
<tr><td style="background:#18181b;border-radius:6px;">
<a href="{{paperUrl}}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">Read the reviews</a>
</td></tr>
</table>
<p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#71717a;word-break:break-all;">If the button does not work, paste this address into your browser:<br>{{paperUrl}}</p>

<p style="margin:0;font-size:15px;line-height:1.65;color:#52525b;">Regards,<br>Organising Committee<br>{{conferenceName}}</p>

</td></tr>
</table>
<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This message was sent by {{conferenceName}}.</p>
<p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This is a system generated mail. For any queries contact: {{contactEmail}}</p>
</td></tr>
</table>
</body>
</html>$tpl$,
  "bodyText" = $tpl${{conferenceName}}

Reviewer feedback released

Review feedback for your submission to {{conferenceName}} is now available.

You may read the released reviews and, if allowed, submit a rebuttal before the deadline.

Paper: {{paperTitle}}

Read the reviews: {{paperUrl}}

Regards,
Organising Committee
{{conferenceName}}

This message was sent by {{conferenceName}}.

This is a system generated mail. For any queries contact: {{contactEmail}}$tpl$,
  "variables" = $tpl$["paperTitle","conferenceName","paperUrl","contactEmail"]$tpl$::jsonb,
  "updatedAt" = now()
WHERE "key" = $tpl$review.released$tpl$ AND "organizationId" IS NULL;

INSERT INTO "notification_templates"
  ("id", "organizationId", "key", "version", "locale", "subject", "bodyHtml", "bodyText", "variables", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid(), NULL, $tpl$review.released$tpl$, 2, 'en', $tpl$Reviewer feedback available: {{paperTitle}}$tpl$, $tpl$<!DOCTYPE html>
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



<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 16px;">
<tr><td style="background:#18181b;border-radius:6px;">
<a href="{{paperUrl}}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">Read the reviews</a>
</td></tr>
</table>
<p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#71717a;word-break:break-all;">If the button does not work, paste this address into your browser:<br>{{paperUrl}}</p>

<p style="margin:0;font-size:15px;line-height:1.65;color:#52525b;">Regards,<br>Organising Committee<br>{{conferenceName}}</p>

</td></tr>
</table>
<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This message was sent by {{conferenceName}}.</p>
<p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This is a system generated mail. For any queries contact: {{contactEmail}}</p>
</td></tr>
</table>
</body>
</html>$tpl$, $tpl${{conferenceName}}

Reviewer feedback released

Review feedback for your submission to {{conferenceName}} is now available.

You may read the released reviews and, if allowed, submit a rebuttal before the deadline.

Paper: {{paperTitle}}

Read the reviews: {{paperUrl}}

Regards,
Organising Committee
{{conferenceName}}

This message was sent by {{conferenceName}}.

This is a system generated mail. For any queries contact: {{contactEmail}}$tpl$, $tpl$["paperTitle","conferenceName","paperUrl","contactEmail"]$tpl$::jsonb, true, now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM "notification_templates" WHERE "key" = $tpl$review.released$tpl$ AND "organizationId" IS NULL
);

-- cameraready.reminder
UPDATE "notification_templates" SET
  "subject" = $tpl$Camera-ready due soon: {{paperTitle}}$tpl$,
  "bodyHtml" = $tpl$<!DOCTYPE html>
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



<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 16px;">
<tr><td style="background:#18181b;border-radius:6px;">
<a href="{{paperUrl}}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">Upload camera-ready PDF</a>
</td></tr>
</table>
<p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#71717a;word-break:break-all;">If the button does not work, paste this address into your browser:<br>{{paperUrl}}</p>

<p style="margin:0;font-size:15px;line-height:1.65;color:#52525b;">Regards,<br>Organising Committee<br>{{conferenceName}}</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:4px 0 0;">
<tr><td style="padding:16px 0 0;border-top:1px solid #e4e4e7;">
<p style="margin:0;font-size:13px;line-height:1.6;color:#71717a;">Missing the camera-ready deadline may affect publication of your paper.</p>
</td></tr>
</table>
</td></tr>
</table>
<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This message was sent by {{conferenceName}}.</p>
<p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This is a system generated mail. For any queries contact: {{contactEmail}}</p>
</td></tr>
</table>
</body>
</html>$tpl$,
  "bodyText" = $tpl${{conferenceName}}

Camera-ready deadline approaching

Your accepted paper requires a camera-ready PDF before it can be included in the {{conferenceName}} proceedings.

Please upload the final PDF before the deadline below.

Paper: {{paperTitle}}
Deadline: {{deadlineAt}}

Upload camera-ready PDF: {{paperUrl}}

Regards,
Organising Committee
{{conferenceName}}

Missing the camera-ready deadline may affect publication of your paper.

This message was sent by {{conferenceName}}.

This is a system generated mail. For any queries contact: {{contactEmail}}$tpl$,
  "variables" = $tpl$["paperTitle","deadlineAt","conferenceName","paperUrl","contactEmail"]$tpl$::jsonb,
  "updatedAt" = now()
WHERE "key" = $tpl$cameraready.reminder$tpl$ AND "organizationId" IS NULL;

INSERT INTO "notification_templates"
  ("id", "organizationId", "key", "version", "locale", "subject", "bodyHtml", "bodyText", "variables", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid(), NULL, $tpl$cameraready.reminder$tpl$, 2, 'en', $tpl$Camera-ready due soon: {{paperTitle}}$tpl$, $tpl$<!DOCTYPE html>
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



<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 16px;">
<tr><td style="background:#18181b;border-radius:6px;">
<a href="{{paperUrl}}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">Upload camera-ready PDF</a>
</td></tr>
</table>
<p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#71717a;word-break:break-all;">If the button does not work, paste this address into your browser:<br>{{paperUrl}}</p>

<p style="margin:0;font-size:15px;line-height:1.65;color:#52525b;">Regards,<br>Organising Committee<br>{{conferenceName}}</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:4px 0 0;">
<tr><td style="padding:16px 0 0;border-top:1px solid #e4e4e7;">
<p style="margin:0;font-size:13px;line-height:1.6;color:#71717a;">Missing the camera-ready deadline may affect publication of your paper.</p>
</td></tr>
</table>
</td></tr>
</table>
<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This message was sent by {{conferenceName}}.</p>
<p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This is a system generated mail. For any queries contact: {{contactEmail}}</p>
</td></tr>
</table>
</body>
</html>$tpl$, $tpl${{conferenceName}}

Camera-ready deadline approaching

Your accepted paper requires a camera-ready PDF before it can be included in the {{conferenceName}} proceedings.

Please upload the final PDF before the deadline below.

Paper: {{paperTitle}}
Deadline: {{deadlineAt}}

Upload camera-ready PDF: {{paperUrl}}

Regards,
Organising Committee
{{conferenceName}}

Missing the camera-ready deadline may affect publication of your paper.

This message was sent by {{conferenceName}}.

This is a system generated mail. For any queries contact: {{contactEmail}}$tpl$, $tpl$["paperTitle","deadlineAt","conferenceName","paperUrl","contactEmail"]$tpl$::jsonb, true, now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM "notification_templates" WHERE "key" = $tpl$cameraready.reminder$tpl$ AND "organizationId" IS NULL
);

-- registration.early_bird_ending
UPDATE "notification_templates" SET
  "subject" = $tpl$Early-bird registration ends soon: {{paperTitle}}$tpl$,
  "bodyHtml" = $tpl$<!DOCTYPE html>
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
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">Early-bird registration pricing for your accepted paper at {{conferenceName}} will end soon.</p>
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



<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 16px;">
<tr><td style="background:#18181b;border-radius:6px;">
<a href="{{registrationUrl}}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">Complete registration</a>
</td></tr>
</table>
<p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#71717a;word-break:break-all;">If the button does not work, paste this address into your browser:<br>{{registrationUrl}}</p>

<p style="margin:0;font-size:15px;line-height:1.65;color:#52525b;">Regards,<br>Organising Committee<br>{{conferenceName}}</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:4px 0 0;">
<tr><td style="padding:16px 0 0;border-top:1px solid #e4e4e7;">
<p style="margin:0;font-size:13px;line-height:1.6;color:#71717a;">After this date, standard registration fees will apply.</p>
</td></tr>
</table>
</td></tr>
</table>
<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This message was sent by {{conferenceName}}.</p>
<p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This is a system generated mail. For any queries contact: {{contactEmail}}</p>
</td></tr>
</table>
</body>
</html>$tpl$,
  "bodyText" = $tpl${{conferenceName}}

Early-bird registration ending soon

Early-bird registration pricing for your accepted paper at {{conferenceName}} will end soon.

Complete your registration before the early-bird deadline to lock in the reduced rate.

Paper: {{paperTitle}}
Early-bird ends: {{earlyBirdEndsAt}}

Complete registration: {{registrationUrl}}

Regards,
Organising Committee
{{conferenceName}}

After this date, standard registration fees will apply.

This message was sent by {{conferenceName}}.

This is a system generated mail. For any queries contact: {{contactEmail}}$tpl$,
  "variables" = $tpl$["paperTitle","earlyBirdEndsAt","conferenceName","registrationUrl","contactEmail"]$tpl$::jsonb,
  "updatedAt" = now()
WHERE "key" = $tpl$registration.early_bird_ending$tpl$ AND "organizationId" IS NULL;

INSERT INTO "notification_templates"
  ("id", "organizationId", "key", "version", "locale", "subject", "bodyHtml", "bodyText", "variables", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid(), NULL, $tpl$registration.early_bird_ending$tpl$, 2, 'en', $tpl$Early-bird registration ends soon: {{paperTitle}}$tpl$, $tpl$<!DOCTYPE html>
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
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">Early-bird registration pricing for your accepted paper at {{conferenceName}} will end soon.</p>
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



<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 16px;">
<tr><td style="background:#18181b;border-radius:6px;">
<a href="{{registrationUrl}}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">Complete registration</a>
</td></tr>
</table>
<p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#71717a;word-break:break-all;">If the button does not work, paste this address into your browser:<br>{{registrationUrl}}</p>

<p style="margin:0;font-size:15px;line-height:1.65;color:#52525b;">Regards,<br>Organising Committee<br>{{conferenceName}}</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:4px 0 0;">
<tr><td style="padding:16px 0 0;border-top:1px solid #e4e4e7;">
<p style="margin:0;font-size:13px;line-height:1.6;color:#71717a;">After this date, standard registration fees will apply.</p>
</td></tr>
</table>
</td></tr>
</table>
<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This message was sent by {{conferenceName}}.</p>
<p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This is a system generated mail. For any queries contact: {{contactEmail}}</p>
</td></tr>
</table>
</body>
</html>$tpl$, $tpl${{conferenceName}}

Early-bird registration ending soon

Early-bird registration pricing for your accepted paper at {{conferenceName}} will end soon.

Complete your registration before the early-bird deadline to lock in the reduced rate.

Paper: {{paperTitle}}
Early-bird ends: {{earlyBirdEndsAt}}

Complete registration: {{registrationUrl}}

Regards,
Organising Committee
{{conferenceName}}

After this date, standard registration fees will apply.

This message was sent by {{conferenceName}}.

This is a system generated mail. For any queries contact: {{contactEmail}}$tpl$, $tpl$["paperTitle","earlyBirdEndsAt","conferenceName","registrationUrl","contactEmail"]$tpl$::jsonb, true, now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM "notification_templates" WHERE "key" = $tpl$registration.early_bird_ending$tpl$ AND "organizationId" IS NULL
);

-- registration.confirmed
UPDATE "notification_templates" SET
  "subject" = $tpl$Payment received — {{paperTitle}}$tpl$,
  "bodyHtml" = $tpl$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Payment received</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e4e4e7;border-radius:10px;">
<tr><td style="padding:22px 28px 0;">
<p style="margin:0;font-size:12px;line-height:1.4;letter-spacing:0.1em;text-transform:uppercase;font-weight:600;color:#71717a;">{{conferenceName}}</p>
</td></tr>
<tr><td style="padding:14px 28px 26px;">
<h1 style="margin:0 0 18px;font-size:21px;line-height:1.35;font-weight:600;color:#18181b;">Payment received</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">Thank you — your registration payment has been received for the paper below.</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">Student registrations remain subject to document verification where applicable.</p>
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
<tr><td style="padding:12px 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Transaction ID</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{transactionId}}</p>
</td></tr>
</table>
</td></tr>
</table>



<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 16px;">
<tr><td style="background:#18181b;border-radius:6px;">
<a href="{{registrationUrl}}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">View registration and invoice</a>
</td></tr>
</table>
<p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#71717a;word-break:break-all;">If the button does not work, paste this address into your browser:<br>{{registrationUrl}}</p>

<p style="margin:0;font-size:15px;line-height:1.65;color:#52525b;">Regards,<br>Organising Committee<br>{{conferenceName}}</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:4px 0 0;">
<tr><td style="padding:16px 0 0;border-top:1px solid #e4e4e7;">
<p style="margin:0;font-size:13px;line-height:1.6;color:#71717a;">Keep this email for your records.</p>
</td></tr>
</table>
</td></tr>
</table>
<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This message was sent by {{conferenceName}}.</p>
<p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This is a system generated mail. For any queries contact: {{contactEmail}}</p>
</td></tr>
</table>
</body>
</html>$tpl$,
  "bodyText" = $tpl${{conferenceName}}

Payment received

Thank you — your registration payment has been received for the paper below.

Student registrations remain subject to document verification where applicable.

Paper: {{paperTitle}}
Amount paid: {{amountFormatted}}
Transaction ID: {{transactionId}}

View registration and invoice: {{registrationUrl}}

Regards,
Organising Committee
{{conferenceName}}

Keep this email for your records.

This message was sent by {{conferenceName}}.

This is a system generated mail. For any queries contact: {{contactEmail}}$tpl$,
  "variables" = $tpl$["paperTitle","amountFormatted","transactionId","registrationUrl","conferenceName","contactEmail"]$tpl$::jsonb,
  "updatedAt" = now()
WHERE "key" = $tpl$registration.confirmed$tpl$ AND "organizationId" IS NULL;

INSERT INTO "notification_templates"
  ("id", "organizationId", "key", "version", "locale", "subject", "bodyHtml", "bodyText", "variables", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid(), NULL, $tpl$registration.confirmed$tpl$, 2, 'en', $tpl$Payment received — {{paperTitle}}$tpl$, $tpl$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Payment received</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e4e4e7;border-radius:10px;">
<tr><td style="padding:22px 28px 0;">
<p style="margin:0;font-size:12px;line-height:1.4;letter-spacing:0.1em;text-transform:uppercase;font-weight:600;color:#71717a;">{{conferenceName}}</p>
</td></tr>
<tr><td style="padding:14px 28px 26px;">
<h1 style="margin:0 0 18px;font-size:21px;line-height:1.35;font-weight:600;color:#18181b;">Payment received</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">Thank you — your registration payment has been received for the paper below.</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">Student registrations remain subject to document verification where applicable.</p>
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
<tr><td style="padding:12px 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Transaction ID</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{transactionId}}</p>
</td></tr>
</table>
</td></tr>
</table>



<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 16px;">
<tr><td style="background:#18181b;border-radius:6px;">
<a href="{{registrationUrl}}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">View registration and invoice</a>
</td></tr>
</table>
<p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#71717a;word-break:break-all;">If the button does not work, paste this address into your browser:<br>{{registrationUrl}}</p>

<p style="margin:0;font-size:15px;line-height:1.65;color:#52525b;">Regards,<br>Organising Committee<br>{{conferenceName}}</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:4px 0 0;">
<tr><td style="padding:16px 0 0;border-top:1px solid #e4e4e7;">
<p style="margin:0;font-size:13px;line-height:1.6;color:#71717a;">Keep this email for your records.</p>
</td></tr>
</table>
</td></tr>
</table>
<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This message was sent by {{conferenceName}}.</p>
<p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This is a system generated mail. For any queries contact: {{contactEmail}}</p>
</td></tr>
</table>
</body>
</html>$tpl$, $tpl${{conferenceName}}

Payment received

Thank you — your registration payment has been received for the paper below.

Student registrations remain subject to document verification where applicable.

Paper: {{paperTitle}}
Amount paid: {{amountFormatted}}
Transaction ID: {{transactionId}}

View registration and invoice: {{registrationUrl}}

Regards,
Organising Committee
{{conferenceName}}

Keep this email for your records.

This message was sent by {{conferenceName}}.

This is a system generated mail. For any queries contact: {{contactEmail}}$tpl$, $tpl$["paperTitle","amountFormatted","transactionId","registrationUrl","conferenceName","contactEmail"]$tpl$::jsonb, true, now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM "notification_templates" WHERE "key" = $tpl$registration.confirmed$tpl$ AND "organizationId" IS NULL
);

-- registration.verification_approved
UPDATE "notification_templates" SET
  "subject" = $tpl$Student verification approved: {{paperTitle}}$tpl$,
  "bodyHtml" = $tpl$<!DOCTYPE html>
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



<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 16px;">
<tr><td style="background:#18181b;border-radius:6px;">
<a href="{{registrationUrl}}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">View registration</a>
</td></tr>
</table>
<p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#71717a;word-break:break-all;">If the button does not work, paste this address into your browser:<br>{{registrationUrl}}</p>

<p style="margin:0;font-size:15px;line-height:1.65;color:#52525b;">Regards,<br>Organising Committee<br>{{conferenceName}}</p>

</td></tr>
</table>
<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This message was sent by {{conferenceName}}.</p>
<p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This is a system generated mail. For any queries contact: {{contactEmail}}</p>
</td></tr>
</table>
</body>
</html>$tpl$,
  "bodyText" = $tpl${{conferenceName}}

Student verification approved

Your student status documentation has been reviewed and approved.

Your registration now reflects the approved student rate. No further action is required.

Paper: {{paperTitle}}

View registration: {{registrationUrl}}

Regards,
Organising Committee
{{conferenceName}}

This message was sent by {{conferenceName}}.

This is a system generated mail. For any queries contact: {{contactEmail}}$tpl$,
  "variables" = $tpl$["paperTitle","conferenceName","registrationUrl","contactEmail"]$tpl$::jsonb,
  "updatedAt" = now()
WHERE "key" = $tpl$registration.verification_approved$tpl$ AND "organizationId" IS NULL;

INSERT INTO "notification_templates"
  ("id", "organizationId", "key", "version", "locale", "subject", "bodyHtml", "bodyText", "variables", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid(), NULL, $tpl$registration.verification_approved$tpl$, 2, 'en', $tpl$Student verification approved: {{paperTitle}}$tpl$, $tpl$<!DOCTYPE html>
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



<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 16px;">
<tr><td style="background:#18181b;border-radius:6px;">
<a href="{{registrationUrl}}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">View registration</a>
</td></tr>
</table>
<p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#71717a;word-break:break-all;">If the button does not work, paste this address into your browser:<br>{{registrationUrl}}</p>

<p style="margin:0;font-size:15px;line-height:1.65;color:#52525b;">Regards,<br>Organising Committee<br>{{conferenceName}}</p>

</td></tr>
</table>
<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This message was sent by {{conferenceName}}.</p>
<p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This is a system generated mail. For any queries contact: {{contactEmail}}</p>
</td></tr>
</table>
</body>
</html>$tpl$, $tpl${{conferenceName}}

Student verification approved

Your student status documentation has been reviewed and approved.

Your registration now reflects the approved student rate. No further action is required.

Paper: {{paperTitle}}

View registration: {{registrationUrl}}

Regards,
Organising Committee
{{conferenceName}}

This message was sent by {{conferenceName}}.

This is a system generated mail. For any queries contact: {{contactEmail}}$tpl$, $tpl$["paperTitle","conferenceName","registrationUrl","contactEmail"]$tpl$::jsonb, true, now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM "notification_templates" WHERE "key" = $tpl$registration.verification_approved$tpl$ AND "organizationId" IS NULL
);

-- registration.student_rate_rejected
UPDATE "notification_templates" SET
  "subject" = $tpl$Student rate not approved: {{paperTitle}}$tpl$,
  "bodyHtml" = $tpl$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Student rate not approved</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e4e4e7;border-radius:10px;">
<tr><td style="padding:22px 28px 0;">
<p style="margin:0;font-size:12px;line-height:1.4;letter-spacing:0.1em;text-transform:uppercase;font-weight:600;color:#71717a;">{{conferenceName}}</p>
</td></tr>
<tr><td style="padding:14px 28px 26px;">
<h1 style="margin:0 0 18px;font-size:21px;line-height:1.35;font-weight:600;color:#18181b;">Student rate not approved</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">Your student document for the paper below was reviewed, and the student rate was not approved.</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">{{nextStep}}</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px;background:#fafafa;border:1px solid #e4e4e7;border-radius:8px;">
<tr><td style="padding:18px 20px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
<tr><td style="padding:0 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Paper</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{paperTitle}}</p>
</td></tr>
<tr><td style="padding:12px 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Reason</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{reason}}</p>
</td></tr>
</table>
</td></tr>
</table>



<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 16px;">
<tr><td style="background:#18181b;border-radius:6px;">
<a href="{{registrationUrl}}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">Open registration</a>
</td></tr>
</table>
<p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#71717a;word-break:break-all;">If the button does not work, paste this address into your browser:<br>{{registrationUrl}}</p>

<p style="margin:0;font-size:15px;line-height:1.65;color:#52525b;">Regards,<br>Organising Committee<br>{{conferenceName}}</p>

</td></tr>
</table>
<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This message was sent by {{conferenceName}}.</p>
<p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This is a system generated mail. For any queries contact: {{contactEmail}}</p>
</td></tr>
</table>
</body>
</html>$tpl$,
  "bodyText" = $tpl${{conferenceName}}

Student rate not approved

Your student document for the paper below was reviewed, and the student rate was not approved.

{{nextStep}}

Paper: {{paperTitle}}
Reason: {{reason}}

Open registration: {{registrationUrl}}

Regards,
Organising Committee
{{conferenceName}}

This message was sent by {{conferenceName}}.

This is a system generated mail. For any queries contact: {{contactEmail}}$tpl$,
  "variables" = $tpl$["paperTitle","reason","nextStep","conferenceName","registrationUrl","contactEmail"]$tpl$::jsonb,
  "updatedAt" = now()
WHERE "key" = $tpl$registration.student_rate_rejected$tpl$ AND "organizationId" IS NULL;

INSERT INTO "notification_templates"
  ("id", "organizationId", "key", "version", "locale", "subject", "bodyHtml", "bodyText", "variables", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid(), NULL, $tpl$registration.student_rate_rejected$tpl$, 2, 'en', $tpl$Student rate not approved: {{paperTitle}}$tpl$, $tpl$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Student rate not approved</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e4e4e7;border-radius:10px;">
<tr><td style="padding:22px 28px 0;">
<p style="margin:0;font-size:12px;line-height:1.4;letter-spacing:0.1em;text-transform:uppercase;font-weight:600;color:#71717a;">{{conferenceName}}</p>
</td></tr>
<tr><td style="padding:14px 28px 26px;">
<h1 style="margin:0 0 18px;font-size:21px;line-height:1.35;font-weight:600;color:#18181b;">Student rate not approved</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">Your student document for the paper below was reviewed, and the student rate was not approved.</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">{{nextStep}}</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px;background:#fafafa;border:1px solid #e4e4e7;border-radius:8px;">
<tr><td style="padding:18px 20px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
<tr><td style="padding:0 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Paper</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{paperTitle}}</p>
</td></tr>
<tr><td style="padding:12px 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Reason</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{reason}}</p>
</td></tr>
</table>
</td></tr>
</table>



<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 16px;">
<tr><td style="background:#18181b;border-radius:6px;">
<a href="{{registrationUrl}}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">Open registration</a>
</td></tr>
</table>
<p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#71717a;word-break:break-all;">If the button does not work, paste this address into your browser:<br>{{registrationUrl}}</p>

<p style="margin:0;font-size:15px;line-height:1.65;color:#52525b;">Regards,<br>Organising Committee<br>{{conferenceName}}</p>

</td></tr>
</table>
<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This message was sent by {{conferenceName}}.</p>
<p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This is a system generated mail. For any queries contact: {{contactEmail}}</p>
</td></tr>
</table>
</body>
</html>$tpl$, $tpl${{conferenceName}}

Student rate not approved

Your student document for the paper below was reviewed, and the student rate was not approved.

{{nextStep}}

Paper: {{paperTitle}}
Reason: {{reason}}

Open registration: {{registrationUrl}}

Regards,
Organising Committee
{{conferenceName}}

This message was sent by {{conferenceName}}.

This is a system generated mail. For any queries contact: {{contactEmail}}$tpl$, $tpl$["paperTitle","reason","nextStep","conferenceName","registrationUrl","contactEmail"]$tpl$::jsonb, true, now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM "notification_templates" WHERE "key" = $tpl$registration.student_rate_rejected$tpl$ AND "organizationId" IS NULL
);

-- registration.clarification_requested
UPDATE "notification_templates" SET
  "subject" = $tpl$Action needed: student verification for {{paperTitle}}$tpl$,
  "bodyHtml" = $tpl$<!DOCTYPE html>
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



<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 16px;">
<tr><td style="background:#18181b;border-radius:6px;">
<a href="{{registrationUrl}}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">Upload documents</a>
</td></tr>
</table>
<p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#71717a;word-break:break-all;">If the button does not work, paste this address into your browser:<br>{{registrationUrl}}</p>

<p style="margin:0;font-size:15px;line-height:1.65;color:#52525b;">Regards,<br>Organising Committee<br>{{conferenceName}}</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:4px 0 0;">
<tr><td style="padding:16px 0 0;border-top:1px solid #e4e4e7;">
<p style="margin:0;font-size:13px;line-height:1.6;color:#71717a;">Your registration may remain on hold until verification is complete.</p>
</td></tr>
</table>
</td></tr>
</table>
<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This message was sent by {{conferenceName}}.</p>
<p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This is a system generated mail. For any queries contact: {{contactEmail}}</p>
</td></tr>
</table>
</body>
</html>$tpl$,
  "bodyText" = $tpl${{conferenceName}}

Student verification — clarification needed

We need additional documents to complete your student verification.

Please review the committee note below and upload the requested materials when you sign in.

Paper: {{paperTitle}}
Committee note: {{note}}

Upload documents: {{registrationUrl}}

Regards,
Organising Committee
{{conferenceName}}

Your registration may remain on hold until verification is complete.

This message was sent by {{conferenceName}}.

This is a system generated mail. For any queries contact: {{contactEmail}}$tpl$,
  "variables" = $tpl$["paperTitle","note","conferenceName","registrationUrl","contactEmail"]$tpl$::jsonb,
  "updatedAt" = now()
WHERE "key" = $tpl$registration.clarification_requested$tpl$ AND "organizationId" IS NULL;

INSERT INTO "notification_templates"
  ("id", "organizationId", "key", "version", "locale", "subject", "bodyHtml", "bodyText", "variables", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid(), NULL, $tpl$registration.clarification_requested$tpl$, 2, 'en', $tpl$Action needed: student verification for {{paperTitle}}$tpl$, $tpl$<!DOCTYPE html>
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



<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 16px;">
<tr><td style="background:#18181b;border-radius:6px;">
<a href="{{registrationUrl}}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">Upload documents</a>
</td></tr>
</table>
<p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#71717a;word-break:break-all;">If the button does not work, paste this address into your browser:<br>{{registrationUrl}}</p>

<p style="margin:0;font-size:15px;line-height:1.65;color:#52525b;">Regards,<br>Organising Committee<br>{{conferenceName}}</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:4px 0 0;">
<tr><td style="padding:16px 0 0;border-top:1px solid #e4e4e7;">
<p style="margin:0;font-size:13px;line-height:1.6;color:#71717a;">Your registration may remain on hold until verification is complete.</p>
</td></tr>
</table>
</td></tr>
</table>
<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This message was sent by {{conferenceName}}.</p>
<p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This is a system generated mail. For any queries contact: {{contactEmail}}</p>
</td></tr>
</table>
</body>
</html>$tpl$, $tpl${{conferenceName}}

Student verification — clarification needed

We need additional documents to complete your student verification.

Please review the committee note below and upload the requested materials when you sign in.

Paper: {{paperTitle}}
Committee note: {{note}}

Upload documents: {{registrationUrl}}

Regards,
Organising Committee
{{conferenceName}}

Your registration may remain on hold until verification is complete.

This message was sent by {{conferenceName}}.

This is a system generated mail. For any queries contact: {{contactEmail}}$tpl$, $tpl$["paperTitle","note","conferenceName","registrationUrl","contactEmail"]$tpl$::jsonb, true, now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM "notification_templates" WHERE "key" = $tpl$registration.clarification_requested$tpl$ AND "organizationId" IS NULL
);

-- registration.additional_payment_required
UPDATE "notification_templates" SET
  "subject" = $tpl$Additional registration payment required: {{paperTitle}}$tpl$,
  "bodyHtml" = $tpl$<!DOCTYPE html>
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
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">Your student document was reviewed, and the student rate was not approved.</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">The regular fee now applies. Please pay the remaining amount below to complete your registration.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px;background:#fafafa;border:1px solid #e4e4e7;border-radius:8px;">
<tr><td style="padding:18px 20px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
<tr><td style="padding:0 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Paper</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{paperTitle}}</p>
</td></tr>
<tr><td style="padding:12px 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Reason</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{reason}}</p>
</td></tr>
<tr><td style="padding:12px 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Additional amount due</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{amountFormatted}}</p>
</td></tr>
<tr><td style="padding:12px 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Pay by</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{deadlineAt}}</p>
</td></tr>
</table>
</td></tr>
</table>



<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 16px;">
<tr><td style="background:#18181b;border-radius:6px;">
<a href="{{registrationUrl}}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">Pay the remaining amount</a>
</td></tr>
</table>
<p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#71717a;word-break:break-all;">If the button does not work, paste this address into your browser:<br>{{registrationUrl}}</p>

<p style="margin:0;font-size:15px;line-height:1.65;color:#52525b;">Regards,<br>Organising Committee<br>{{conferenceName}}</p>

</td></tr>
</table>
<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This message was sent by {{conferenceName}}.</p>
<p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This is a system generated mail. For any queries contact: {{contactEmail}}</p>
</td></tr>
</table>
</body>
</html>$tpl$,
  "bodyText" = $tpl${{conferenceName}}

Additional payment required

Your student document was reviewed, and the student rate was not approved.

The regular fee now applies. Please pay the remaining amount below to complete your registration.

Paper: {{paperTitle}}
Reason: {{reason}}
Additional amount due: {{amountFormatted}}
Pay by: {{deadlineAt}}

Pay the remaining amount: {{registrationUrl}}

Regards,
Organising Committee
{{conferenceName}}

This message was sent by {{conferenceName}}.

This is a system generated mail. For any queries contact: {{contactEmail}}$tpl$,
  "variables" = $tpl$["paperTitle","reason","amountFormatted","deadlineAt","conferenceName","registrationUrl","contactEmail"]$tpl$::jsonb,
  "updatedAt" = now()
WHERE "key" = $tpl$registration.additional_payment_required$tpl$ AND "organizationId" IS NULL;

INSERT INTO "notification_templates"
  ("id", "organizationId", "key", "version", "locale", "subject", "bodyHtml", "bodyText", "variables", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid(), NULL, $tpl$registration.additional_payment_required$tpl$, 2, 'en', $tpl$Additional registration payment required: {{paperTitle}}$tpl$, $tpl$<!DOCTYPE html>
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
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">Your student document was reviewed, and the student rate was not approved.</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">The regular fee now applies. Please pay the remaining amount below to complete your registration.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px;background:#fafafa;border:1px solid #e4e4e7;border-radius:8px;">
<tr><td style="padding:18px 20px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
<tr><td style="padding:0 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Paper</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{paperTitle}}</p>
</td></tr>
<tr><td style="padding:12px 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Reason</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{reason}}</p>
</td></tr>
<tr><td style="padding:12px 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Additional amount due</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{amountFormatted}}</p>
</td></tr>
<tr><td style="padding:12px 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Pay by</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:#18181b;">{{deadlineAt}}</p>
</td></tr>
</table>
</td></tr>
</table>



<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 16px;">
<tr><td style="background:#18181b;border-radius:6px;">
<a href="{{registrationUrl}}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">Pay the remaining amount</a>
</td></tr>
</table>
<p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#71717a;word-break:break-all;">If the button does not work, paste this address into your browser:<br>{{registrationUrl}}</p>

<p style="margin:0;font-size:15px;line-height:1.65;color:#52525b;">Regards,<br>Organising Committee<br>{{conferenceName}}</p>

</td></tr>
</table>
<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This message was sent by {{conferenceName}}.</p>
<p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This is a system generated mail. For any queries contact: {{contactEmail}}</p>
</td></tr>
</table>
</body>
</html>$tpl$, $tpl${{conferenceName}}

Additional payment required

Your student document was reviewed, and the student rate was not approved.

The regular fee now applies. Please pay the remaining amount below to complete your registration.

Paper: {{paperTitle}}
Reason: {{reason}}
Additional amount due: {{amountFormatted}}
Pay by: {{deadlineAt}}

Pay the remaining amount: {{registrationUrl}}

Regards,
Organising Committee
{{conferenceName}}

This message was sent by {{conferenceName}}.

This is a system generated mail. For any queries contact: {{contactEmail}}$tpl$, $tpl$["paperTitle","reason","amountFormatted","deadlineAt","conferenceName","registrationUrl","contactEmail"]$tpl$::jsonb, true, now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM "notification_templates" WHERE "key" = $tpl$registration.additional_payment_required$tpl$ AND "organizationId" IS NULL
);

-- registration.deadline_reminder
UPDATE "notification_templates" SET
  "subject" = $tpl$Registration deadline approaching: {{paperTitle}}$tpl$,
  "bodyHtml" = $tpl$<!DOCTYPE html>
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



<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 16px;">
<tr><td style="background:#18181b;border-radius:6px;">
<a href="{{registrationUrl}}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">Complete registration</a>
</td></tr>
</table>
<p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#71717a;word-break:break-all;">If the button does not work, paste this address into your browser:<br>{{registrationUrl}}</p>

<p style="margin:0;font-size:15px;line-height:1.65;color:#52525b;">Regards,<br>Organising Committee<br>{{conferenceName}}</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:4px 0 0;">
<tr><td style="padding:16px 0 0;border-top:1px solid #e4e4e7;">
<p style="margin:0;font-size:13px;line-height:1.6;color:#71717a;">Papers with unpaid registration after the deadline may be withdrawn for non-payment.</p>
</td></tr>
</table>
</td></tr>
</table>
<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This message was sent by {{conferenceName}}.</p>
<p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This is a system generated mail. For any queries contact: {{contactEmail}}</p>
</td></tr>
</table>
</body>
</html>$tpl$,
  "bodyText" = $tpl${{conferenceName}}

Registration deadline approaching

Your accepted paper still requires completed registration and payment.

Please complete registration before the deadline below.

Paper: {{paperTitle}}
Registration deadline: {{deadlineAt}}

Complete registration: {{registrationUrl}}

Regards,
Organising Committee
{{conferenceName}}

Papers with unpaid registration after the deadline may be withdrawn for non-payment.

This message was sent by {{conferenceName}}.

This is a system generated mail. For any queries contact: {{contactEmail}}$tpl$,
  "variables" = $tpl$["paperTitle","deadlineAt","conferenceName","registrationUrl","contactEmail"]$tpl$::jsonb,
  "updatedAt" = now()
WHERE "key" = $tpl$registration.deadline_reminder$tpl$ AND "organizationId" IS NULL;

INSERT INTO "notification_templates"
  ("id", "organizationId", "key", "version", "locale", "subject", "bodyHtml", "bodyText", "variables", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid(), NULL, $tpl$registration.deadline_reminder$tpl$, 2, 'en', $tpl$Registration deadline approaching: {{paperTitle}}$tpl$, $tpl$<!DOCTYPE html>
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



<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 16px;">
<tr><td style="background:#18181b;border-radius:6px;">
<a href="{{registrationUrl}}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">Complete registration</a>
</td></tr>
</table>
<p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#71717a;word-break:break-all;">If the button does not work, paste this address into your browser:<br>{{registrationUrl}}</p>

<p style="margin:0;font-size:15px;line-height:1.65;color:#52525b;">Regards,<br>Organising Committee<br>{{conferenceName}}</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:4px 0 0;">
<tr><td style="padding:16px 0 0;border-top:1px solid #e4e4e7;">
<p style="margin:0;font-size:13px;line-height:1.6;color:#71717a;">Papers with unpaid registration after the deadline may be withdrawn for non-payment.</p>
</td></tr>
</table>
</td></tr>
</table>
<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This message was sent by {{conferenceName}}.</p>
<p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This is a system generated mail. For any queries contact: {{contactEmail}}</p>
</td></tr>
</table>
</body>
</html>$tpl$, $tpl${{conferenceName}}

Registration deadline approaching

Your accepted paper still requires completed registration and payment.

Please complete registration before the deadline below.

Paper: {{paperTitle}}
Registration deadline: {{deadlineAt}}

Complete registration: {{registrationUrl}}

Regards,
Organising Committee
{{conferenceName}}

Papers with unpaid registration after the deadline may be withdrawn for non-payment.

This message was sent by {{conferenceName}}.

This is a system generated mail. For any queries contact: {{contactEmail}}$tpl$, $tpl$["paperTitle","deadlineAt","conferenceName","registrationUrl","contactEmail"]$tpl$::jsonb, true, now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM "notification_templates" WHERE "key" = $tpl$registration.deadline_reminder$tpl$ AND "organizationId" IS NULL
);

-- registration.discarded
UPDATE "notification_templates" SET
  "subject" = $tpl$Registration discarded, payment not received: {{paperTitle}}$tpl$,
  "bodyHtml" = $tpl$<!DOCTYPE html>
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
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">If you believe this is a mistake, please contact the conference organisers.</p>
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



<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 16px;">
<tr><td style="background:#18181b;border-radius:6px;">
<a href="{{paperUrl}}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">View the submission</a>
</td></tr>
</table>
<p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#71717a;word-break:break-all;">If the button does not work, paste this address into your browser:<br>{{paperUrl}}</p>

<p style="margin:0;font-size:15px;line-height:1.65;color:#52525b;">Regards,<br>Organising Committee<br>{{conferenceName}}</p>

</td></tr>
</table>
<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This message was sent by {{conferenceName}}.</p>
<p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This is a system generated mail. For any queries contact: {{contactEmail}}</p>
</td></tr>
</table>
</body>
</html>$tpl$,
  "bodyText" = $tpl${{conferenceName}}

Registration discarded

Your registration has been discarded because payment was not received by the deadline.

If you believe this is a mistake, please contact the conference organisers.

Paper: {{paperTitle}}

View the submission: {{paperUrl}}

Regards,
Organising Committee
{{conferenceName}}

This message was sent by {{conferenceName}}.

This is a system generated mail. For any queries contact: {{contactEmail}}$tpl$,
  "variables" = $tpl$["paperTitle","conferenceName","paperUrl","contactEmail"]$tpl$::jsonb,
  "updatedAt" = now()
WHERE "key" = $tpl$registration.discarded$tpl$ AND "organizationId" IS NULL;

INSERT INTO "notification_templates"
  ("id", "organizationId", "key", "version", "locale", "subject", "bodyHtml", "bodyText", "variables", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid(), NULL, $tpl$registration.discarded$tpl$, 2, 'en', $tpl$Registration discarded, payment not received: {{paperTitle}}$tpl$, $tpl$<!DOCTYPE html>
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
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">If you believe this is a mistake, please contact the conference organisers.</p>
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



<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 16px;">
<tr><td style="background:#18181b;border-radius:6px;">
<a href="{{paperUrl}}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">View the submission</a>
</td></tr>
</table>
<p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#71717a;word-break:break-all;">If the button does not work, paste this address into your browser:<br>{{paperUrl}}</p>

<p style="margin:0;font-size:15px;line-height:1.65;color:#52525b;">Regards,<br>Organising Committee<br>{{conferenceName}}</p>

</td></tr>
</table>
<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This message was sent by {{conferenceName}}.</p>
<p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This is a system generated mail. For any queries contact: {{contactEmail}}</p>
</td></tr>
</table>
</body>
</html>$tpl$, $tpl${{conferenceName}}

Registration discarded

Your registration has been discarded because payment was not received by the deadline.

If you believe this is a mistake, please contact the conference organisers.

Paper: {{paperTitle}}

View the submission: {{paperUrl}}

Regards,
Organising Committee
{{conferenceName}}

This message was sent by {{conferenceName}}.

This is a system generated mail. For any queries contact: {{contactEmail}}$tpl$, $tpl$["paperTitle","conferenceName","paperUrl","contactEmail"]$tpl$::jsonb, true, now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM "notification_templates" WHERE "key" = $tpl$registration.discarded$tpl$ AND "organizationId" IS NULL
);

-- Nothing sends this one; the acceptance letter covers it.
UPDATE "notification_templates" SET "isActive" = false, "updatedAt" = now()
WHERE "key" = 'registration.window_open' AND "organizationId" IS NULL;
