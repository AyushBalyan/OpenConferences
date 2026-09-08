-- Shared letter layout for platform notification templates.
-- Updates existing version-2 platform rows in place.

UPDATE "notification_templates"
SET
  "subject" = $letter$Your email verification code$letter$,
  "bodyHtml" = $letter$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Verify your email address</title>
</head>
<body style="margin:0;padding:24px;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.6;color:#222222;">

<p style="margin:0 0 16px;"><strong>Verify your email address</strong></p>
<p style="margin:0 0 16px;">Thanks for creating an account.</p>
<p style="margin:0 0 16px;">Enter this code in the browser window where you signed up. Do not share this code with anyone.</p>


<p style="margin:0 0 16px;">Your code: <strong style="font-size:22px;letter-spacing:2px;">{{otp}}</strong></p><p style="margin:0 0 16px;">This code expires in {{expiresMinutes}} minutes.</p>

<p style="margin:0 0 16px;">If you did not create an account, you can safely ignore this email. Someone else may have typed your address by mistake.</p>
<p style="margin:24px 0 0;">Please do not reply to this message.</p>
</body>
</html>$letter$,
  "bodyText" = $letter$Verify your email address

Thanks for creating an account.

Enter this code in the browser window where you signed up. Do not share this code with anyone.

Your code: {{otp}}
This code expires in {{expiresMinutes}} minutes.

If you did not create an account, you can safely ignore this email. Someone else may have typed your address by mistake.

Please do not reply to this message.$letter$,
  "variables" = '["otp","expiresMinutes"]'::jsonb,
  "isActive" = true,
  "updatedAt" = NOW()
WHERE "organizationId" IS NULL AND "key" = 'auth.email_verify' AND "version" = 2;

UPDATE "notification_templates"
SET
  "subject" = $letter$Reset your password$letter$,
  "bodyHtml" = $letter$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Reset your password</title>
</head>
<body style="margin:0;padding:24px;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.6;color:#222222;">

<p style="margin:0 0 16px;"><strong>Reset your password</strong></p>
<p style="margin:0 0 16px;">We received a request to reset the password for your account.</p>
<p style="margin:0 0 16px;">Open the link below to choose a new password. For your security, this link can only be used once.</p>



<p style="margin:0 0 16px;"><a href="{{resetUrl}}">Reset password</a></p><p style="margin:0 0 16px;">If the link does not open, copy this address into your browser:<br>{{resetUrl}}</p>
<p style="margin:0 0 16px;">If you did not request a password reset, you can ignore this email. Your password will not change.</p>
<p style="margin:24px 0 0;">Please do not reply to this message.</p>
</body>
</html>$letter$,
  "bodyText" = $letter$Reset your password

We received a request to reset the password for your account.

Open the link below to choose a new password. For your security, this link can only be used once.

Reset password: {{resetUrl}}

If the link does not open, copy this address into your browser: {{resetUrl}}

If you did not request a password reset, you can ignore this email. Your password will not change.

Please do not reply to this message.$letter$,
  "variables" = '["resetUrl"]'::jsonb,
  "isActive" = true,
  "updatedAt" = NOW()
WHERE "organizationId" IS NULL AND "key" = 'auth.password_reset' AND "version" = 2;

UPDATE "notification_templates"
SET
  "subject" = $letter$Your verification code$letter$,
  "bodyHtml" = $letter$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Your verification code</title>
</head>
<body style="margin:0;padding:24px;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.6;color:#222222;">

<p style="margin:0 0 16px;"><strong>Your verification code</strong></p>
<p style="margin:0 0 16px;">Use this code to finish signing in or enable two-factor authentication on your account.</p>
<p style="margin:0 0 16px;">Enter the code in the browser window where you requested it. Do not share this code with anyone.</p>


<p style="margin:0 0 16px;">Your code: <strong style="font-size:22px;letter-spacing:2px;">{{otp}}</strong></p><p style="margin:0 0 16px;">This code expires in {{expiresMinutes}} minutes.</p>

<p style="margin:0 0 16px;">If you did not request this code, you can ignore this email. Someone else may have typed your address by mistake.</p>
<p style="margin:24px 0 0;">Please do not reply to this message.</p>
</body>
</html>$letter$,
  "bodyText" = $letter$Your verification code

