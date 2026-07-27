-- Update platform auth.email_verify template to email OTP (no magic link).
UPDATE "notification_templates"
SET
  "subject" = 'Your OpenConferences email verification code',
  "bodyHtml" = $html$<!DOCTYPE html>
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
<p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#4f46e5;">OpenConferences</p>
<h1 style="margin:12px 0 0;font-size:22px;line-height:1.35;color:#0f172a;font-weight:700;">Verify your email address</h1>
</td></tr>
<tr><td style="padding:28px 32px;">
<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">Thanks for creating an OpenConferences account.</p><p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">Enter this code in the browser window where you signed up. Do not share this code with anyone.</p>

<div style="font-size:32px;font-weight:700;letter-spacing:8px;text-align:center;margin:8px 0 8px;padding:20px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;color:#0f172a;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;">{{otp}}</div><p style="margin:0 0 16px;font-size:14px;line-height:1.55;color:#64748b;text-align:center;">Expires in {{expiresMinutes}} minutes</p>

<p style="margin:16px 0 0;font-size:13px;line-height:1.55;color:#64748b;">If you did not create an account, you can safely ignore this email. Someone else may have typed your address by mistake.</p>
</td></tr>
<tr><td style="padding:18px 32px;background:#f8fafc;border-top:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;">Automated message from OpenConferences. Please do not reply to this email.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>$html$,
  "bodyText" = $text$Verify your email address

Thanks for creating an OpenConferences account.

Code: {{otp}}

This code expires in {{expiresMinutes}} minutes.

Enter the code in the browser window where you signed up. Do not share it with anyone.

If you did not create an account, you can ignore this email.

— OpenConferences$text$,
  "variables" = '["otp", "expiresMinutes"]'::jsonb,
  "updatedAt" = NOW()
WHERE "organizationId" IS NULL AND "key" = 'auth.email_verify' AND "version" = 2;
