import { getConfig } from '@openconferences/config/env';
import {
  openInvitationMail,
  isProtectedInvitationMail,
  withMailDisclaimer,
  withTenantContext,
} from '@openconferences/db';
import type { NotificationJobPayload } from '@openconferences/schemas';
import { formatMailError } from './mail-error.js';
import { createMailerAdapter } from './mailer.js';

const mailer = createMailerAdapter();

export async function processNotificationJob(payload: NotificationJobPayload): Promise<void> {
  try {
    const result = await mailer.send({
      to: payload.to,
      subject: payload.subject,
      html: withMailDisclaimer(openInvitationMail(payload.html, getConfig().auth.secret), 'html'),
      text: payload.text
        ? withMailDisclaimer(openInvitationMail(payload.text, getConfig().auth.secret), 'text')
        : undefined,
      replyTo: payload.replyTo,
      tags: payload.tags,
    });

    await withTenantContext({}, async (tx) =>
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
    const protectedMail = isProtectedInvitationMail(payload.html);
    const message = protectedMail ? 'Invitation email delivery failed' : formatMailError(err);

    await withTenantContext({}, async (tx) =>
      tx.notificationLog.update({
        where: { id: payload.logId },
        data: {
          status: 'FAILED',
          error: message,
        },
      }),
    );

    if (protectedMail) throw new Error(message);
    throw err;
  }
}