Use this code to finish signing in or enable two-factor authentication on your account.

Enter the code in the browser window where you requested it. Do not share this code with anyone.

Your code: {{otp}}
This code expires in {{expiresMinutes}} minutes.

If you did not request this code, you can ignore this email. Someone else may have typed your address by mistake.

Please do not reply to this message.$letter$,
  "variables" = '["otp","expiresMinutes"]'::jsonb,
  "isActive" = true,
  "updatedAt" = NOW()
WHERE "organizationId" IS NULL AND "key" = 'auth.mfa_otp' AND "version" = 2;

UPDATE "notification_templates"
SET
  "subject" = $letter$Submission received: {{paperTitle}}$letter$,
  "bodyHtml" = $letter$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Submission confirmed</title>
</head>
<body style="margin:0;padding:24px;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.6;color:#222222;">
<p style="margin:0 0 16px;">{{conferenceName}}</p>
<p style="margin:0 0 16px;"><strong>Submission confirmed</strong></p>
<p style="margin:0 0 16px;">Your paper has been submitted to {{conferenceName}}.</p>
<p style="margin:0 0 16px;">You will receive further updates by email as your submission moves through review.</p>
<p style="margin:0 0 16px;">Paper: {{paperTitle}}</p>




<p style="margin:24px 0 0;">This message is from {{conferenceName}}.</p>
</body>
</html>$letter$,
  "bodyText" = $letter${{conferenceName}}

Submission confirmed

Your paper has been submitted to {{conferenceName}}.

You will receive further updates by email as your submission moves through review.

Paper: {{paperTitle}}

This message is from {{conferenceName}}.$letter$,
  "variables" = '["paperTitle","conferenceName"]'::jsonb,
  "isActive" = true,
  "updatedAt" = NOW()
WHERE "organizationId" IS NULL AND "key" = 'submission.confirmed' AND "version" = 2;

UPDATE "notification_templates"
SET
  "subject" = $letter$New submission: {{paperTitle}} ({{conferenceName}})$letter$,
  "bodyHtml" = $letter$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>New paper submission</title>
</head>
<body style="margin:0;padding:24px;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.6;color:#222222;">
<p style="margin:0 0 16px;">{{conferenceName}}</p>
<p style="margin:0 0 16px;"><strong>New paper submission</strong></p>
<p style="margin:0 0 16px;">A new paper has been submitted.</p>
<p style="margin:0 0 16px;">Paper title: {{paperTitle}}<br>Corresponding author: {{authorEmail}}</p>


<p style="margin:0 0 16px;"><a href="{{paperUrl}}">View submission</a></p><p style="margin:0 0 16px;">If the link does not open, copy this address into your browser:<br>{{paperUrl}}</p>
<p style="margin:0 0 16px;">This is an operations alert for every new submission.</p>
<p style="margin:24px 0 0;">This message is from {{conferenceName}}.</p>
</body>
</html>$letter$,
  "bodyText" = $letter${{conferenceName}}

New paper submission

A new paper has been submitted.

Paper title: {{paperTitle}}
Corresponding author: {{authorEmail}}

View submission: {{paperUrl}}

If the link does not open, copy this address into your browser: {{paperUrl}}

This is an operations alert for every new submission.

This message is from {{conferenceName}}.$letter$,
  "variables" = '["paperTitle","conferenceName","authorEmail","paperUrl"]'::jsonb,
  "isActive" = true,
  "updatedAt" = NOW()
WHERE "organizationId" IS NULL AND "key" = 'submission.ops_alert' AND "version" = 2;

UPDATE "notification_templates"
SET
  "subject" = $letter$Reviewer invitation for {{conferenceName}}$letter$,
  "bodyHtml" = $letter$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Reviewer invitation</title>
</head>
<body style="margin:0;padding:24px;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.6;color:#222222;">
<p style="margin:0 0 16px;">{{conferenceName}}</p>
<p style="margin:0 0 16px;"><strong>Reviewer invitation</strong></p>
<p style="margin:0 0 16px;">Dear colleague,</p>
<p style="margin:0 0 16px;">You have been invited to serve as a reviewer for {{conferenceName}}. The program organizers would value your expertise in evaluating submissions for this conference.</p>
<p style="margin:0 0 16px;">Please accept the invitation using the link below. Sign in with the same email address that received this message.</p>
<p style="margin:0 0 16px;">Expires: {{expiresAt}}</p>


