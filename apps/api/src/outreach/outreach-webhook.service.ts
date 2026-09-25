import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { Resend } from 'resend';
import { getConfig } from '@openconferences/config/env';
import {
  generateId,
  Prisma,
  rollupOutreachCampaignCounts,
  withTenantContext,
} from '@openconferences/db';
import type { OutreachRecipientStatus } from '@openconferences/db';
import {
  normalizeOutreachTags,
  resendOutreachWebhookEventSchema,
  type ResendOutreachWebhookEvent,
} from '@openconferences/schemas';

const TERMINAL_DELIVERY_STATUSES = new Set<OutreachRecipientStatus>([
  'BOUNCED',
  'COMPLAINED',
  'SUPPRESSED',
]);

export type ResendWebhookHeaders = {
  svixId: string;
  svixTimestamp: string;
  svixSignature: string;
};

export type ResendWebhookVerifier = (input: {
  payload: string;
  headers: { id: string; timestamp: string; signature: string };
  webhookSecret: string;
}) => unknown;

export type ResendOutreachEventAction =
  | { type: 'ignore' }
  | { type: 'record-sent' }
  | { type: 'record-delivered' }
  | {
      type: 'set-status';
      status: Extract<OutreachRecipientStatus, 'FAILED' | 'BOUNCED' | 'COMPLAINED' | 'SUPPRESSED'>;
      suppress: boolean;
      error: string;
    };

export function isOutreachChannel(tags: Record<string, string>): boolean {
  return tags.channel === 'outreach';
}

export function mapResendOutreachEvent(
  eventType: string,
  event: ResendOutreachWebhookEvent,
): ResendOutreachEventAction {
  const bounceMessage = event.data.bounce?.message;
  const suppressedMessage = event.data.suppressed?.message;

  switch (eventType) {
    case 'email.sent':
      return { type: 'record-sent' };
    case 'email.delivered':
      return { type: 'record-delivered' };
    case 'email.failed':
      return {
        type: 'set-status',
        status: 'FAILED',
        suppress: false,
        error: bounceMessage ?? suppressedMessage ?? eventType,
      };
    case 'email.bounced':
      return {
        type: 'set-status',
        status: 'BOUNCED',
        suppress: true,
        error: bounceMessage ?? eventType,
      };
    case 'email.complained':
      return {
        type: 'set-status',
        status: 'COMPLAINED',
        suppress: true,
        error: eventType,
      };
    case 'email.suppressed':
      return {
        type: 'set-status',
        status: 'SUPPRESSED',
        suppress: true,
        error: suppressedMessage ?? eventType,
      };
    default:
      return { type: 'ignore' };
  }
}

export function verifyResendOutreachWebhook(input: {
  payload: string;
  headers: { id: string; timestamp: string; signature: string };
  webhookSecret: string;
  apiKey?: string;
}): unknown {
  const resend = new Resend(input.apiKey || 're_webhook_verify');
  return resend.webhooks.verify({
    payload: input.payload,
    headers: input.headers,
    webhookSecret: input.webhookSecret,
  });
}

