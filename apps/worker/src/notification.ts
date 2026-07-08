import { withTenantContext } from '@openconferences/db';
import type { NotificationJobPayload } from '@openconferences/schemas';
import { formatMailError } from './mail-error.js';
import { createMailerAdapter } from './mailer.js';

const mailer = createMailerAdapter();

export async function processNotificationJob(payload: NotificationJobPayload): Promise<void> {
  try {
    const result = await mailer.send({
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
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
    const message = formatMailError(err);

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