<p style="margin:0 0 16px;"><a href="{{signupUrl}}">Accept invitation</a></p><p style="margin:0 0 16px;">If the link does not open, copy this address into your browser:<br>{{signupUrl}}</p>
<p style="margin:0 0 16px;">If you were not expecting this invitation, you may safely ignore this email.</p>
<p style="margin:24px 0 0;">This message is from {{conferenceName}}.</p>
</body>
</html>$letter$,
  "bodyText" = $letter${{conferenceName}}

Reviewer invitation

Dear colleague,

You have been invited to serve as a reviewer for {{conferenceName}}. The program organizers would value your expertise in evaluating submissions for this conference.

Please accept the invitation using the link below. Sign in with the same email address that received this message.

Expires: {{expiresAt}}

Accept invitation: {{signupUrl}}

If the link does not open, copy this address into your browser: {{signupUrl}}

If you were not expecting this invitation, you may safely ignore this email.

This message is from {{conferenceName}}.$letter$,
  "variables" = '["conferenceName","signupUrl","expiresAt"]'::jsonb,
  "isActive" = true,
  "updatedAt" = NOW()
WHERE "organizationId" IS NULL AND "key" = 'reviewer.invitation' AND "version" = 2;

UPDATE "notification_templates"
SET
  "subject" = $letter$New review assignment: {{paperTitle}}$letter$,
  "bodyHtml" = $letter$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>New review assignment</title>
</head>
<body style="margin:0;padding:24px;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.6;color:#222222;">
<p style="margin:0 0 16px;">{{conferenceName}}</p>
<p style="margin:0 0 16px;"><strong>New review assignment</strong></p>
<p style="margin:0 0 16px;">You have been assigned a paper to review.</p>
<p style="margin:0 0 16px;">Please submit your review before the due date below.</p>
<p style="margin:0 0 16px;">Paper: {{paperTitle}}<br>Review round: {{roundNumber}}<br>Due date: {{dueAt}}</p>



<p style="margin:0 0 16px;">If you have a conflict of interest with this submission, please declare it before starting your review.</p>
<p style="margin:24px 0 0;">This message is from {{conferenceName}}.</p>
</body>
</html>$letter$,
  "bodyText" = $letter${{conferenceName}}

New review assignment

You have been assigned a paper to review.

Please submit your review before the due date below.

Paper: {{paperTitle}}
Review round: {{roundNumber}}
Due date: {{dueAt}}

If you have a conflict of interest with this submission, please declare it before starting your review.

This message is from {{conferenceName}}.$letter$,
  "variables" = '["paperTitle","roundNumber","dueAt","conferenceName"]'::jsonb,
  "isActive" = true,
  "updatedAt" = NOW()
WHERE "organizationId" IS NULL AND "key" = 'assignment.notified' AND "version" = 2;

UPDATE "notification_templates"
SET
  "subject" = $letter$Review due soon: {{paperTitle}}$letter$,
  "bodyHtml" = $letter$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Review deadline approaching</title>
</head>
<body style="margin:0;padding:24px;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.6;color:#222222;">
<p style="margin:0 0 16px;">{{conferenceName}}</p>
<p style="margin:0 0 16px;"><strong>Review deadline approaching</strong></p>
<p style="margin:0 0 16px;">This is a reminder that your review for {{conferenceName}} is due soon.</p>
<p style="margin:0 0 16px;">Please submit your review before the due date below.</p>
<p style="margin:0 0 16px;">Paper: {{paperTitle}}<br>Due date: {{dueAt}}</p>



<p style="margin:0 0 16px;">Late reviews may delay editorial decisions for authors.</p>
<p style="margin:24px 0 0;">This message is from {{conferenceName}}.</p>
</body>
</html>$letter$,
  "bodyText" = $letter${{conferenceName}}

Review deadline approaching

This is a reminder that your review for {{conferenceName}} is due soon.

Please submit your review before the due date below.

