-- Update only the platform payment receipt; organizer-customized templates are preserved.
UPDATE notification_templates SET
  subject = $receipt$Payment received — {{paperTitle}}$receipt$,
  "bodyHtml" = $receipt$<!DOCTYPE html>
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
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:4px 0 0;">
<tr><td style="padding:16px 0 0;border-top:1px solid #e4e4e7;">
<p style="margin:0;font-size:13px;line-height:1.6;color:#71717a;">Keep this email for your records.</p>
</td></tr>
</table>
</td></tr>
</table>
<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This message was sent by {{conferenceName}}.</p>
<p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;text-align:center;">This is a system generated mail. For any queries contact: icamcds2026@fresi.org</p>
</td></tr>
</table>
</body>
</html>$receipt$,
  "bodyText" = $receipt${{conferenceName}}

Payment received

Thank you — your registration payment has been received for the paper below.

Student registrations remain subject to document verification where applicable.

Paper: {{paperTitle}}
Amount paid: {{amountFormatted}}
Transaction ID: {{transactionId}}

View registration and invoice: {{registrationUrl}}

Keep this email for your records.

This message was sent by {{conferenceName}}.

This is a system generated mail. For any queries contact: icamcds2026@fresi.org$receipt$,
  variables = $receipt$["paperTitle","amountFormatted","transactionId","registrationUrl","conferenceName"]$receipt$::jsonb,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "organizationId" IS NULL AND key = 'registration.confirmed' AND "isActive" = true;

-- Existing installations: allow atomic receipt/job inserts under the API role.
-- Fresh installations receive these grants from the queue bootstrap script.
DO $$
BEGIN
  IF to_regclass('pgboss.job') IS NOT NULL THEN
    GRANT SELECT, INSERT ON TABLE pgboss.job TO openconferences_api;
  END IF;
  IF to_regclass('pgboss.queue') IS NOT NULL THEN
    GRANT SELECT ON TABLE pgboss.queue TO openconferences_api;
  END IF;
END $$;
