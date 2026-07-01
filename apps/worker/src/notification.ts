import { withTenantContext } from '@openconferences/db';
import type { NotificationJobPayload } from '@openconferences/schemas';
import { createMailerAdapter } from './mailer.js';

const mailer = createMailerAdapter();

export async function processNotificationJob(payload: NotificationJobPayload): Promise<void> {
  try {
    const result = await mailer.send({
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      replyTo: payload.replyTo,
      tags: payload.tags,
    });

    await withTenantContext({ bypass: true }, async (tx) =>
      tx.notificationLog.update({
        where: { id: payload.logId },
        data: {
          status: 'SENT',
          providerMessageId: result.providerMessageId ?? null,
          sentAt: new Date(),
          error: null,
        },
      }),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown send error';

    await withTenantContext({ bypass: true }, async (tx) =>
      tx.notificationLog.update({
        where: { id: payload.logId },
        data: {
          status: 'FAILED',
          error: message,
        },
      }),
    );

    throw err;
  }
}