Paper: {{paperTitle}}
Due date: {{dueAt}}

Late reviews may delay editorial decisions for authors.

This message is from {{conferenceName}}.$letter$,
  "variables" = '["paperTitle","dueAt","conferenceName"]'::jsonb,
  "isActive" = true,
  "updatedAt" = NOW()
WHERE "organizationId" IS NULL AND "key" = 'review.reminder' AND "version" = 2;

UPDATE "notification_templates"
SET
  "subject" = $letter$Editorial decision — {{outcomeLabel}}: {{paperTitle}}$letter$,
  "bodyHtml" = $letter$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Editorial decision: {{outcomeLabel}}</title>
</head>
<body style="margin:0;padding:24px;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.6;color:#222222;">
<p style="margin:0 0 16px;">{{conferenceName}}</p>
<p style="margin:0 0 16px;"><strong>Editorial decision: {{outcomeLabel}}</strong></p>
<p style="margin:0 0 16px;">The program committee has reached an editorial decision on your submission.</p>
<p style="margin:0 0 16px;">Paper: {{paperTitle}}<br>Decision: {{outcomeLabel}}</p>
<p style="margin:0 0 16px;">{{rationaleBlock}}</p>
<p style="margin:0 0 16px;">{{acceptBlock}}</p>



<p style="margin:24px 0 0;">This message is from {{conferenceName}}.</p>
</body>
</html>$letter$,
  "bodyText" = $letter${{conferenceName}}

Editorial decision: {{outcomeLabel}}

The program committee has reached an editorial decision on your submission.

Paper: {{paperTitle}}
Decision: {{outcomeLabel}}

{{rationaleBlock}}

{{acceptBlock}}

This message is from {{conferenceName}}.$letter$,
  "variables" = '["paperTitle","outcomeLabel","rationaleBlock","acceptBlock","conferenceName"]'::jsonb,
  "isActive" = true,
  "updatedAt" = NOW()
WHERE "organizationId" IS NULL AND "key" = 'decision.notified' AND "version" = 2;

UPDATE "notification_templates"
SET
  "subject" = $letter$Reviewer feedback available: {{paperTitle}}$letter$,
  "bodyHtml" = $letter$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Reviewer feedback released</title>
</head>
<body style="margin:0;padding:24px;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.6;color:#222222;">
<p style="margin:0 0 16px;">{{conferenceName}}</p>
<p style="margin:0 0 16px;"><strong>Reviewer feedback released</strong></p>
<p style="margin:0 0 16px;">Review feedback for your submission to {{conferenceName}} is now available.</p>
<p style="margin:0 0 16px;">You may read the released reviews and, if allowed, submit a rebuttal before the deadline.</p>
<p style="margin:0 0 16px;">Paper: {{paperTitle}}</p>




<p style="margin:24px 0 0;">This message is from {{conferenceName}}.</p>
</body>
</html>$letter$,
  "bodyText" = $letter${{conferenceName}}

Reviewer feedback released

Review feedback for your submission to {{conferenceName}} is now available.

You may read the released reviews and, if allowed, submit a rebuttal before the deadline.

Paper: {{paperTitle}}

This message is from {{conferenceName}}.$letter$,
  "variables" = '["paperTitle","conferenceName"]'::jsonb,
  "isActive" = true,
  "updatedAt" = NOW()
WHERE "organizationId" IS NULL AND "key" = 'review.released' AND "version" = 2;

UPDATE "notification_templates"
SET
  "subject" = $letter$Camera-ready due soon: {{paperTitle}}$letter$,
  "bodyHtml" = $letter$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Camera-ready deadline approaching</title>
</head>
<body style="margin:0;padding:24px;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.6;color:#222222;">
<p style="margin:0 0 16px;">{{conferenceName}}</p>
<p style="margin:0 0 16px;"><strong>Camera-ready deadline approaching</strong></p>
<p style="margin:0 0 16px;">Your accepted paper requires a camera-ready PDF before it can be included in the {{conferenceName}} proceedings.</p>
<p style="margin:0 0 16px;">Please upload the final PDF before the deadline below.</p>
<p style="margin:0 0 16px;">Paper: {{paperTitle}}<br>Deadline: {{deadlineAt}}</p>



