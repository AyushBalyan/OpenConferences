/**
 * Platform default notification templates (organizationId = null).
 * Used by migrations, seed sync, and integration test helpers.
 */

export type PlatformNotificationTemplate = {
  key: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  variables: string[];
};

/** Letterhead for conference mail. Auth templates omit this. */
const CONFERENCE_BRAND = '{{conferenceName}}';

export type LayoutOptions = {
  headline: string;
  paragraphs: string[];
  details?: Array<{ label: string; value: string }>;
  cta?: { label: string; url: string };
  extraParagraphs?: string[];
  steps?: string[];
  otp?: { code: string; expiresLabel: string };
  secondaryNote?: string;
  brand?: string | null;
};

type LetterInput = LayoutOptions & {
  key: string;
  subject: string;
  variables: string[];
};

/** Neutral palette — black, white, grey only. No accent colours. */
const INK = '#18181b';
const BODY = '#52525b';
const MUTED = '#71717a';
const FAINT = '#a1a1aa';
const LINE = '#e4e4e7';
const SURFACE = '#fafafa';
const PAGE = '#f4f4f5';
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO = 'ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace';

function p(inner: string): string {
  return `<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:${BODY};">${inner}</p>`;
}

function detailsBlock(rows: Array<{ label: string; value: string }>): string {
  const cells = rows
    .map(
      (row, index) => `<tr><td style="padding:${index === 0 ? '0' : '12px'} 0 0;">
<p style="margin:0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:${MUTED};">${row.label}</p>
<p style="margin:2px 0 0;font-size:15px;line-height:1.55;color:${INK};">${row.value}</p>
</td></tr>`,
    )
    .join('\n');

  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px;background:${SURFACE};border:1px solid ${LINE};border-radius:8px;">
<tr><td style="padding:18px 20px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
${cells}
</table>
</td></tr>
</table>`;
}

export function buildEmailHtml(options: LayoutOptions): string {
  const brand = options.brand === undefined ? CONFERENCE_BRAND : options.brand;
  const eyebrow = brand
    ? `<tr><td style="padding:22px 28px 0;">
<p style="margin:0;font-size:12px;line-height:1.4;letter-spacing:0.1em;text-transform:uppercase;font-weight:600;color:${MUTED};">${brand}</p>
</td></tr>`
    : '';

  const paragraphsHtml = options.paragraphs.map(p).join('\n');
  const detailsHtml = options.details?.length ? detailsBlock(options.details) : '';
  const extraHtml = (options.extraParagraphs ?? []).map(p).join('\n');
  const stepsHtml = options.steps?.length
    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px;background:${SURFACE};border:1px solid ${LINE};border-radius:8px;">
<tr><td style="padding:18px 20px;">
<p style="margin:0 0 12px;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:${MUTED};">How to accept</p>
${options.steps
  .map(
    (step, index) =>
      `<p style="margin:${index === 0 ? '0' : '10px'} 0 0;font-size:15px;line-height:1.55;color:${INK};"><span style="color:${MUTED};">${index + 1}.</span> ${step}</p>`,
  )
  .join('\n')}
</td></tr>
</table>`
    : '';

  const otpHtml = options.otp
    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 16px;background:${SURFACE};border:1px solid ${LINE};border-radius:8px;">
<tr><td style="padding:20px;text-align:center;">
<p style="margin:0;font-size:32px;line-height:1.2;font-weight:700;letter-spacing:0.28em;color:${INK};font-family:${MONO};">${options.otp.code}</p>
<p style="margin:8px 0 0;font-size:13px;line-height:1.5;color:${MUTED};">${options.otp.expiresLabel}</p>
</td></tr>
</table>`
    : '';

  const ctaHtml = options.cta
    ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 16px;">
<tr><td style="background:${INK};border-radius:6px;">
<a href="${options.cta.url}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">${options.cta.label}</a>
</td></tr>
</table>
<p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:${MUTED};word-break:break-all;">If the button does not work, paste this address into your browser:<br>${options.cta.url}</p>`
    : '';

  const noteHtml = options.secondaryNote
    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:4px 0 0;">
<tr><td style="padding:16px 0 0;border-top:1px solid ${LINE};">
<p style="margin:0;font-size:13px;line-height:1.6;color:${MUTED};">${options.secondaryNote}</p>
</td></tr>
</table>`
    : '';

  const footer = brand
    ? `This message was sent by ${brand}.`
    : 'This is an automated message. Please do not reply.';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${options.headline}</title>
</head>
<body style="margin:0;padding:0;background:${PAGE};font-family:${FONT};">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${PAGE};padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid ${LINE};border-radius:10px;">
${eyebrow}
<tr><td style="padding:14px 28px 26px;">
<h1 style="margin:0 0 18px;font-size:21px;line-height:1.35;font-weight:600;color:${INK};">${options.headline}</h1>
${paragraphsHtml}
${detailsHtml}
${extraHtml}
${stepsHtml}
${otpHtml}
${ctaHtml}
${noteHtml}
</td></tr>
</table>
<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:${FAINT};text-align:center;">${footer}</p>
</td></tr>
</table>
</body>
</html>`;
}

