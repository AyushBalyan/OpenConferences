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

const BRAND = 'OpenConferences';
const BRAND_COLOR = '#4f46e5';

function detailRow(label: string, value: string): string {
  return `<tr><td style="padding:8px 12px 8px 0;font-size:14px;color:#64748b;width:130px;vertical-align:top;">${label}</td><td style="padding:8px 0;font-size:14px;color:#0f172a;font-weight:500;">${value}</td></tr>`;
}

function detailsTable(rows: Array<{ label: string; value: string }>): string {
  if (rows.length === 0) return '';
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;"><tr><td style="padding:12px 16px;">${rows.map((r) => detailRow(r.label, r.value)).join('')}</td></tr></table>`;
}

type LayoutOptions = {
  preheader: string;
  headline: string;
  paragraphs: string[];
  details?: Array<{ label: string; value: string }>;
  cta?: { label: string; url: string };
  extraHtml?: string;
  secondaryNote?: string;
};

export function buildEmailHtml(options: LayoutOptions): string {
  const paragraphsHtml = options.paragraphs
    .map((p) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">${p}</p>`)
    .join('');

  const ctaHtml = options.cta
    ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px 0 8px;"><tr><td style="border-radius:8px;background:${BRAND_COLOR};"><a href="${options.cta.url}" style="display:inline-block;padding:13px 28px;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">${options.cta.label}</a></td></tr></table>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>${options.headline}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${options.preheader}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
<tr><td style="padding:28px 32px 20px;border-bottom:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:${BRAND_COLOR};">${BRAND}</p>
<h1 style="margin:12px 0 0;font-size:22px;line-height:1.35;color:#0f172a;font-weight:700;">${options.headline}</h1>
</td></tr>
<tr><td style="padding:28px 32px;">
${paragraphsHtml}
${options.details ? detailsTable(options.details) : ''}
${options.extraHtml ?? ''}
${ctaHtml}
${options.secondaryNote ? `<p style="margin:16px 0 0;font-size:13px;line-height:1.55;color:#64748b;">${options.secondaryNote}</p>` : ''}
</td></tr>
<tr><td style="padding:18px 32px;background:#f8fafc;border-top:1px solid #f1f5f9;">
<p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;">Automated message from ${BRAND}. Please do not reply to this email.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function plainText(parts: {
  headline: string;
  paragraphs: string[];
  details?: Array<{ label: string; value: string }>;
  cta?: { label: string; url: string };
  extra?: string;
  secondaryNote?: string;
}): string {
  const lines = [parts.headline, '', ...parts.paragraphs.flatMap((p) => [p, ''])];
  if (parts.details?.length) {
    for (const row of parts.details) {
      lines.push(`${row.label}: ${row.value.replace(/\{\{|\}\}/g, '')}`);
    }
    lines.push('');
  }
  if (parts.extra) {
    lines.push(parts.extra, '');
  }
  if (parts.cta) {
    lines.push(`${parts.cta.label}: ${parts.cta.url}`, '');
  }
  if (parts.secondaryNote) {
    lines.push(parts.secondaryNote, '');
  }
  lines.push(`— ${BRAND}`);
  return lines.join('\n').trim();
}