<p style="margin:0 0 16px;">Missing the camera-ready deadline may affect publication of your paper.</p>
<p style="margin:24px 0 0;">This message is from {{conferenceName}}.</p>
</body>
</html>$letter$,
  "bodyText" = $letter${{conferenceName}}

Camera-ready deadline approaching

Your accepted paper requires a camera-ready PDF before it can be included in the {{conferenceName}} proceedings.

Please upload the final PDF before the deadline below.

Paper: {{paperTitle}}
Deadline: {{deadlineAt}}

Missing the camera-ready deadline may affect publication of your paper.

This message is from {{conferenceName}}.$letter$,
  "variables" = '["paperTitle","deadlineAt","conferenceName"]'::jsonb,
  "isActive" = true,
  "updatedAt" = NOW()
WHERE "organizationId" IS NULL AND "key" = 'cameraready.reminder' AND "version" = 2;

UPDATE "notification_templates"
SET
  "subject" = $letter$Registration now open — {{paperTitle}}$letter$,
  "bodyHtml" = $letter$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Registration is now open</title>
</head>
<body style="margin:0;padding:24px;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.6;color:#222222;">
<p style="margin:0 0 16px;">{{conferenceName}}</p>
<p style="margin:0 0 16px;"><strong>Registration is now open</strong></p>
<p style="margin:0 0 16px;">Congratulations — your paper has been accepted to {{conferenceName}}.</p>
<p style="margin:0 0 16px;">Registration is now open. Please complete registration and payment before the deadline to confirm your participation.</p>
<p style="margin:0 0 16px;">Paper: {{paperTitle}}<br>Registration deadline: {{deadlineAt}}</p>



<p style="margin:0 0 16px;">Papers that remain unpaid after the registration deadline may be withdrawn from the program.</p>
<p style="margin:24px 0 0;">This message is from {{conferenceName}}.</p>
</body>
</html>$letter$,
  "bodyText" = $letter${{conferenceName}}

Registration is now open

Congratulations — your paper has been accepted to {{conferenceName}}.

Registration is now open. Please complete registration and payment before the deadline to confirm your participation.

Paper: {{paperTitle}}
Registration deadline: {{deadlineAt}}

Papers that remain unpaid after the registration deadline may be withdrawn from the program.

This message is from {{conferenceName}}.$letter$,
  "variables" = '["paperTitle","deadlineAt","conferenceName"]'::jsonb,
  "isActive" = true,
  "updatedAt" = NOW()
WHERE "organizationId" IS NULL AND "key" = 'registration.window_open' AND "version" = 2;

UPDATE "notification_templates"
SET
  "subject" = $letter$Early-bird registration ends soon$letter$,
  "bodyHtml" = $letter$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Early-bird registration ending soon</title>
</head>
<body style="margin:0;padding:24px;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.6;color:#222222;">
<p style="margin:0 0 16px;">{{conferenceName}}</p>
<p style="margin:0 0 16px;"><strong>Early-bird registration ending soon</strong></p>
<p style="margin:0 0 16px;">Early-bird registration pricing for your accepted paper will end soon.</p>
<p style="margin:0 0 16px;">Complete your registration before the early-bird deadline to lock in the reduced rate.</p>
<p style="margin:0 0 16px;">Paper: {{paperTitle}}<br>Early-bird ends: {{earlyBirdEndsAt}}</p>



<p style="margin:0 0 16px;">After this date, standard registration fees will apply.</p>
<p style="margin:24px 0 0;">This message is from {{conferenceName}}.</p>
</body>
</html>$letter$,
  "bodyText" = $letter${{conferenceName}}

Early-bird registration ending soon

Early-bird registration pricing for your accepted paper will end soon.

Complete your registration before the early-bird deadline to lock in the reduced rate.

Paper: {{paperTitle}}
Early-bird ends: {{earlyBirdEndsAt}}

After this date, standard registration fees will apply.

This message is from {{conferenceName}}.$letter$,
  "variables" = '["paperTitle","earlyBirdEndsAt","conferenceName"]'::jsonb,
  "isActive" = true,
  "updatedAt" = NOW()
WHERE "organizationId" IS NULL AND "key" = 'registration.early_bird_ending' AND "version" = 2;

