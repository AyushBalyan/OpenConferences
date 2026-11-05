import type PgBoss from 'pg-boss';
import { generateId, prismaQueueAdapter, type Prisma } from '@openconferences/db';
import { NOTIFICATION_SEND_JOB_NAME } from '@openconferences/schemas';

function render(value: string, context: Record<string, string>, html = false) {
  return value.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const text = context[key] ?? '';
    return html
      ? text.replace(
          /[&<>"']/g,
          (char) =>
            ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!,
        )
      : text;
  });
}

/** Called inside the scan transaction: cycle, inbox update, email logs and jobs commit together. */
export async function enqueueRevisionNotifications(
  tx: Prisma.TransactionClient,
  boss: Pick<PgBoss, 'send'>,
  paperId: string,
  versionId: string,
  options: { webUrl: string; alertEmail?: string },
) {
  const paper = await tx.paper.findUniqueOrThrow({
    where: { id: paperId },
    include: { conference: true, authorships: { orderBy: { order: 'asc' } } },
  });
  const author = paper.authorships.find((item) => item.isCorresponding) ?? paper.authorships[0];
  if (!author?.email) throw new Error('Revised submission has no corresponding author email');
  const recipients = [{ to: author.email, key: 'revision.confirmed' }];
  if (
    options.alertEmail?.trim() &&
    options.alertEmail.trim().toLowerCase() !== author.email.trim().toLowerCase()
  )
    recipients.push({ to: options.alertEmail, key: 'revision.ops_alert' });
  const context = {
    conferenceName: paper.conference.name,
    submissionNumber: paper.submissionNumber || paper.id,
    paperTitle: paper.title,
    authorName: author.fullName,
    paperUrl: `${options.webUrl.replace(/\/$/, '')}/dashboard/conferences/${paper.conferenceId}/submissions/${paperId}?section=submission`,
  };
  for (const recipient of recipients) {
    const to = recipient.to.trim().toLowerCase();
    const idempotencyKey = `${recipient.key}-${versionId}`;
    if (await tx.emailSuppression.findUnique({ where: { email: to } })) continue;
    if (await tx.notificationLog.findUnique({ where: { idempotencyKey } })) continue;
    const templates = await tx.notificationTemplate.findMany({
      where: {
        key: recipient.key,
        isActive: true,
        OR: [{ organizationId: paper.organizationId }, { organizationId: null }],
      },
      orderBy: { version: 'desc' },
    });
    const template =
      templates.find((item) => item.organizationId === paper.organizationId) ?? templates[0];
    if (!template) throw new Error(`Missing notification template: ${recipient.key}`);
    const subject = render(template.subject, context);
    const html = render(template.bodyHtml, context, true);
    const text = template.bodyText ? render(template.bodyText, context) : undefined;
    const logId = generateId();
    await tx.notificationLog.create({
      data: {
        id: logId,
        organizationId: paper.organizationId,
        conferenceId: paper.conferenceId,
        templateKey: recipient.key,
        templateVersion: template.version,
        toEmail: to,
        subject,
        renderedHtml: html,
        status: 'QUEUED',
        idempotencyKey,
        relatedEntity: 'PaperVersion',
        relatedEntityId: versionId,
      },
    });
    const job = await boss.send(
      NOTIFICATION_SEND_JOB_NAME,
      { logId, to, subject, html, text, tags: [recipient.key], idempotencyKey },
      { db: prismaQueueAdapter(tx), retryLimit: 5, retryDelay: 30, retryBackoff: true },
    );
    if (!job) throw new Error('Could not enqueue revision notification');
  }
}