function plainText(parts: LayoutOptions): string {
  const brand = parts.brand === undefined ? CONFERENCE_BRAND : parts.brand;
  const lines: string[] = [];
  if (brand) {
    lines.push(brand, '');
  }
  lines.push(parts.headline, '', ...parts.paragraphs.flatMap((paragraph) => [paragraph, '']));
  if (parts.details?.length) {
    for (const row of parts.details) {
      lines.push(`${row.label}: ${row.value}`);
    }
    lines.push('');
  }
  for (const extra of parts.extraParagraphs ?? []) {
    lines.push(extra, '');
  }
  if (parts.steps?.length) {
    lines.push('How to accept');
    parts.steps.forEach((step, index) => {
      lines.push(`${index + 1}. ${step}`);
    });
    lines.push('');
  }
  if (parts.otp) {
    lines.push(`Your code: ${parts.otp.code}`, parts.otp.expiresLabel, '');
  }
  if (parts.cta) {
    lines.push(`${parts.cta.label}: ${parts.cta.url}`, '');
  }
  if (parts.secondaryNote) {
    lines.push(parts.secondaryNote, '');
  }
  if (brand) {
    lines.push(`This message was sent by ${brand}.`);
  } else {
    lines.push('This is an automated message. Please do not reply.');
  }
  return lines.join('\n').trim();
}

function letter(input: LetterInput): PlatformNotificationTemplate {
  const layout: LayoutOptions = {
    headline: input.headline,
    paragraphs: input.paragraphs,
    details: input.details,
    cta: input.cta,
    extraParagraphs: input.extraParagraphs,
    steps: input.steps,
    otp: input.otp,
    secondaryNote: input.secondaryNote,
    brand: input.brand,
  };
  return {
    key: input.key,
    subject: input.subject,
    bodyHtml: buildEmailHtml(layout),
    bodyText: plainText(layout),
    variables: input.variables,
  };
}