function isUniqueConflict(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

type OutreachWebhookTx = {
  outreachWebhookEvent: {
    create: (args: {
      data: {
        id: string;
        svixId: string;
        eventType: string;
        emailId: string | null;
        recipientId: string | null;
      };
    }) => Promise<unknown>;
  };
  outreachRecipient: {
    findFirst: (args: { where: Record<string, unknown> }) => Promise<{
      id: string;
      campaignId: string;
      email: string;
      status: OutreachRecipientStatus;
      providerMessageId: string | null;
      sentAt: Date | null;
      deliveredAt: Date | null;
    } | null>;
    update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<unknown>;
  };
  emailSuppression: {
    upsert: (args: {
      where: { email: string };
      create: { id: string; email: string; reason: string };
      update: { reason: string };
    }) => Promise<unknown>;
  };
};

export async function applyVerifiedResendOutreachEvent(
  tx: OutreachWebhookTx,
  input: { svixId: string; event: ResendOutreachWebhookEvent },
  rollup: (tx: OutreachWebhookTx, campaignId: string) => Promise<unknown> = (client, campaignId) =>
    rollupOutreachCampaignCounts(client as never, campaignId),
): Promise<'applied' | 'ignored'> {
  const tags = normalizeOutreachTags(input.event.data.tags);
  const emailId = input.event.data.email_id ?? null;
  const taggedRecipientId = tags.recipientId || null;

  await tx.outreachWebhookEvent.create({
    data: {
      id: generateId(),
      svixId: input.svixId,
      eventType: input.event.type,
      emailId,
      recipientId: taggedRecipientId,
    },
  });

  if (!isOutreachChannel(tags)) {
    return 'ignored';
  }

  const action = mapResendOutreachEvent(input.event.type, input.event);
  if (action.type === 'ignore') {
    return 'ignored';
  }

  const recipient = emailId
    ? await tx.outreachRecipient.findFirst({
        where: { providerMessageId: emailId },
      })
    : null;
  const fallback =
    recipient ??
    (taggedRecipientId
      ? await tx.outreachRecipient.findFirst({ where: { id: taggedRecipientId } })
      : null);

  if (!fallback) {
    return 'ignored';
  }

  const nextProviderId = fallback.providerMessageId ?? emailId;
  const alreadyTerminal = TERMINAL_DELIVERY_STATUSES.has(fallback.status);

  if (action.type === 'record-sent') {
    await tx.outreachRecipient.update({
      where: { id: fallback.id },
      data: {
        providerMessageId: nextProviderId,
        ...(fallback.status === 'PENDING' || fallback.status === 'QUEUED'
          ? { status: 'SENT', sentAt: fallback.sentAt ?? new Date(), error: null }
          : {}),
      },
    });
  } else if (action.type === 'record-delivered') {
    await tx.outreachRecipient.update({
      where: { id: fallback.id },
      data: {
        providerMessageId: nextProviderId,
        deliveredAt: fallback.deliveredAt ?? new Date(),
        ...(fallback.status === 'PENDING' || fallback.status === 'QUEUED'
          ? { status: 'SENT', sentAt: fallback.sentAt ?? new Date(), error: null }
          : {}),
      },
    });
  } else if (action.type === 'set-status' && (!alreadyTerminal || action.status !== 'FAILED')) {
    await tx.outreachRecipient.update({
      where: { id: fallback.id },
      data: {
        providerMessageId: nextProviderId,
        status: action.status,
        error: action.error,
      },
    });

    if (action.suppress) {
      await tx.emailSuppression.upsert({
        where: { email: fallback.email },
        create: {
          id: generateId(),
          email: fallback.email,
          reason: `outreach:${input.event.type}`,
        },
        update: { reason: `outreach:${input.event.type}` },
      });
    }
  }

  await rollup(tx, fallback.campaignId);
  return 'applied';
}

@Injectable()
export class OutreachWebhookService {
  private readonly logger = new Logger(OutreachWebhookService.name);
  verify: ResendWebhookVerifier = verifyResendOutreachWebhook;

  async handleResendWebhook(
    rawBody: Buffer,
    headers: ResendWebhookHeaders,
  ): Promise<{ received: boolean }> {
    const secret = getConfig().outreach.resend.webhookSecret;
    if (!secret) {
      throw new UnauthorizedException('Outreach Resend webhook secret is not configured');
    }

    const payloadText = rawBody.toString('utf8');
    try {
      this.verify({
        payload: payloadText,
        headers: {
          id: headers.svixId,
          timestamp: headers.svixTimestamp,
          signature: headers.svixSignature,
        },
        webhookSecret: secret,
      });
    } catch {
      throw new UnauthorizedException('Invalid Resend webhook signature');
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(payloadText) as unknown;
    } catch {
      this.logger.warn('Invalid Resend outreach webhook JSON');
      return { received: true };
    }

    const parsed = resendOutreachWebhookEventSchema.safeParse(parsedJson);
    if (!parsed.success) {
      this.logger.warn('Resend outreach webhook failed schema validation');
      return { received: true };
    }

    try {
      await withTenantContext({}, async (tx) => {
        await applyVerifiedResendOutreachEvent(tx, { svixId: headers.svixId, event: parsed.data });
      });
    } catch (err) {
      if (isUniqueConflict(err)) {
        return { received: true };
      }
      throw err;
    }

    return { received: true };
  }
}
