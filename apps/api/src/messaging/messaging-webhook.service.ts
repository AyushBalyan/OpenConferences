import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { getConfig } from '@openconferences/config/env';
import { generateId, withTenantContext } from '@openconferences/db';

type ZeptoWebhookPayload = {
  event_name?: string;
  event_message?: Array<{
    email_info?: {
      to?: Array<{ email_address?: string }>;
      processed_time?: string;
    };
    request_id?: string;
    event_data?: Array<{
      details?: Array<{
        reason?: string;
        bounce_type?: string;
      }>;
      email?: string;
    }>;
  }>;
};

@Injectable()
export class MessagingWebhookService {
  private readonly logger = new Logger(MessagingWebhookService.name);

  verifySignature(rawBody: Buffer, signature: string): boolean {
    const secret = getConfig().mail.zeptoWebhookSecret;
    if (!secret) {
      if (getConfig().isDev || getConfig().isTest) {
        return true;
      }
      return false;
    }

    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    try {
      return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    } catch {
      return false;
    }
  }

  async handleZeptoWebhook(rawBody: Buffer, signature: string): Promise<{ received: boolean }> {
    if (!this.verifySignature(rawBody, signature)) {
      throw new UnauthorizedException('Invalid Zepto webhook signature');
    }

    let payload: ZeptoWebhookPayload;
    try {
      payload = JSON.parse(rawBody.toString('utf8')) as ZeptoWebhookPayload;
    } catch {
      this.logger.warn('Invalid Zepto webhook JSON');
      return { received: true };
    }

    const eventName = payload.event_name ?? '';
    if (
      !eventName.toLowerCase().includes('bounce') &&
      !eventName.toLowerCase().includes('complaint')
    ) {
      return { received: true };
    }

    for (const message of payload.event_message ?? []) {
      const providerMessageId = message.request_id;
      const email =
        message.event_data?.[0]?.email ?? message.email_info?.to?.[0]?.email_address ?? null;

      if (providerMessageId) {
        await withTenantContext({}, async (tx) => {
          await tx.notificationLog.updateMany({
            where: { providerMessageId },
            data: { status: 'BOUNCED', error: eventName },
          });
        });
      }

      if (email) {
        const normalized = email.trim().toLowerCase();
        await withTenantContext({}, async (tx) => {
          await tx.emailSuppression.upsert({
            where: { email: normalized },
            create: {
              id: generateId(),
              email: normalized,
              reason: eventName,
            },
            update: { reason: eventName },
          });
        });
      }
    }

    return { received: true };
  }
}
