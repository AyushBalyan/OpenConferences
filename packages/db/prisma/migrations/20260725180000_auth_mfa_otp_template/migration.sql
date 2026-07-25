-- Platform template: auth.mfa_otp (email OTP for MFA enroll/challenge)
INSERT INTO "notification_templates" (
  "id", "organizationId", "key", "version", "locale", "subject", "bodyHtml", "bodyText", "variables", "isActive", "createdAt", "updatedAt"
)
SELECT
  'a2000001-0000-4000-8000-000000000018',
  NULL,
  'auth.mfa_otp',
  2,
  'en',
  'Your OpenConferences verification code',
  $html$<!DOCTYPE html>
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
<p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#4f46e5;">OpenConferences</p>
<h1 style="margin:12px 0 0;font-size:22px;line-height:1.35;color:#0f172a;font-weight:700;">Your verification code</h1>
</td></tr>
<tr><td style="padding:28px 32px;">
<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">Use this code to finish signing in or enable two-factor authentication on your OpenConferences account.</p><p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">Enter the code in the browser window where you requested it. Do not share this code with anyone.</p>

<div style="font-size:32px;font-weight:700;letter-spacing:8px;text-align:center;margin:8px 0 8px;padding:20px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;color:#0f172a;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;">{{otp}}</div><p style="margin:0 0 16px;font-size:14px;line-height:1.55;color:#64748b;text-align:center;">Expires in {{expiresMinutes}} minutes</p>

<p style="margin:16px 0 0;font-size:13px;line-height:1.55;color:#64748b;">If you did not request this code, you can ignore this email. Someone else may have typed your address by mistake.</p>
</td></tr>
<tr><td style="padding:18px 32px;background:#f8fafc;border-top:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;">Automated message from OpenConferences. Please do not reply to this email.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>$html$,
  $text$Your verification code

Use this code to finish signing in or enable two-factor authentication on your OpenConferences account.

Code: {{otp}}

This code expires in {{expiresMinutes}} minutes.

Do not share this code with anyone.

If you did not request this code, you can ignore this email.

— OpenConferences$text$,
  '["otp", "expiresMinutes"]'::jsonb,
  true,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "notification_templates"
  WHERE "organizationId" IS NULL AND "key" = 'auth.mfa_otp' AND "version" = 2
);
