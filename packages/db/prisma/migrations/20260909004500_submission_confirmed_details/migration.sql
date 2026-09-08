-- Richer submission.confirmed letter with author and paper details.
-- Updates the existing version-2 platform row in place.

UPDATE "notification_templates"
SET
  "subject" = $details$Submission received: {{paperTitle}}$details$,
  "bodyHtml" = $details$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Submission confirmed</title>
</head>
<body style="margin:0;padding:24px;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.6;color:#222222;">
<p style="margin:0 0 16px;">{{conferenceName}}</p>
<p style="margin:0 0 16px;"><strong>Submission confirmed</strong></p>
<p style="margin:0 0 16px;">Your paper has been received for {{conferenceName}}.</p>
<p style="margin:0 0 16px;">Please keep this message as a record of the submission.</p>

<div style="margin:20px 0;padding:16px 18px;border:1px solid #cccccc;">
<p style="margin:0 0 12px;"><strong>Submission details</strong></p>
<p style="margin:0 0 8px;"><strong>Paper</strong><br>{{paperTitle}}</p>
<p style="margin:0 0 8px;"><strong>Track</strong><br>{{trackName}}</p>
<p style="margin:0 0 8px;"><strong>Corresponding author</strong><br>{{authorName}}<br>{{authorEmail}}<br>{{authorAffiliation}}</p>
<p style="margin:0 0 8px;"><strong>Authors</strong><br>{{authorList}}</p>
<p style="margin:0 0 8px;"><strong>Keywords</strong><br>{{keywords}}</p>
<p style="margin:0 0 8px;"><strong>Abstract</strong></p>
<p style="margin:0;">{{abstract}}</p>
</div>


<p style="margin:0 0 16px;">You will receive further updates by email as this submission moves through review.</p>
<p style="margin:24px 0 0;">This message is from {{conferenceName}}.</p>
</body>
</html>$details$,
  "bodyText" = $details${{conferenceName}}

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

This message is from {{conferenceName}}.$details$,
  "variables" = '["paperTitle","conferenceName","trackName","authorName","authorEmail","authorAffiliation","authorList","keywords","abstract"]'::jsonb,
  "isActive" = true,
  "updatedAt" = NOW()
WHERE "organizationId" IS NULL AND "key" = 'submission.confirmed' AND "version" = 2;