UPDATE "notification_templates"
SET
  "subject" = $letter$Registration confirmed — {{paperTitle}}$letter$,
  "bodyHtml" = $letter$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Registration confirmed</title>
</head>
<body style="margin:0;padding:24px;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.6;color:#222222;">
<p style="margin:0 0 16px;">{{conferenceName}}</p>
<p style="margin:0 0 16px;"><strong>Registration confirmed</strong></p>
<p style="margin:0 0 16px;">Thank you — your registration payment has been received and your participation is confirmed.</p>
<p style="margin:0 0 16px;">Paper: {{paperTitle}}<br>Amount paid: {{amountFormatted}}</p>



<p style="margin:0 0 16px;">Keep this email for your records.</p>
<p style="margin:24px 0 0;">This message is from {{conferenceName}}.</p>
</body>
</html>$letter$,
  "bodyText" = $letter${{conferenceName}}

Registration confirmed

Thank you — your registration payment has been received and your participation is confirmed.

Paper: {{paperTitle}}
Amount paid: {{amountFormatted}}

Keep this email for your records.

This message is from {{conferenceName}}.$letter$,
  "variables" = '["paperTitle","amountFormatted","conferenceName"]'::jsonb,
  "isActive" = true,
  "updatedAt" = NOW()
WHERE "organizationId" IS NULL AND "key" = 'registration.confirmed' AND "version" = 2;

UPDATE "notification_templates"
SET
  "subject" = $letter$Student verification approved$letter$,
  "bodyHtml" = $letter$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Student verification approved</title>
</head>
<body style="margin:0;padding:24px;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.6;color:#222222;">
<p style="margin:0 0 16px;">{{conferenceName}}</p>
<p style="margin:0 0 16px;"><strong>Student verification approved</strong></p>
<p style="margin:0 0 16px;">Your student status documentation has been reviewed and approved.</p>
<p style="margin:0 0 16px;">Your registration now reflects the approved student rate. No further action is required.</p>
<p style="margin:0 0 16px;">Paper: {{paperTitle}}</p>




<p style="margin:24px 0 0;">This message is from {{conferenceName}}.</p>
</body>
</html>$letter$,
  "bodyText" = $letter${{conferenceName}}

Student verification approved

Your student status documentation has been reviewed and approved.

Your registration now reflects the approved student rate. No further action is required.

Paper: {{paperTitle}}

This message is from {{conferenceName}}.$letter$,
  "variables" = '["paperTitle","conferenceName"]'::jsonb,
  "isActive" = true,
  "updatedAt" = NOW()
WHERE "organizationId" IS NULL AND "key" = 'registration.verification_approved' AND "version" = 2;

UPDATE "notification_templates"
SET
  "subject" = $letter$Action needed: student verification$letter$,
  "bodyHtml" = $letter$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Student verification — clarification needed</title>
</head>
<body style="margin:0;padding:24px;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.6;color:#222222;">
<p style="margin:0 0 16px;">{{conferenceName}}</p>
<p style="margin:0 0 16px;"><strong>Student verification — clarification needed</strong></p>
<p style="margin:0 0 16px;">We need additional documents to complete your student verification.</p>
<p style="margin:0 0 16px;">Please review the committee note below and upload the requested materials when you sign in.</p>
<p style="margin:0 0 16px;">Paper: {{paperTitle}}<br>Committee note: {{note}}</p>



<p style="margin:0 0 16px;">Your registration may remain on hold until verification is complete.</p>
<p style="margin:24px 0 0;">This message is from {{conferenceName}}.</p>
</body>
</html>$letter$,
  "bodyText" = $letter${{conferenceName}}

Student verification — clarification needed

We need additional documents to complete your student verification.

Please review the committee note below and upload the requested materials when you sign in.

Paper: {{paperTitle}}
Committee note: {{note}}

Your registration may remain on hold until verification is complete.

This message is from {{conferenceName}}.$letter$,
  "variables" = '["paperTitle","note","conferenceName"]'::jsonb,
  "isActive" = true,
  "updatedAt" = NOW()
WHERE "organizationId" IS NULL AND "key" = 'registration.clarification_requested' AND "version" = 2;

