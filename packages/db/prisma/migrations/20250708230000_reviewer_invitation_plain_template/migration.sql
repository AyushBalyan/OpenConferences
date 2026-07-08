-- Reviewer invitation: plain HTML template for better deliverability
UPDATE "notification_templates"
SET
  "subject" = 'Reviewer invitation for {{conferenceName}}',
  "bodyHtml" = $html$<!DOCTYPE html>
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
</html>$html$,
  "bodyText" = $text$Reviewer invitation

Dear colleague,

You have been invited to serve as a reviewer for {{conferenceName}}. The program organizers would value your expertise in evaluating submissions for this conference.

Please accept the invitation using the link below. Sign in with the same email address that received this message. This invitation expires on {{expiresAt}}.

Accept invitation: {{signupUrl}}

If the link above does not work, copy and paste it into your browser.

If you were not expecting this invitation, you may safely ignore this email.

— OpenConferences$text$,
  "updatedAt" = NOW()
WHERE "organizationId" IS NULL AND "key" = 'reviewer.invitation' AND "version" = 2;
