-- Refresh the platform TPC invitation copy. Campaigns already snapshotted keep their sent text.

UPDATE "outreach_templates"
SET
  "subject" = 'Invitation to join the Technical Program Committee of ICAMCDS-2026',
  "bodyHtml" = $html$<p>Dear {{name}},</p>
<p>I am writing to cordially invite you to serve as a member of the Technical Program Committee (TPC) for the upcoming International Conference on Applied Mathematics, Computing and Data Science (ICAMCDS-2026).</p>
<p>Given your expertise in {{topic}}, including your work on {{paper}}, your insights and academic leadership would be invaluable in ensuring the high quality and rigorous peer-review standards of our conference proceedings. Committee members will be requested to review 2 to 3 papers within {{topic}}.</p>
<p><strong>Registration Discount:</strong> As a token of our appreciation for your time and expertise, TPC members will receive a 25% discount on the conference registration fee.</p>
<p>We would be honored to have you on board for ICAMCDS-2026. Please let us know if you would be willing to accept this invitation by replying to this email.</p>
<p>For additional information about the conference, please visit <a href="https://icamcds.fresi.org/">https://icamcds.fresi.org/</a>. If you have any questions or require further clarification, please do not hesitate to contact me.</p>
<p>With regards,<br/>Organizing Committee<br/>(ICAMCDS-2026)</p>$html$,
  "bodyText" = $text$Dear {{name}},

I am writing to cordially invite you to serve as a member of the Technical Program Committee (TPC) for the upcoming International Conference on Applied Mathematics, Computing and Data Science (ICAMCDS-2026).

Given your expertise in {{topic}}, including your work on {{paper}}, your insights and academic leadership would be invaluable in ensuring the high quality and rigorous peer-review standards of our conference proceedings. Committee members will be requested to review 2 to 3 papers within {{topic}}.

Registration Discount: As a token of our appreciation for your time and expertise, TPC members will receive a 25% discount on the conference registration fee.

We would be honored to have you on board for ICAMCDS-2026. Please let us know if you would be willing to accept this invitation by replying to this email.

For additional information about the conference, please visit https://icamcds.fresi.org/. If you have any questions or require further clarification, please do not hesitate to contact me.

With regards,
Organizing Committee
(ICAMCDS-2026)$text$,
  "updatedAt" = NOW()
WHERE "key" = 'tpc_invitation'
  AND "organizationId" IS NULL
  AND "conferenceId" IS NULL;
