import {
  rollupOutreachCampaignCounts,
  withMailDisclaimer,
  withTenantContext,
} from '@openconferences/db';
import { renderOutreachTemplate, type OutreachSendJobPayload } from '@openconferences/schemas';
import { remainingQuotaForTest } from './outreach-quota.js';
import { formatMailError } from './mail-error.js';
import { createOutreachMailer, type OutreachMailer } from './outreach-mailer.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function processOutreachCampaignJob(
  payload: OutreachSendJobPayload,
  mailer: OutreachMailer = createOutreachMailer(),
): Promise<void> {
  const campaign = await withTenantContext({}, async (tx) =>
    tx.outreachCampaign.findFirst({
      where: { id: payload.campaignId, conferenceId: payload.conferenceId },
    }),
  );

  if (!campaign) {
    throw new Error(`Outreach campaign ${payload.campaignId} not found`);
  }

  if (
    !campaign.subject ||
    !campaign.bodyHtml ||
    !campaign.fromEmail ||
    !campaign.fromName ||
    !campaign.replyToEmail
  ) {
    await withTenantContext({}, async (tx) =>
      tx.outreachCampaign.update({
        where: { id: campaign.id },
        data: { status: 'FAILED', version: { increment: 1 } },
      }),
    );
    throw new Error('Campaign is missing template or sender snapshot');
  }

  const subjectTemplate = campaign.subject;
  const bodyTemplate = campaign.bodyHtml;
  const fromName = campaign.fromName;
  const fromEmail = campaign.fromEmail;
  const replyToEmail = campaign.replyToEmail;

  let limits;
  try {
    limits = await mailer.getSendLimits();
  } catch (err) {
    await withTenantContext({}, async (tx) =>
      tx.outreachCampaign.update({
        where: { id: campaign.id },
        data: { status: 'FAILED', version: { increment: 1 } },
      }),
    );
    throw err;
  }

  if (!limits.sendingEnabled) {
    await withTenantContext({}, async (tx) =>
      tx.outreachCampaign.update({
        where: { id: campaign.id },
        data: { status: 'FAILED', version: { increment: 1 } },
      }),
    );
    throw new Error('Outreach sending is disabled for this provider');
  }

  const recipients = await withTenantContext({}, async (tx) =>
    tx.outreachRecipient.findMany({
      where: { campaignId: campaign.id, status: { in: ['PENDING', 'QUEUED', 'FAILED'] } },
      orderBy: { createdAt: 'asc' },
    }),
  );

  const remaining = remainingQuotaForTest(limits.max24HourSend, limits.sentLast24Hours);
  const delayMs = Math.max(50, Math.ceil(1000 / Math.max(limits.maxSendRate, 0.1)));
  let sentThisRun = 0;

  for (const recipient of recipients) {
    const suppressed = await withTenantContext({}, async (tx) =>
      tx.emailSuppression.findUnique({ where: { email: recipient.email } }),
    );

    if (suppressed) {
      await withTenantContext({}, async (tx) =>
        tx.outreachRecipient.update({
          where: { id: recipient.id },
          data: { status: 'SKIPPED', error: `Suppressed: ${suppressed.reason}` },
        }),
      );
      continue;
    }

    if (sentThisRun >= remaining) {
      await withTenantContext({}, async (tx) =>
        tx.outreachRecipient.update({
          where: { id: recipient.id },
          data: {
            status: 'FAILED',
            error: 'Outreach sending quota exceeded',
          },
        }),
      );
      continue;
    }

    const context = { name: recipient.name, topic: recipient.topic, paper: recipient.paper };
    const subject = renderOutreachTemplate(subjectTemplate, context);
    const html = withMailDisclaimer(renderOutreachTemplate(bodyTemplate, context), 'html');

    try {
      await withTenantContext({}, async (tx) =>
        tx.outreachRecipient.update({
          where: { id: recipient.id },
          data: { status: 'QUEUED', error: null },
        }),
      );

      const result = await mailer.send({
        to: recipient.email,
        toName: recipient.name,
        subject,
        html,
        fromName,
        fromEmail,
        replyToEmail,
        recipientId: recipient.id,
        campaignId: campaign.id,
        conferenceId: campaign.conferenceId,
      });

      await withTenantContext({}, async (tx) =>
        tx.outreachRecipient.update({
          where: { id: recipient.id },
          data: {
            status: 'SENT',
            providerMessageId: result.providerMessageId ?? null,
            sentAt: new Date(),
            error: null,
          },
        }),
      );
      sentThisRun += 1;
    } catch (err) {
      const message = formatMailError(err);
      await withTenantContext({}, async (tx) =>
        tx.outreachRecipient.update({
          where: { id: recipient.id },
          data: { status: 'FAILED', error: message },
        }),
      );
    }

    await sleep(delayMs);
  }

  await withTenantContext({}, async (tx) => {
    await rollupOutreachCampaignCounts(tx, campaign.id, { finalize: true });
  });
}
