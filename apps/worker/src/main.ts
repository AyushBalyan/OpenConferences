import PgBoss from 'pg-boss';
import pino from 'pino';
import { getConfig } from '@openconferences/config/env';
import {
  EMAIL_SEND_JOB_NAME,
  FILE_SCAN_JOB_NAME,
  INVOICE_GENERATE_JOB_NAME,
  DISCARD_SWEEP_JOB_NAME,
  PAYMENT_RECONCILE_JOB_NAME,
  NOTIFICATION_SEND_JOB_NAME,
  REMINDER_SWEEP_JOB_NAME,
  emailJobPayloadSchema,
  fileScanJobPayloadSchema,
  invoiceGenerateJobPayloadSchema,
  discardSweepJobPayloadSchema,
  paymentReconcileJobPayloadSchema,
  notificationJobPayloadSchema,
  reminderSweepJobPayloadSchema,
} from '@openconferences/schemas';
import { processFileScanJob } from './scan.js';
import { processInvoiceJob } from './invoice.js';
import { processDiscardSweepJob } from './discard-sweep.js';
import { processPaymentReconcileJob } from './payment-reconcile.js';
import { processNotificationJob } from './notification.js';
import { processReminderSweepJob } from './reminder-sweep.js';

export const NOOP_JOB_NAME = 'noop.smoke';

const config = getConfig();
const logger = pino({ level: config.logLevel });

let boss: PgBoss | null = null;
let isShuttingDown = false;

