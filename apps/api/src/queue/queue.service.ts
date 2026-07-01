import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import PgBoss from 'pg-boss';
import { getConfig } from '@openconferences/config/env';
import {
  EMAIL_SEND_JOB_NAME,
  FILE_SCAN_JOB_NAME,
  INVOICE_GENERATE_JOB_NAME,
  DISCARD_SWEEP_JOB_NAME,
  PAYMENT_RECONCILE_JOB_NAME,
  NOTIFICATION_SEND_JOB_NAME,
  REMINDER_SWEEP_JOB_NAME,
  type EmailJobPayload,
  type FileScanJobPayload,
  type InvoiceGenerateJobPayload,
  type DiscardSweepJobPayload,
  type PaymentReconcileJobPayload,
  type NotificationJobPayload,
  type ReminderSweepJobPayload,
} from '@openconferences/schemas';

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private boss: PgBoss | null = null;

  async onModuleInit(): Promise<void> {
    const config = getConfig();
    this.boss = new PgBoss({
      connectionString: config.databaseUrl,
      schema: 'pgboss',
      application_name: 'openconferences-api-queue',
    });

    this.boss.on('error', (err: Error) => {
      this.logger.error({ err }, 'pg-boss queue error');
    });

    await this.boss.start();
    await this.boss.createQueue(EMAIL_SEND_JOB_NAME);
    await this.boss.createQueue(NOTIFICATION_SEND_JOB_NAME);
    await this.boss.createQueue(REMINDER_SWEEP_JOB_NAME);
    await this.boss.createQueue(FILE_SCAN_JOB_NAME);
    await this.boss.createQueue(INVOICE_GENERATE_JOB_NAME);
    await this.boss.createQueue(DISCARD_SWEEP_JOB_NAME);
    await this.boss.createQueue(PAYMENT_RECONCILE_JOB_NAME);
    this.logger.log('pg-boss queues ready');
  }

  async onModuleDestroy(): Promise<void> {
    if (this.boss) {
      await this.boss.stop({ graceful: true, timeout: 10000 });
      this.boss = null;
    }
  }

  async sendEmail(input: EmailJobPayload): Promise<string | null> {
    if (!this.boss) {
      throw new Error('Queue is not initialized');
    }

    return this.boss.send(EMAIL_SEND_JOB_NAME, input, {
      singletonKey: input.idempotencyKey,
    });
  }

  async sendNotification(input: NotificationJobPayload): Promise<string | null> {
    if (!this.boss) {
      throw new Error('Queue is not initialized');
    }

    return this.boss.send(NOTIFICATION_SEND_JOB_NAME, input, {
      singletonKey: input.idempotencyKey ?? input.logId,
      retryLimit: 5,
      retryDelay: 30,
      retryBackoff: true,
    });
  }

  async scheduleReminderSweep(cron: string, payload: ReminderSweepJobPayload = {}): Promise<void> {
    if (!this.boss) {
      throw new Error('Queue is not initialized');
    }

    await this.boss.schedule(REMINDER_SWEEP_JOB_NAME, cron, payload, {
      singletonKey: `reminder-sweep-${payload.kind ?? 'all'}`,
    });
  }

  async enqueueReminderSweep(payload: ReminderSweepJobPayload = {}): Promise<string | null> {
    if (!this.boss) {
      throw new Error('Queue is not initialized');
    }

    return this.boss.send(REMINDER_SWEEP_JOB_NAME, payload, {
      singletonKey: `reminder-sweep-run-${payload.kind ?? 'all'}-${Date.now()}`,
    });
  }

  async sendFileScan(input: FileScanJobPayload): Promise<string | null> {
    if (!this.boss) {
      throw new Error('Queue is not initialized');
    }

    return this.boss.send(FILE_SCAN_JOB_NAME, input, {
      singletonKey: input.fileAssetId,
    });
  }

  async enqueueInvoiceGeneration(input: InvoiceGenerateJobPayload): Promise<string | null> {
    if (!this.boss) {
      throw new Error('Queue is not initialized');
    }

    return this.boss.send(INVOICE_GENERATE_JOB_NAME, input, {
      singletonKey: `invoice-${input.paymentId}`,
    });
  }

  async enqueueDiscardSweep(input: DiscardSweepJobPayload = {}): Promise<string | null> {
    if (!this.boss) {
      throw new Error('Queue is not initialized');
    }

    const key = input.conferenceId ?? 'global';
    return this.boss.send(DISCARD_SWEEP_JOB_NAME, input, {
      singletonKey: `discard-sweep-${key}`,
    });
  }

  async enqueuePaymentReconcile(input: PaymentReconcileJobPayload = {}): Promise<string | null> {
    if (!this.boss) {
      throw new Error('Queue is not initialized');
    }

    return this.boss.send(PAYMENT_RECONCILE_JOB_NAME, input, {
      singletonKey: input.paymentId ?? 'global-reconcile',
    });
  }
}
