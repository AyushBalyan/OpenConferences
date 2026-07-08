-- Deliverability test template: CopCultural-style OTP verification (no links, minimal HTML).
INSERT INTO "notification_templates" (
  "id",
  "organizationId",
  "key",
  "version",
  "locale",
  "subject",
  "bodyHtml",
  "bodyText",
  "variables",
  "isActive",
  "createdAt",
  "updatedAt"
)
SELECT
  'a3000001-0000-4000-8000-000000000001',
  NULL,
  'test.otp_verify',
  2,
  'en',
  'Verify your email — OpenConferences',
  '<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111;">
<div style="font-weight:700;letter-spacing:2px;text-transform:uppercase;font-size:18px;margin-bottom:24px;">OpenConferences</div>
<p style="font-size:14px;">Hi {{name}},</p>
<p style="font-size:14px;">Use the code below to verify your email address. It expires in 10 minutes.</p>
<div style="font-size:32px;font-weight:700;letter-spacing:8px;text-align:center;margin:24px 0;padding:16px;border:1px solid #111;">{{code}}</div>
<p style="margin-top:32px;font-size:12px;color:#888;">If you didn''t request this, you can safely ignore this email.</p>
</div>',
  'Hi {{name}},

Use the code below to verify your email address. It expires in 10 minutes.

{{code}}

If you didn''t request this, you can safely ignore this email.

— OpenConferences',
  '["name","code"]'::jsonb,
  true,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "notification_templates"
  WHERE "organizationId" IS NULL AND "key" = 'test.otp_verify' AND "version" = 2
);