async function startWorker(): Promise<void> {
  boss = new PgBoss({
    connectionString: config.databaseUrl,
    schema: 'pgboss',
    application_name: 'openconferences-worker',
  });

  boss.on('error', (err) => {
    logger.error({ err }, 'pg-boss error');
  });

  await boss.start();
  logger.info('pg-boss worker started');

  await boss.createQueue(NOOP_JOB_NAME);
  await boss.createQueue(EMAIL_SEND_JOB_NAME);
  await boss.createQueue(NOTIFICATION_SEND_JOB_NAME);
  await boss.createQueue(REMINDER_SWEEP_JOB_NAME);
  await boss.createQueue(FILE_SCAN_JOB_NAME);
  await boss.createQueue(INVOICE_GENERATE_JOB_NAME);
  await boss.createQueue(DISCARD_SWEEP_JOB_NAME);
  await boss.createQueue(PAYMENT_RECONCILE_JOB_NAME);

  await boss.work(NOOP_JOB_NAME, async (jobs) => {
    for (const job of jobs) {
      logger.info({ jobId: job.id, name: job.name }, 'Processed noop job');
    }
  });

  await boss.work(EMAIL_SEND_JOB_NAME, async (jobs) => {
    for (const job of jobs) {
      const parsed = emailJobPayloadSchema.safeParse(job.data);
      if (!parsed.success) {
        logger.error({ jobId: job.id, err: parsed.error }, 'Invalid email job payload');
        continue;
      }

      // Dev log adapter — production uses Zepto in Phase 9
      logger.info(
        {
          jobId: job.id,
          to: parsed.data.to,
          subject: parsed.data.subject,
          replyTo: parsed.data.replyTo,
          tags: parsed.data.tags,
        },
        'Email sent (dev log adapter)',
      );
    }
  });

  await boss.work(NOTIFICATION_SEND_JOB_NAME, async (jobs) => {
    for (const job of jobs) {
      const parsed = notificationJobPayloadSchema.safeParse(job.data);
      if (!parsed.success) {
        logger.error({ jobId: job.id, err: parsed.error }, 'Invalid notification job payload');
        continue;
      }

      try {
        await processNotificationJob(parsed.data);
        logger.info(
          { jobId: job.id, logId: parsed.data.logId, to: parsed.data.to },
          'Notification sent',
        );
      } catch (err) {
        logger.error({ jobId: job.id, err }, 'Notification job failed');
        throw err;
      }
    }
  });

  await boss.work(REMINDER_SWEEP_JOB_NAME, async (jobs) => {
    for (const job of jobs) {
      const parsed = reminderSweepJobPayloadSchema.safeParse(job.data ?? {});
      if (!parsed.success) {
        logger.error({ jobId: job.id, err: parsed.error }, 'Invalid reminder sweep payload');
        continue;
      }

      try {
        const result = await processReminderSweepJob(boss!, parsed.data);
        logger.info({ jobId: job.id, ...result }, 'Reminder sweep completed');
      } catch (err) {
        logger.error({ jobId: job.id, err }, 'Reminder sweep job failed');
        throw err;
      }
    }
  });

  await boss.schedule(
    REMINDER_SWEEP_JOB_NAME,
    '0 8 * * *',
    {},
    { singletonKey: 'daily-reminder-sweep' },
  );

  await boss.work(FILE_SCAN_JOB_NAME, async (jobs) => {
    for (const job of jobs) {
      const parsed = fileScanJobPayloadSchema.safeParse(job.data);
      if (!parsed.success) {
        logger.error({ jobId: job.id, err: parsed.error }, 'Invalid file scan job payload');
        continue;
      }

      try {
        await processFileScanJob(parsed.data);
        logger.info({ jobId: job.id, fileAssetId: parsed.data.fileAssetId }, 'File scan completed');
      } catch (err) {
        logger.error({ jobId: job.id, err }, 'File scan job failed');
        throw err;
      }
    }
  });

  await boss.work(INVOICE_GENERATE_JOB_NAME, async (jobs) => {
    for (const job of jobs) {
      const parsed = invoiceGenerateJobPayloadSchema.safeParse(job.data);
      if (!parsed.success) {
        logger.error({ jobId: job.id, err: parsed.error }, 'Invalid invoice job payload');
        continue;
      }

      try {
        await processInvoiceJob(parsed.data);
        logger.info({ jobId: job.id, paymentId: parsed.data.paymentId }, 'Invoice generated');
      } catch (err) {
        logger.error({ jobId: job.id, err }, 'Invoice job failed');
        throw err;
      }
    }
  });

  await boss.work(DISCARD_SWEEP_JOB_NAME, async (jobs) => {
    for (const job of jobs) {
      const parsed = discardSweepJobPayloadSchema.safeParse(job.data ?? {});
      if (!parsed.success) {
        logger.error({ jobId: job.id, err: parsed.error }, 'Invalid discard sweep payload');
        continue;
      }

      try {
        const result = await processDiscardSweepJob(parsed.data);
        logger.info({ jobId: job.id, ...result }, 'Discard sweep completed');
      } catch (err) {
        logger.error({ jobId: job.id, err }, 'Discard sweep job failed');
        throw err;
      }
    }
  });

  await boss.work(PAYMENT_RECONCILE_JOB_NAME, async (jobs) => {
    for (const job of jobs) {
      const parsed = paymentReconcileJobPayloadSchema.safeParse(job.data ?? {});
      if (!parsed.success) {
        logger.error({ jobId: job.id, err: parsed.error }, 'Invalid payment reconcile payload');
        continue;
      }

      try {
        const result = await processPaymentReconcileJob(parsed.data);
        logger.info({ jobId: job.id, ...result }, 'Payment reconcile completed');
      } catch (err) {
        logger.error({ jobId: job.id, err }, 'Payment reconcile job failed');
        throw err;
      }
    }
  });

  const jobId = await boss.send(NOOP_JOB_NAME, { smoke: true, at: new Date().toISOString() });
  logger.info({ jobId }, 'Enqueued noop smoke job');
}

async function shutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info({ signal }, 'Shutting down worker gracefully');

  if (boss) {
    await boss.stop({ graceful: true, timeout: 30000 });
    logger.info('pg-boss stopped');
  }

  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

startWorker().catch((err: unknown) => {
  logger.error({ err }, 'Worker failed to start');
  process.exit(1);
});
