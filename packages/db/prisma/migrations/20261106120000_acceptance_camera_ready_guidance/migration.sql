-- Add camera-ready guidance to platform acceptance mail; preserve organizer overrides.
UPDATE notification_templates SET
 "bodyHtml"=CASE WHEN position($guidance$Please ensure that your camera-ready manuscript follows the conference manuscript format and incorporates the reviewers’ suggestions, if any.$guidance$ in "bodyHtml")=0 THEN replace("bodyHtml",$guidance$<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">For registration and further details, kindly log in to your account using the link provided below:</p>$guidance$,$guidance$<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">Please ensure that your camera-ready manuscript follows the conference manuscript format and incorporates the reviewers’ suggestions, if any.</p>
<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#52525b;">For registration and further details, kindly log in to your account using the link provided below:</p>$guidance$) ELSE "bodyHtml" END,
 "bodyText"=CASE WHEN position($guidance$Please ensure that your camera-ready manuscript follows the conference manuscript format and incorporates the reviewers’ suggestions, if any.$guidance$ in "bodyText")=0 THEN replace("bodyText",$guidance$For registration and further details,$guidance$,$guidance$Please ensure that your camera-ready manuscript follows the conference manuscript format and incorporates the reviewers’ suggestions, if any.

For registration and further details,$guidance$) ELSE "bodyText" END,
 "updatedAt"=now()
WHERE key='decision.accepted' AND "organizationId" IS NULL;
