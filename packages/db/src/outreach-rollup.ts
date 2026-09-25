import type { PrismaClient } from '@prisma/client';
import { outreachCampaignRollup } from '@openconferences/schemas';

type TransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

export async function rollupOutreachCampaignCounts(
  tx: TransactionClient,
  campaignId: string,
  options: { finalize?: boolean } = {},
): Promise<{
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  status: string;
}> {
  const campaign = await tx.outreachCampaign.findFirst({
    where: { id: campaignId },
    select: { id: true, status: true, sentAt: true },
  });

  if (!campaign) {
    throw new Error(`Outreach campaign ${campaignId} not found`);
  }

  const recipients = await tx.outreachRecipient.findMany({
    where: { campaignId },
    select: { status: true },
  });

  const rollup = outreachCampaignRollup({
    currentStatus: campaign.status,
    recipientStatuses: recipients.map((row) => row.status),
    finalize: options.finalize,
  });

  const sentAt =
    rollup.status === 'FAILED'
      ? options.finalize
        ? null
        : campaign.sentAt
      : rollup.status === 'SENDING' || rollup.status === 'DRAFT' || rollup.status === 'READY'
        ? campaign.sentAt
        : (campaign.sentAt ?? new Date());

  await tx.outreachCampaign.update({
    where: { id: campaignId },
    data: {
      sentCount: rollup.sentCount,
      failedCount: rollup.failedCount,
      skippedCount: rollup.skippedCount,
      status: rollup.status,
      sentAt,
      version: { increment: 1 },
    },
  });

  return rollup;
}
