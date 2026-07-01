import { Injectable } from '@nestjs/common';
import { getConfig } from '@openconferences/config/env';
import type { EmailJobPayload } from '@openconferences/schemas';
import { QueueService } from '../queue/queue.service';

export type MailSendInput = EmailJobPayload;

/** @deprecated Use lastTestNotification from messaging/notification.service */
export let lastTestEmailPayload: EmailJobPayload | null = null;

/** @deprecated Use resetLastTestNotification */
export function resetLastTestEmailPayload(): void {
  lastTestEmailPayload = null;
}

@Injectable()
export class MailerService {
  constructor(private readonly queue: QueueService) {}

  async send(input: MailSendInput): Promise<string | null> {
    if (getConfig().isTest) {
      lastTestEmailPayload = input;
    }

    return this.queue.sendEmail(input);
  }
}