export const PLATFORM_NOTIFICATION_TEMPLATES: PlatformNotificationTemplate[] = [
  letter({
    key: 'auth.email_verify',
    brand: null,
    subject: 'Your email verification code',
    headline: 'Verify your email address',
    paragraphs: [
      'Thanks for creating an account.',
      'Enter this code in the browser window where you signed up. Do not share this code with anyone.',
    ],
    otp: {
      code: '{{otp}}',
      expiresLabel: 'This code expires in {{expiresMinutes}} minutes.',
    },
    secondaryNote:
      'If you did not create an account, you can safely ignore this email. Someone else may have typed your address by mistake.',
    variables: ['otp', 'expiresMinutes'],
  }),
  letter({
    key: 'auth.password_reset',
    brand: null,
    subject: 'Reset your password',
    headline: 'Reset your password',
    paragraphs: [
      'We received a request to reset the password for your account.',
      'Open the link below to choose a new password. For your security, this link can only be used once.',
    ],
    cta: { label: 'Reset password', url: '{{resetUrl}}' },
    secondaryNote:
      'If you did not request a password reset, you can ignore this email. Your password will not change.',
    variables: ['resetUrl'],
  }),
  letter({
    key: 'auth.mfa_otp',
    brand: null,
    subject: 'Your verification code',
    headline: 'Your verification code',
    paragraphs: [
      'Use this code to finish signing in or enable two-factor authentication on your account.',
      'Enter the code in the browser window where you requested it. Do not share this code with anyone.',
    ],
    otp: {
      code: '{{otp}}',
      expiresLabel: 'This code expires in {{expiresMinutes}} minutes.',
    },
    secondaryNote:
      'If you did not request this code, you can ignore this email. Someone else may have typed your address by mistake.',
    variables: ['otp', 'expiresMinutes'],
  }),
  letter({
    key: 'submission.confirmed',
    subject: 'Submission received: {{paperTitle}}',
    headline: 'Submission confirmed',
    paragraphs: [
      'Your paper has been received for {{conferenceName}}.',
      'Please keep this message as a record of the submission.',
    ],
    details: [
      { label: 'Paper', value: '{{paperTitle}}' },
      { label: 'Corresponding author', value: '{{authorName}}' },
      { label: 'Email', value: '{{authorEmail}}' },
      { label: 'Affiliation', value: '{{authorAffiliation}}' },
      { label: 'Authors', value: '{{authorList}}' },
    ],
    secondaryNote:
      'You will receive further updates by email as this submission moves through review.',
    variables: [
      'paperTitle',
      'conferenceName',
      'authorName',
      'authorEmail',
      'authorAffiliation',
      'authorList',
    ],
  }),
  letter({
    key: 'submission.ops_alert',
    subject: 'New submission: {{paperTitle}} ({{conferenceName}})',
    headline: 'New paper submission',
    paragraphs: ['A new paper has been submitted.'],
    details: [
      { label: 'Paper title', value: '{{paperTitle}}' },
      { label: 'Corresponding author', value: '{{authorEmail}}' },
    ],
    cta: { label: 'View submission', url: '{{paperUrl}}' },
    secondaryNote: 'This is an operations alert for every new submission.',
    variables: ['paperTitle', 'conferenceName', 'authorEmail', 'paperUrl'],
  }),
  letter({
    key: 'reviewer.invitation',
    subject: 'Reviewer invitation for {{conferenceName}}',
    headline: 'Reviewer invitation',
    paragraphs: [
      'Dear colleague,',
      'You have been invited to serve as a reviewer for {{conferenceName}}. The program organizers would value your expertise in evaluating submissions for this conference.',
    ],
    steps: [
      'Open the invitation link below.',
      'Sign in with the same email address that received this message. If you are new, you will be asked to choose a name and password.',
      'After you accept, you can bid on papers and declare any conflicts of interest.',
    ],
    details: [{ label: 'Expires', value: '{{expiresAt}}' }],
    cta: { label: 'Accept invitation', url: '{{signupUrl}}' },
    secondaryNote: 'If you were not expecting this invitation, you may safely ignore this email.',
    variables: ['conferenceName', 'signupUrl', 'expiresAt'],
  }),
  letter({
    key: 'assignment.notified',
    subject: 'New review assignment: {{paperTitle}}',
    headline: 'New review assignment',
    paragraphs: [
      'You have been assigned a paper to review.',
      'Please submit your review before the due date below.',
    ],
    details: [
      { label: 'Paper', value: '{{paperTitle}}' },
      { label: 'Review round', value: '{{roundNumber}}' },
      { label: 'Due date', value: '{{dueAt}}' },
    ],
    secondaryNote:
      'If you have a conflict of interest with this submission, please declare it before starting your review.',
    variables: ['paperTitle', 'roundNumber', 'dueAt', 'conferenceName'],
  }),
  letter({
    key: 'review.reminder',
    subject: 'Review due soon: {{paperTitle}}',
    headline: 'Review deadline approaching',
    paragraphs: [
      'This is a reminder that your review for {{conferenceName}} is due soon.',
      'Please submit your review before the due date below.',
    ],
    details: [
      { label: 'Paper', value: '{{paperTitle}}' },
      { label: 'Due date', value: '{{dueAt}}' },
    ],
    secondaryNote: 'Late reviews may delay editorial decisions for authors.',
    variables: ['paperTitle', 'dueAt', 'conferenceName'],
  }),
  letter({
    key: 'decision.notified',
    subject: 'Editorial decision — {{outcomeLabel}}: {{paperTitle}}',
    headline: 'Editorial decision: {{outcomeLabel}}',
    paragraphs: ['The program committee has reached an editorial decision on your submission.'],
    details: [
      { label: 'Paper', value: '{{paperTitle}}' },
      { label: 'Decision', value: '{{outcomeLabel}}' },
    ],
    extraParagraphs: ['{{rationaleBlock}}', '{{acceptBlock}}'],
    variables: ['paperTitle', 'outcomeLabel', 'rationaleBlock', 'acceptBlock', 'conferenceName'],
  }),
  letter({
    key: 'review.released',
    subject: 'Reviewer feedback available: {{paperTitle}}',
    headline: 'Reviewer feedback released',
    paragraphs: [
      'Review feedback for your submission to {{conferenceName}} is now available.',
      'You may read the released reviews and, if allowed, submit a rebuttal before the deadline.',
    ],
    details: [{ label: 'Paper', value: '{{paperTitle}}' }],
    variables: ['paperTitle', 'conferenceName'],
  }),
  letter({
    key: 'cameraready.reminder',
    subject: 'Camera-ready due soon: {{paperTitle}}',
    headline: 'Camera-ready deadline approaching',
    paragraphs: [
      'Your accepted paper requires a camera-ready PDF before it can be included in the {{conferenceName}} proceedings.',
      'Please upload the final PDF before the deadline below.',
    ],
    details: [
      { label: 'Paper', value: '{{paperTitle}}' },
      { label: 'Deadline', value: '{{deadlineAt}}' },
    ],
    secondaryNote: 'Missing the camera-ready deadline may affect publication of your paper.',
    variables: ['paperTitle', 'deadlineAt', 'conferenceName'],
  }),
  letter({
    key: 'registration.window_open',
    subject: 'Registration now open — {{paperTitle}}',
    headline: 'Registration is now open',
    paragraphs: [
      'Congratulations — your paper has been accepted to {{conferenceName}}.',
      'Registration is now open. Please complete registration and payment before the deadline to confirm your participation.',
    ],
    details: [
      { label: 'Paper', value: '{{paperTitle}}' },
      { label: 'Registration deadline', value: '{{deadlineAt}}' },
    ],
    secondaryNote:
      'Papers that remain unpaid after the registration deadline may be withdrawn from the program.',
    variables: ['paperTitle', 'deadlineAt', 'conferenceName'],
  }),
  letter({
    key: 'registration.early_bird_ending',
    subject: 'Early-bird registration ends soon',
    headline: 'Early-bird registration ending soon',
    paragraphs: [
      'Early-bird registration pricing for your accepted paper will end soon.',
      'Complete your registration before the early-bird deadline to lock in the reduced rate.',
    ],
    details: [
      { label: 'Paper', value: '{{paperTitle}}' },
      { label: 'Early-bird ends', value: '{{earlyBirdEndsAt}}' },
    ],
    secondaryNote: 'After this date, standard registration fees will apply.',
    variables: ['paperTitle', 'earlyBirdEndsAt', 'conferenceName'],
  }),
  letter({
    key: 'registration.confirmed',
    subject: 'Registration confirmed — {{paperTitle}}',
    headline: 'Registration confirmed',
    paragraphs: [
      'Thank you — your registration payment has been received and your participation is confirmed.',
    ],
    details: [
      { label: 'Paper', value: '{{paperTitle}}' },
      { label: 'Amount paid', value: '{{amountFormatted}}' },
    ],
    secondaryNote: 'Keep this email for your records.',
    variables: ['paperTitle', 'amountFormatted', 'conferenceName'],
  }),
  letter({
    key: 'registration.verification_approved',
    subject: 'Student verification approved',
    headline: 'Student verification approved',
    paragraphs: [
      'Your student status documentation has been reviewed and approved.',
      'Your registration now reflects the approved student rate. No further action is required.',
    ],
    details: [{ label: 'Paper', value: '{{paperTitle}}' }],
    variables: ['paperTitle', 'conferenceName'],
  }),
  letter({
    key: 'registration.clarification_requested',
    subject: 'Action needed: student verification',
    headline: 'Student verification — clarification needed',
    paragraphs: [
      'We need additional documents to complete your student verification.',
      'Please review the committee note below and upload the requested materials when you sign in.',
    ],
    details: [
      { label: 'Paper', value: '{{paperTitle}}' },
      { label: 'Committee note', value: '{{note}}' },
    ],
    secondaryNote: 'Your registration may remain on hold until verification is complete.',
    variables: ['paperTitle', 'note', 'conferenceName'],
  }),
  letter({
    key: 'registration.additional_payment_required',
    subject: 'Additional registration payment required',
    headline: 'Additional payment required',
    paragraphs: [
      'Your student verification was not approved at the discounted rate.',
      'An additional registration payment is required to complete your registration.',
    ],
    details: [
      { label: 'Paper', value: '{{paperTitle}}' },
      { label: 'Amount due', value: '{{amountFormatted}}' },
    ],
    variables: ['paperTitle', 'amountFormatted', 'conferenceName'],
  }),
  letter({
    key: 'registration.deadline_reminder',
    subject: 'Registration deadline approaching',
    headline: 'Registration deadline approaching',
    paragraphs: [
      'Your accepted paper still requires completed registration and payment.',
      'Please complete registration before the deadline below.',
    ],
    details: [
      { label: 'Paper', value: '{{paperTitle}}' },
      { label: 'Registration deadline', value: '{{deadlineAt}}' },
    ],
    secondaryNote:
      'Papers with unpaid registration after the deadline may be withdrawn for non-payment.',
    variables: ['paperTitle', 'deadlineAt', 'conferenceName'],
  }),
  letter({
    key: 'registration.discarded',
    subject: 'Registration discarded — payment not received',
    headline: 'Registration discarded',
    paragraphs: [
      'Your registration has been discarded because payment was not received by the deadline.',
      'If you believe this is a mistake, please contact the conference organizers.',
    ],
    details: [{ label: 'Paper', value: '{{paperTitle}}' }],
    variables: ['paperTitle', 'conferenceName'],
  }),
];