/** Minimal HTML for cold outbound mail (reviewer invitations) — avoids heavy layout/spam signals. */
function buildPlainInvitationEmail(options: {
  title: string;
  paragraphs: string[];
  cta: { label: string; url: string };
  closingNote: string;
}): string {
  const paragraphsHtml = options.paragraphs
    .map((p) => `<p style="margin:0 0 16px;">${p}</p>`)
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${options.title}</title>
</head>
<body style="margin:0;padding:24px;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.6;color:#222222;">
${paragraphsHtml}
<p style="margin:24px 0;">
<a href="${options.cta.url}" style="display:inline-block;padding:12px 24px;background-color:#1a56db;color:#ffffff;text-decoration:none;border-radius:4px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:600;">${options.cta.label}</a>
</p>
<p style="margin:0 0 8px;font-size:14px;color:#555555;">If the button above does not work, copy and paste this link into your browser:</p>
<p style="margin:0 0 24px;font-size:14px;word-break:break-all;"><a href="${options.cta.url}" style="color:#1a56db;">${options.cta.url}</a></p>
<p style="margin:0;font-size:14px;color:#555555;">${options.closingNote}</p>
</body>
</html>`;
}

function plainInvitationText(options: {
  headline: string;
  paragraphs: string[];
  cta: { label: string; url: string };
  closingNote: string;
}): string {
  const lines = [
    options.headline,
    '',
    ...options.paragraphs.flatMap((p) => [p.replace(/<\/?strong>/g, ''), '']),
    `${options.cta.label}: ${options.cta.url}`,
    '',
    'If the link above does not work, copy and paste it into your browser.',
    '',
    options.closingNote,
    '',
    `— ${BRAND}`,
  ];
  return lines.join('\n').trim();
}

export const PLATFORM_NOTIFICATION_TEMPLATES: PlatformNotificationTemplate[] = [
  {
    key: 'auth.email_verify',
    subject: 'Verify your email for OpenConferences',
    bodyHtml: buildEmailHtml({
      preheader: 'Confirm your email to access submissions, reviews, and registrations.',
      headline: 'Verify your email address',
      paragraphs: [
        'Thanks for creating an OpenConferences account.',
        'Please confirm your email address to sign in, submit papers, accept reviewer invitations, and manage conference registrations.',
      ],
      cta: { label: 'Verify email address', url: '{{verifyUrl}}' },
      secondaryNote:
        'If you did not create an account, you can safely ignore this email. This link may expire after a short period.',
    }),
    bodyText: plainText({
      headline: 'Verify your email address',
      paragraphs: [
        'Thanks for creating an OpenConferences account.',
        'Please confirm your email address to sign in and use the platform.',
      ],
      cta: { label: 'Verify email address', url: '{{verifyUrl}}' },
      secondaryNote: 'If you did not create an account, you can ignore this email.',
    }),
    variables: ['verifyUrl'],
  },
  {
    key: 'auth.password_reset',
    subject: 'Reset your OpenConferences password',
    bodyHtml: buildEmailHtml({
      preheader: 'Use this link to choose a new password for your account.',
      headline: 'Reset your password',
      paragraphs: [
        'We received a request to reset the password for your OpenConferences account.',
        'Click the button below to choose a new password. For your security, this link can only be used once.',
      ],
      cta: { label: 'Reset password', url: '{{resetUrl}}' },
      secondaryNote:
        'If you did not request a password reset, you can ignore this email. Your password will not change.',
    }),
    bodyText: plainText({
      headline: 'Reset your password',
      paragraphs: [
        'We received a request to reset your OpenConferences password.',
        'Use the link below to choose a new password.',
      ],
      cta: { label: 'Reset password', url: '{{resetUrl}}' },
      secondaryNote: 'If you did not request this, ignore this email.',
    }),
    variables: ['resetUrl'],
  },
  {
    key: 'auth.mfa_otp',
    subject: 'Your OpenConferences verification code',
    bodyHtml: buildEmailHtml({
      preheader: 'Your verification code expires shortly.',
      headline: 'Your verification code',
      paragraphs: [
        'Use this code to finish signing in or enable two-factor authentication on your OpenConferences account.',
        'Enter the code in the browser window where you requested it. Do not share this code with anyone.',
      ],
      extraHtml:
        '<div style="font-size:32px;font-weight:700;letter-spacing:8px;text-align:center;margin:8px 0 8px;padding:20px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;color:#0f172a;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;">{{otp}}</div><p style="margin:0 0 16px;font-size:14px;line-height:1.55;color:#64748b;text-align:center;">Expires in {{expiresMinutes}} minutes</p>',
      secondaryNote:
        'If you did not request this code, you can ignore this email. Someone else may have typed your address by mistake.',
    }),
    bodyText: plainText({
      headline: 'Your verification code',
      paragraphs: [
        'Use this code to finish signing in or enable two-factor authentication on your OpenConferences account.',
        'Code: {{otp}}',
        'This code expires in {{expiresMinutes}} minutes.',
        'Do not share this code with anyone.',
      ],
      secondaryNote: 'If you did not request this code, you can ignore this email.',
    }),
    variables: ['otp', 'expiresMinutes'],
  },
  {
    key: 'submission.confirmed',
    subject: 'Submission received: {{paperTitle}}',
    bodyHtml: buildEmailHtml({
      preheader: 'Your paper has been successfully submitted.',
      headline: 'Submission confirmed',
      paragraphs: [
        'Your paper has been successfully submitted to the conference.',
        'You can return to OpenConferences at any time to view submission details, upload revisions, and track review progress.',
      ],
      details: [{ label: 'Paper title', value: '{{paperTitle}}' }],
      secondaryNote:
        'You will receive further updates by email as your submission moves through review and decision stages.',
    }),
    bodyText: plainText({
      headline: 'Submission confirmed',
      paragraphs: ['Your paper has been successfully submitted to the conference.'],
      details: [{ label: 'Paper title', value: '{{paperTitle}}' }],
    }),
    variables: ['paperTitle'],
  },
  {
    key: 'reviewer.invitation',
    subject: 'Reviewer invitation for {{conferenceName}}',
    bodyHtml: buildPlainInvitationEmail({
      title: 'Reviewer invitation',
      paragraphs: [
        'Dear colleague,',
        'You have been invited to serve as a reviewer for <strong>{{conferenceName}}</strong>. The program organizers would value your expertise in evaluating submissions for this conference.',
        'Please accept the invitation using the button below. Sign in with the same email address that received this message. This invitation expires on {{expiresAt}}.',
      ],
      cta: { label: 'Accept invitation', url: '{{signupUrl}}' },
      closingNote: 'If you were not expecting this invitation, you may safely ignore this email.',
    }),
    bodyText: plainInvitationText({
      headline: 'Reviewer invitation',
      paragraphs: [
        'Dear colleague,',
        'You have been invited to serve as a reviewer for {{conferenceName}}. The program organizers would value your expertise in evaluating submissions for this conference.',
        'Please accept the invitation using the link below. Sign in with the same email address that received this message. This invitation expires on {{expiresAt}}.',
      ],
      cta: { label: 'Accept invitation', url: '{{signupUrl}}' },
      closingNote: 'If you were not expecting this invitation, you may safely ignore this email.',
    }),
    variables: ['conferenceName', 'signupUrl', 'expiresAt'],
  },
  {
    key: 'assignment.notified',
    subject: 'New review assignment: {{paperTitle}}',
    bodyHtml: buildEmailHtml({
      preheader: 'A paper has been assigned to you for review.',
      headline: 'New review assignment',
      paragraphs: [
        'You have been assigned a paper to review. Please sign in to OpenConferences to read the submission, declare any conflicts of interest, and submit your review before the due date.',
      ],
      details: [
        { label: 'Paper', value: '{{paperTitle}}' },
        { label: 'Review round', value: '{{roundNumber}}' },
        { label: 'Due date', value: '{{dueAt}}' },
      ],
      secondaryNote:
        'If you have a conflict of interest with this submission, declare it in the platform before starting your review.',
    }),
    bodyText: plainText({
      headline: 'New review assignment',
      paragraphs: [
        'You have been assigned a paper to review. Please sign in to OpenConferences to complete your review.',
      ],
      details: [
        { label: 'Paper', value: '{{paperTitle}}' },
        { label: 'Review round', value: '{{roundNumber}}' },
        { label: 'Due date', value: '{{dueAt}}' },
      ],
    }),
    variables: ['paperTitle', 'roundNumber', 'dueAt'],
  },
  {
    key: 'review.reminder',
    subject: 'Review due soon: {{paperTitle}}',
    bodyHtml: buildEmailHtml({
      preheader: 'Friendly reminder to submit your assigned review.',
      headline: 'Review deadline approaching',
      paragraphs: [
        'This is a reminder that your review for the paper below is due soon.',
        'Please sign in to OpenConferences to submit your review or update your draft before the deadline.',
      ],
      details: [
        { label: 'Paper', value: '{{paperTitle}}' },
        { label: 'Due date', value: '{{dueAt}}' },
      ],
      secondaryNote: 'Late reviews may delay editorial decisions for authors.',
    }),
    bodyText: plainText({
      headline: 'Review deadline approaching',
      paragraphs: ['Please submit your review before the due date.'],
      details: [
        { label: 'Paper', value: '{{paperTitle}}' },
        { label: 'Due date', value: '{{dueAt}}' },
      ],
    }),
    variables: ['paperTitle', 'dueAt'],
  },
  {
    key: 'decision.notified',
    subject: 'Editorial decision — {{outcomeLabel}}: {{paperTitle}}',
    bodyHtml: buildEmailHtml({
      preheader: 'The editorial decision for your submission is now available.',
      headline: 'Editorial decision: {{outcomeLabel}}',
      paragraphs: [
        'The program committee has reached an editorial decision regarding your submission.',
      ],
      details: [
        { label: 'Paper', value: '{{paperTitle}}' },
        { label: 'Decision', value: '{{outcomeLabel}}' },
      ],
      extraHtml:
        '<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#334155;">{{rationaleBlock}}</p><p style="margin:0;font-size:15px;line-height:1.6;color:#334155;">{{acceptBlock}}</p>',
      secondaryNote:
        'Sign in to OpenConferences to view full details, reviewer feedback (when released), and next steps for your submission.',
    }),
    bodyText: plainText({
      headline: 'Editorial decision: {{outcomeLabel}}',
      paragraphs: ['The program committee has reached a decision on your submission.'],
      details: [
        { label: 'Paper', value: '{{paperTitle}}' },
        { label: 'Decision', value: '{{outcomeLabel}}' },
      ],
      extra: '{{rationaleBlock}}\n\n{{acceptBlock}}',
    }),
    variables: ['paperTitle', 'outcomeLabel', 'rationaleBlock', 'acceptBlock'],
  },
  {
    key: 'review.released',
    subject: 'Reviewer feedback available: {{paperTitle}}',
    bodyHtml: buildEmailHtml({
      preheader: 'Review feedback for your paper is now visible in your dashboard.',
      headline: 'Reviewer feedback released',
      paragraphs: [
        'Review feedback for your submission is now available in OpenConferences.',
        'You may read the released reviews and, if the conference allows it, submit a rebuttal before the rebuttal deadline.',
      ],
      details: [{ label: 'Paper', value: '{{paperTitle}}' }],
      secondaryNote: 'Sign in to your author dashboard to read reviews and respond.',
    }),
    bodyText: plainText({
      headline: 'Reviewer feedback released',
      paragraphs: [
        'Review feedback for your paper is now available.',
        'Sign in to OpenConferences to read reviews and submit a rebuttal if applicable.',
      ],
      details: [{ label: 'Paper', value: '{{paperTitle}}' }],
    }),
    variables: ['paperTitle'],
  },
  {
    key: 'cameraready.reminder',
    subject: 'Camera-ready due soon: {{paperTitle}}',
    bodyHtml: buildEmailHtml({
      preheader: 'Upload your final camera-ready version before the deadline.',
      headline: 'Camera-ready deadline approaching',
      paragraphs: [
        'Your accepted paper requires a camera-ready version before it can be included in the conference proceedings.',
        'Please upload the final PDF through OpenConferences before the deadline below.',
      ],
      details: [
        { label: 'Paper', value: '{{paperTitle}}' },
        { label: 'Deadline', value: '{{deadlineAt}}' },
      ],
      secondaryNote: 'Missing the camera-ready deadline may affect publication of your paper.',
    }),
    bodyText: plainText({
      headline: 'Camera-ready deadline approaching',
      paragraphs: ['Please upload your camera-ready version before the deadline.'],
      details: [
        { label: 'Paper', value: '{{paperTitle}}' },
        { label: 'Deadline', value: '{{deadlineAt}}' },
      ],
    }),
    variables: ['paperTitle', 'deadlineAt'],
  },
  {
    key: 'registration.window_open',
    subject: 'Registration now open — {{paperTitle}}',
    bodyHtml: buildEmailHtml({
      preheader: 'Complete conference registration for your accepted paper.',
      headline: 'Registration is now open',
      paragraphs: [
        'Congratulations — your paper has been accepted.',
        'Conference registration is now open. Please complete registration and payment before the deadline to confirm your participation.',
      ],
      details: [
        { label: 'Paper', value: '{{paperTitle}}' },
        { label: 'Registration deadline', value: '{{deadlineAt}}' },
      ],
      secondaryNote:
        'Important: failure to register and pay by the deadline may result in withdrawal of your paper from the program.',
    }),
    bodyText: plainText({
      headline: 'Registration is now open',
      paragraphs: [
        'Your paper has been accepted. Please complete registration before the deadline.',
      ],
      details: [
        { label: 'Paper', value: '{{paperTitle}}' },
        { label: 'Registration deadline', value: '{{deadlineAt}}' },
      ],
      secondaryNote: 'Non-payment by the deadline may withdraw your paper.',
    }),
    variables: ['paperTitle', 'deadlineAt'],
  },
  {
    key: 'registration.early_bird_ending',
    subject: 'Early-bird registration ends soon',
    bodyHtml: buildEmailHtml({
      preheader: 'Save on registration fees before the early-bird period ends.',
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
    }),
    bodyText: plainText({
      headline: 'Early-bird registration ending soon',
      paragraphs: ['Complete registration before early-bird pricing ends.'],
      details: [
        { label: 'Paper', value: '{{paperTitle}}' },
        { label: 'Early-bird ends', value: '{{earlyBirdEndsAt}}' },
      ],
    }),
    variables: ['paperTitle', 'earlyBirdEndsAt'],
  },
  {
    key: 'registration.confirmed',
    subject: 'Registration confirmed — {{paperTitle}}',
    bodyHtml: buildEmailHtml({
      preheader: 'Your conference registration payment was received.',
      headline: 'Registration confirmed',
      paragraphs: [
        'Thank you — your registration payment has been received and your participation is confirmed.',
        'You can download your invoice and view registration details in OpenConferences.',
      ],
      details: [
        { label: 'Paper', value: '{{paperTitle}}' },
        { label: 'Amount paid', value: '{{amountFormatted}}' },
      ],
      secondaryNote: 'Keep this email for your records.',
    }),
    bodyText: plainText({
      headline: 'Registration confirmed',
      paragraphs: ['Your registration payment has been received.'],
      details: [
        { label: 'Paper', value: '{{paperTitle}}' },
        { label: 'Amount paid', value: '{{amountFormatted}}' },
      ],
    }),
    variables: ['paperTitle', 'amountFormatted'],
  },
  {
    key: 'registration.verification_approved',
    subject: 'Student verification approved',
    bodyHtml: buildEmailHtml({
      preheader: 'Your student registration verification was approved.',
      headline: 'Student verification approved',
      paragraphs: [
        'Your student status documentation has been reviewed and approved.',
        'Your registration now reflects the approved student rate. No further action is required unless prompted in your dashboard.',
      ],
      details: [{ label: 'Paper', value: '{{paperTitle}}' }],
    }),
    bodyText: plainText({
      headline: 'Student verification approved',
      paragraphs: ['Your student verification has been approved.'],
      details: [{ label: 'Paper', value: '{{paperTitle}}' }],
    }),
    variables: ['paperTitle'],
  },
  {
    key: 'registration.clarification_requested',
    subject: 'Action needed: student verification',
    bodyHtml: buildEmailHtml({
      preheader: 'Additional information is needed for your student verification.',
      headline: 'Student verification — clarification needed',
      paragraphs: [
        'We need additional information to complete your student verification.',
        'Please review the note below and upload the requested documentation in OpenConferences.',
      ],
      details: [
        { label: 'Paper', value: '{{paperTitle}}' },
        { label: 'Committee note', value: '{{note}}' },
      ],
      secondaryNote: 'Your registration may remain on hold until verification is complete.',
    }),
    bodyText: plainText({
      headline: 'Student verification — clarification needed',
      paragraphs: ['Additional information is needed for your student verification.'],
      details: [
        { label: 'Paper', value: '{{paperTitle}}' },
        { label: 'Committee note', value: '{{note}}' },
      ],
    }),
    variables: ['paperTitle', 'note'],
  },
  {
    key: 'registration.additional_payment_required',
    subject: 'Additional registration payment required',
    bodyHtml: buildEmailHtml({
      preheader: 'An additional payment is required to complete registration.',
      headline: 'Additional payment required',
      paragraphs: [
        'Your student verification was not approved at the discounted rate.',
        'An additional registration payment is required to complete your registration for the conference.',
      ],
      details: [
        { label: 'Paper', value: '{{paperTitle}}' },
        { label: 'Amount due', value: '{{amountFormatted}}' },
      ],
      secondaryNote:
        'Sign in to OpenConferences to complete the additional payment before the registration deadline.',
    }),
    bodyText: plainText({
      headline: 'Additional payment required',
      paragraphs: ['An additional registration payment is required.'],
      details: [
        { label: 'Paper', value: '{{paperTitle}}' },
        { label: 'Amount due', value: '{{amountFormatted}}' },
      ],
    }),
    variables: ['paperTitle', 'amountFormatted'],
  },
  {
    key: 'registration.deadline_reminder',
    subject: 'Registration deadline approaching',
    bodyHtml: buildEmailHtml({
      preheader: 'Complete registration before the deadline to keep your paper on the program.',
      headline: 'Registration deadline approaching',
      paragraphs: [
        'Your accepted paper still requires completed registration and payment.',
        'Please finalize registration before the deadline below to avoid withdrawal of your paper from the conference program.',
      ],
      details: [
        { label: 'Paper', value: '{{paperTitle}}' },
        { label: 'Registration deadline', value: '{{deadlineAt}}' },
      ],
      secondaryNote:
        'Important: papers with unpaid registration after the deadline may be withdrawn for non-payment.',
    }),
    bodyText: plainText({
      headline: 'Registration deadline approaching',
      paragraphs: ['Please complete registration before the deadline.'],
      details: [
        { label: 'Paper', value: '{{paperTitle}}' },
        { label: 'Registration deadline', value: '{{deadlineAt}}' },
      ],
      secondaryNote: 'Non-payment by the deadline may withdraw your paper.',
    }),
    variables: ['paperTitle', 'deadlineAt'],
  },
  {
    key: 'registration.discarded',
    subject: 'Registration closed — {{paperTitle}}',
    bodyHtml: buildEmailHtml({
      preheader: 'Registration was not completed before the deadline.',
      headline: 'Registration not completed',
      paragraphs: [
        'Registration for your accepted paper was not completed before the deadline.',
        'As a result, your registration has been marked as discarded due to non-payment, and your paper may be withdrawn from the conference program.',
      ],
      details: [{ label: 'Paper', value: '{{paperTitle}}' }],
      secondaryNote:
        'If you believe this is an error or need assistance, please contact the conference organizers directly.',
    }),
    bodyText: plainText({
      headline: 'Registration not completed',
      paragraphs: [
        'Registration was not completed before the deadline and has been discarded due to non-payment.',
      ],
      details: [{ label: 'Paper', value: '{{paperTitle}}' }],
    }),
    variables: ['paperTitle'],
  },
];