UPDATE "notification_templates"
SET
  "subject" = $letter$Additional registration payment required$letter$,
  "bodyHtml" = $letter$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Additional payment required</title>
</head>
<body style="margin:0;padding:24px;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.6;color:#222222;">
<p style="margin:0 0 16px;">{{conferenceName}}</p>
<p style="margin:0 0 16px;"><strong>Additional payment required</strong></p>
<p style="margin:0 0 16px;">Your student verification was not approved at the discounted rate.</p>
<p style="margin:0 0 16px;">An additional registration payment is required to complete your registration.</p>
<p style="margin:0 0 16px;">Paper: {{paperTitle}}<br>Amount due: {{amountFormatted}}</p>




<p style="margin:24px 0 0;">This message is from {{conferenceName}}.</p>
</body>
</html>$letter$,
  "bodyText" = $letter${{conferenceName}}

Additional payment required

Your student verification was not approved at the discounted rate.

An additional registration payment is required to complete your registration.

Paper: {{paperTitle}}
Amount due: {{amountFormatted}}

This message is from {{conferenceName}}.$letter$,
  "variables" = '["paperTitle","amountFormatted","conferenceName"]'::jsonb,
  "isActive" = true,
  "updatedAt" = NOW()
WHERE "organizationId" IS NULL AND "key" = 'registration.additional_payment_required' AND "version" = 2;

UPDATE "notification_templates"
SET
  "subject" = $letter$Registration deadline approaching$letter$,
  "bodyHtml" = $letter$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Registration deadline approaching</title>
</head>
<body style="margin:0;padding:24px;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.6;color:#222222;">
<p style="margin:0 0 16px;">{{conferenceName}}</p>
<p style="margin:0 0 16px;"><strong>Registration deadline approaching</strong></p>
<p style="margin:0 0 16px;">Your accepted paper still requires completed registration and payment.</p>
<p style="margin:0 0 16px;">Please complete registration before the deadline below.</p>
<p style="margin:0 0 16px;">Paper: {{paperTitle}}<br>Registration deadline: {{deadlineAt}}</p>



<p style="margin:0 0 16px;">Papers with unpaid registration after the deadline may be withdrawn for non-payment.</p>
<p style="margin:24px 0 0;">This message is from {{conferenceName}}.</p>
</body>
</html>$letter$,
  "bodyText" = $letter${{conferenceName}}

Registration deadline approaching

Your accepted paper still requires completed registration and payment.

Please complete registration before the deadline below.

Paper: {{paperTitle}}
Registration deadline: {{deadlineAt}}

Papers with unpaid registration after the deadline may be withdrawn for non-payment.

This message is from {{conferenceName}}.$letter$,
  "variables" = '["paperTitle","deadlineAt","conferenceName"]'::jsonb,
  "isActive" = true,
  "updatedAt" = NOW()
WHERE "organizationId" IS NULL AND "key" = 'registration.deadline_reminder' AND "version" = 2;

UPDATE "notification_templates"
SET
  "subject" = $letter$Registration discarded — payment not received$letter$,
  "bodyHtml" = $letter$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Registration discarded</title>
</head>
<body style="margin:0;padding:24px;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.6;color:#222222;">
<p style="margin:0 0 16px;">{{conferenceName}}</p>
<p style="margin:0 0 16px;"><strong>Registration discarded</strong></p>
<p style="margin:0 0 16px;">Your registration has been discarded because payment was not received by the deadline.</p>
<p style="margin:0 0 16px;">If you believe this is a mistake, please contact the conference organizers.</p>
<p style="margin:0 0 16px;">Paper: {{paperTitle}}</p>




<p style="margin:24px 0 0;">This message is from {{conferenceName}}.</p>
</body>
</html>$letter$,
  "bodyText" = $letter${{conferenceName}}

Registration discarded

Your registration has been discarded because payment was not received by the deadline.

If you believe this is a mistake, please contact the conference organizers.

Paper: {{paperTitle}}

This message is from {{conferenceName}}.$letter$,
  "variables" = '["paperTitle","conferenceName"]'::jsonb,
  "isActive" = true,
  "updatedAt" = NOW()
WHERE "organizationId" IS NULL AND "key" = 'registration.discarded' AND "version" = 2;
