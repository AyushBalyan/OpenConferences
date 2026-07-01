import { generateId, prisma } from '@openconferences/db';

const PLATFORM_TEMPLATES = [
  {
    key: 'auth.email_verify',
    subject: 'Verify your OpenConferences email',
    bodyHtml:
      '<p>Please verify your email address by clicking the link below:</p><p><a href="{{verifyUrl}}">Verify email</a></p>',
    variables: ['verifyUrl'],
  },
  {
    key: 'auth.password_reset',
    subject: 'Reset your OpenConferences password',
    bodyHtml:
      '<p>Reset your password by clicking the link below:</p><p><a href="{{resetUrl}}">Reset password</a></p>',
    variables: ['resetUrl'],
  },
  {
    key: 'submission.confirmed',
    subject: 'Submission confirmed: {{paperTitle}}',
    bodyHtml: '<p>Your paper &quot;{{paperTitle}}&quot; has been submitted successfully.</p>',
    variables: ['paperTitle'],
  },
  {
    key: 'reviewer.invitation',
    subject: 'Reviewer invitation: {{conferenceName}}',
    bodyHtml:
      '<p>You have been invited to review for <strong>{{conferenceName}}</strong>.</p><p><a href="{{signupUrl}}">Create your account to accept the invitation</a></p>',
    variables: ['conferenceName', 'signupUrl', 'expiresAt'],
  },
  {
    key: 'assignment.notified',
    subject: 'Review assignment: {{paperTitle}}',
    bodyHtml:
      '<p>You have been assigned to review &quot;{{paperTitle}}&quot; (Round {{roundNumber}}).</p>',
    variables: ['paperTitle', 'roundNumber', 'dueAt'],
  },
  {
    key: 'decision.notified',
    subject: 'Decision: {{outcomeLabel}} — {{paperTitle}}',
    bodyHtml:
      '<p>The editorial decision for &quot;{{paperTitle}}&quot; is: <strong>{{outcomeLabel}}</strong>.</p>{{rationaleBlock}}{{acceptBlock}}',
    variables: ['paperTitle', 'outcomeLabel', 'rationaleBlock', 'acceptBlock'],
  },
  {
    key: 'review.released',
    subject: 'Reviews released: {{paperTitle}}',
    bodyHtml: '<p>Reviews for your paper &quot;{{paperTitle}}&quot; have been released.</p>',
    variables: ['paperTitle'],
  },
] as const;

export async function ensureNotificationTemplates(): Promise<void> {
  try {
    for (const template of PLATFORM_TEMPLATES) {
      const existing = await prisma.notificationTemplate.findFirst({
        where: { organizationId: null, key: template.key, version: 1 },
      });

      if (existing) {
        await prisma.notificationTemplate.update({
          where: { id: existing.id },
          data: {
            subject: template.subject,
            bodyHtml: template.bodyHtml,
            variables: template.variables,
            isActive: true,
          },
        });
        continue;
      }

      await prisma.notificationTemplate.create({
        data: {
          id: generateId(),
          organizationId: null,
          key: template.key,
          version: 1,
          locale: 'en',
          subject: template.subject,
          bodyHtml: template.bodyHtml,
          variables: template.variables,
          isActive: true,
        },
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('notification_templates')) {
      throw new Error(
        'Notification tables are missing. Run: pnpm --filter @openconferences/db exec prisma migrate deploy',
      );
    }
    throw err;
  }
}
