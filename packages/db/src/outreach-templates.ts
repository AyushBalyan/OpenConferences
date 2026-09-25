export type PlatformOutreachTemplate = {
  key: string;
  name: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  variables: string[];
};

export const PLATFORM_OUTREACH_TEMPLATES: PlatformOutreachTemplate[] = [
  {
    key: 'tpc_invitation',
    name: 'TPC Invitation',
    subject: 'Invitation to join the Technical Program Committee of ICAMCDS-2026',
    bodyHtml: `<p>Dear {{name}},</p>
<p>I am writing to cordially invite you to serve as a member of the Technical Program Committee (TPC) for the upcoming International Conference on Applied Mathematics, Computing and Data Science (ICAMCDS-2026).</p>
<p>Given your expertise in {{topic}}, including your work on {{paper}}, your insights and academic leadership would be invaluable in ensuring the high quality and rigorous peer-review standards of our conference proceedings. Committee members will be requested to review 2 to 3 papers within {{topic}}.</p>
<p><strong>Registration Discount:</strong> As a token of our appreciation for your time and expertise, TPC members will receive a 25% discount on the conference registration fee.</p>
<p>We would be honored to have you on board for ICAMCDS-2026. Please let us know if you would be willing to accept this invitation by replying to this email.</p>
<p>For additional information about the conference, please visit <a href="https://icamcds.fresi.org/">https://icamcds.fresi.org/</a>. If you have any questions or require further clarification, please do not hesitate to contact me.</p>
<p>With regards,<br/>Organizing Committee<br/>(ICAMCDS-2026)</p>`,
    bodyText:
      'Dear {{name}},\n\nI am writing to cordially invite you to serve as a member of the Technical Program Committee (TPC) for the upcoming International Conference on Applied Mathematics, Computing and Data Science (ICAMCDS-2026).\n\nGiven your expertise in {{topic}}, including your work on {{paper}}, your insights and academic leadership would be invaluable in ensuring the high quality and rigorous peer-review standards of our conference proceedings. Committee members will be requested to review 2 to 3 papers within {{topic}}.\n\nRegistration Discount: As a token of our appreciation for your time and expertise, TPC members will receive a 25% discount on the conference registration fee.\n\nWe would be honored to have you on board for ICAMCDS-2026. Please let us know if you would be willing to accept this invitation by replying to this email.\n\nFor additional information about the conference, please visit https://icamcds.fresi.org/. If you have any questions or require further clarification, please do not hesitate to contact me.\n\nWith regards,\nOrganizing Committee\n(ICAMCDS-2026)',
    variables: ['name', 'topic', 'paper'],
  },
  {
    key: 'paper_submission_invitation',
    name: 'Paper Submission Invitation',
    subject: 'Invitation to submit a paper',
    bodyHtml: `<p>Dear {{name}},</p>
<p>We invite you to submit a paper to our conference.</p>
<p>Given your work in {{topic}}, including {{paper}}, we believe the community would benefit from your contribution.</p>
<p>Kind regards,<br/>The Organizing Committee</p>`,
    bodyText:
      'Dear {{name}},\n\nWe invite you to submit a paper to our conference.\n\nGiven your work in {{topic}}, including {{paper}}, we believe the community would benefit from your contribution.\n\nKind regards,\nThe Organizing Committee',
    variables: ['name', 'topic', 'paper'],
  },
  {
    key: 'general_conference_outreach',
    name: 'General Conference Outreach',
    subject: 'Invitation to participate in our conference',
    bodyHtml: `<p>Dear {{name}},</p>
<p>We are writing to invite you to participate in our conference.</p>
<p>Your expertise in {{topic}}, as reflected in {{paper}}, would make you a valued participant.</p>
<p>Kind regards,<br/>The Organizing Committee</p>`,
    bodyText:
      'Dear {{name}},\n\nWe are writing to invite you to participate in our conference.\n\nYour expertise in {{topic}}, as reflected in {{paper}}, would make you a valued participant.\n\nKind regards,\nThe Organizing Committee',
    variables: ['name', 'topic', 'paper'],
  },
];
