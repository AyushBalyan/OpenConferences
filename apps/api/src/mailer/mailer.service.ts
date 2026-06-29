import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import PgBoss from 'pg-boss';
import { getConfig } from '@openconferences/config/env';
import { EMAIL_SEND_JOB_NAME, type EmailJobPayload } from '@openconferences/schemas';

export type MailSendInput = EmailJobPayload;

/** Captures the last enqueued email in test for integration assertions */
export let lastTestEmailPayload: EmailJobPayload | null = null;

export function resetLastTestEmailPayload(): void {
  lastTestEmailPayload = null;
}

@Injectable()
export class MailerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MailerService.name);
  private boss: PgBoss | null = null;

  async onModuleInit(): Promise<void> {
    const config = getConfig();
    this.boss = new PgBoss({
      connectionString: config.databaseUrl,
      schema: 'pgboss',
      application_name: 'openconferences-api-mailer',
    });

    this.boss.on('error', (err: Error) => {
      this.logger.error({ err }, 'pg-boss mailer error');
    });

    await this.boss.start();
    await this.boss.createQueue(EMAIL_SEND_JOB_NAME);
    this.logger.log('Mailer queue ready');
  }

  async onModuleDestroy(): Promise<void> {
    if (this.boss) {
      await this.boss.stop({ graceful: true, timeout: 10000 });
      this.boss = null;
    }
  }

  async send(input: MailSendInput): Promise<string | null> {
    if (getConfig().isTest) {
      lastTestEmailPayload = input;
    }

    if (!this.boss) {
      throw new Error('Mailer queue is not initialized');
    }

    const jobId = await this.boss.send(EMAIL_SEND_JOB_NAME, input, {
      singletonKey: input.idempotencyKey,
    });

    this.logger.debug({ jobId, to: input.to, subject: input.subject }, 'Email job enqueued');
    return jobId;
  }
}
