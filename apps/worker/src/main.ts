import { processReviewerDigestJob, recordDigestFailure } from './reviewer-digest.js';
import PgBoss from 'pg-boss';
import pino from 'pino';
import { getConfig } from '@openconferences/config/env';
import { assertSafeDatabaseRole, pruneIntegrationAccessLogs } from '@openconferences/db';
import {
  REVIEWER_DIGEST_JOB_NAME,
  reviewerDigestJobSchema,
  EMAIL_SEND_JOB_NAME,
  FILE_SCAN_JOB_NAME,
  INVOICE_GENERATE_JOB_NAME,
  DISCARD_SWEEP_JOB_NAME,
  PAYMENT_RECONCILE_JOB_NAME,
  NOTIFICATION_SEND_JOB_NAME,
  REMINDER_SWEEP_JOB_NAME,
  OUTREACH_SEND_JOB_NAME,
  emailJobPayloadSchema,
  fileScanJobPayloadSchema,
  invoiceGenerateJobPayloadSchema,
  discardSweepJobPayloadSchema,
  paymentReconcileJobPayloadSchema,
  notificationJobPayloadSchema,
  reminderSweepJobPayloadSchema,
  outreachSendJobPayloadSchema,
} from '@openconferences/schemas';
import { processFileScanJob } from './scan.js';
import { processInvoiceJob } from './invoice.js';
import { processDiscardSweepJob } from './discard-sweep.js';
import { processPaymentReconcileJob } from './payment-reconcile.js';
import { processNotificationJob } from './notification.js';
import { processOutreachCampaignJob } from './outreach.js';
import { processReminderSweepJob } from './reminder-sweep.js';

export const NOOP_JOB_NAME = 'noop.smoke';
const INTEGRATION_ACCESS_RETENTION_JOB_NAME = 'integration.access-retention';

const WORKER_QUEUES = [
  REVIEWER_DIGEST_JOB_NAME,
  NOOP_JOB_NAME,
  INTEGRATION_ACCESS_RETENTION_JOB_NAME,
  EMAIL_SEND_JOB_NAME,
  NOTIFICATION_SEND_JOB_NAME,
  REMINDER_SWEEP_JOB_NAME,
  FILE_SCAN_JOB_NAME,
  INVOICE_GENERATE_JOB_NAME,
  DISCARD_SWEEP_JOB_NAME,
  PAYMENT_RECONCILE_JOB_NAME,
  OUTREACH_SEND_JOB_NAME,
] as const;

const WORKER_SCHEDULES = [
  {
    name: INTEGRATION_ACCESS_RETENTION_JOB_NAME,
    cron: '*/15 * * * *',
    singletonKey: 'integration-access-retention',
  },
  {
    name: PAYMENT_RECONCILE_JOB_NAME,
    cron: '*/5 * * * *',
    singletonKey: 'payment-reconcile',
  },
  {
    name: REMINDER_SWEEP_JOB_NAME,
    cron: '0 8 * * *',
    singletonKey: 'daily-reminder-sweep',
  },
] as const;

const config = getConfig();
const logger = pino({ level: config.logLevel });

let boss: PgBoss | null = null;
let isShuttingDown = false;

async function startupStep<T>(step: string, run: () => Promise<T>): Promise<T> {
  logger.info({ step }, 'Worker startup step started');
  try {
    const result = await run();
    logger.info({ step }, 'Worker startup step completed');
    return result;
  } catch (err) {
    if (err && typeof err === 'object') {
      Object.assign(err, { startupStep: step });
    }
    throw err;
  }
}

function startupStepOf(err: unknown): string | undefined {
  if (
    err &&
    typeof err === 'object' &&
    'startupStep' in err &&
    typeof err.startupStep === 'string'
  ) {
    return err.startupStep;
  }
  return undefined;
}

function isSessionPoolExhausted(err: unknown): boolean {
  return err instanceof Error && err.message.includes('EMAXCONNSESSION');
}

async function startWorker(): Promise<void> {
  await startupStep('assert-database-role', () => assertSafeDatabaseRole());

  boss = new PgBoss({
    connectionString: config.databaseUrl,
    schema: 'pgboss',
    application_name: 'openconferences-worker',
  });

  boss.on('error', (err) => {
    logger.error(
      {
        err,
        sessionPoolExhausted: isSessionPoolExhausted(err),
      },
      isSessionPoolExhausted(err)
        ? 'pg-boss lost a connection because the session pooler is full'
        : 'pg-boss error',
    );
  });

  await startupStep('start-pg-boss', () => boss!.start());
  logger.info({ endpoint: config.s3.endpoint, bucket: config.s3.bucket }, 'object store');

  for (const queue of WORKER_QUEUES) {
    await startupStep(`create-queue:${queue}`, () => boss!.createQueue(queue));
  }

  await startupStep(`subscribe:${INTEGRATION_ACCESS_RETENTION_JOB_NAME}`, () =>
    boss!.work(INTEGRATION_ACCESS_RETENTION_JOB_NAME, async (jobs) => {
      const jobIds = jobs.map((job) => job.id);
      logger.info({ jobIds }, 'Integration access retention started');
      try {
        const removed = await pruneIntegrationAccessLogs();
        logger.info({ jobIds, removed }, 'Integration access retention completed');
      } catch (err) {
        logger.error({ jobIds, err }, 'Integration access retention failed');
        throw err;
      }
    }),
  );

  await startupStep(`subscribe:${REVIEWER_DIGEST_JOB_NAME}`, () =>
    boss!.work(REVIEWER_DIGEST_JOB_NAME, { includeMetadata: true }, async (jobs) => {
      for (const job of jobs) {
        const payload = reviewerDigestJobSchema.parse(job.data);
        try {
          await processReviewerDigestJob(boss!, payload);
        } catch (err) {
          await recordDigestFailure(payload, err, job.retryCount >= job.retryLimit);
          throw err;
        }
      }
    }),
  );

  await startupStep(`subscribe:${NOOP_JOB_NAME}`, () =>
    boss!.work(NOOP_JOB_NAME, async (jobs) => {
      for (const job of jobs) {
        logger.info({ jobId: job.id, name: job.name }, 'Processed noop job');
      }
    }),
  );

  await startupStep(`subscribe:${EMAIL_SEND_JOB_NAME}`, () =>
    boss!.work(EMAIL_SEND_JOB_NAME, async (jobs) => {
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
    }),
  );

  await startupStep(`subscribe:${NOTIFICATION_SEND_JOB_NAME}`, () =>
    boss!.work(NOTIFICATION_SEND_JOB_NAME, async (jobs) => {
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
    }),
  );

  await startupStep(`subscribe:${REMINDER_SWEEP_JOB_NAME}`, () =>
    boss!.work(REMINDER_SWEEP_JOB_NAME, async (jobs) => {
      for (const job of jobs) {
        logger.info({ jobId: job.id }, 'Reminder sweep started');
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
    }),
  );

  await startupStep(`subscribe:${FILE_SCAN_JOB_NAME}`, () =>
    boss!.work(FILE_SCAN_JOB_NAME, async (jobs) => {
      for (const job of jobs) {
        const parsed = fileScanJobPayloadSchema.safeParse(job.data);
        if (!parsed.success) {
          logger.error({ jobId: job.id, err: parsed.error }, 'Invalid file scan job payload');
          continue;
        }

        try {
          await processFileScanJob(parsed.data);
          logger.info(
            { jobId: job.id, fileAssetId: parsed.data.fileAssetId },
            'File scan completed',
          );
        } catch (err) {
          logger.error({ jobId: job.id, err }, 'File scan job failed');
          throw err;
        }
      }
    }),
  );

  await startupStep(`subscribe:${INVOICE_GENERATE_JOB_NAME}`, () =>
    boss!.work(INVOICE_GENERATE_JOB_NAME, async (jobs) => {
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
    }),
  );

  await startupStep(`subscribe:${DISCARD_SWEEP_JOB_NAME}`, () =>
    boss!.work(DISCARD_SWEEP_JOB_NAME, async (jobs) => {
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
    }),
  );

  await startupStep(`subscribe:${PAYMENT_RECONCILE_JOB_NAME}`, () =>
    boss!.work(PAYMENT_RECONCILE_JOB_NAME, async (jobs) => {
      for (const job of jobs) {
        logger.info({ jobId: job.id }, 'Payment reconcile started');
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
    }),
  );

  await startupStep(`subscribe:${OUTREACH_SEND_JOB_NAME}`, () =>
    boss!.work(OUTREACH_SEND_JOB_NAME, async (jobs) => {
      for (const job of jobs) {
        const parsed = outreachSendJobPayloadSchema.safeParse(job.data);
        if (!parsed.success) {
          logger.error({ jobId: job.id, err: parsed.error }, 'Invalid outreach send payload');
          continue;
        }

        try {
          await processOutreachCampaignJob(parsed.data);
          logger.info(
            { jobId: job.id, campaignId: parsed.data.campaignId },
            'Outreach campaign send completed',
          );
        } catch (err) {
          logger.error({ jobId: job.id, err }, 'Outreach campaign send failed');
          throw err;
        }
      }
    }),
  );

  for (const schedule of WORKER_SCHEDULES) {
    await startupStep(`schedule:${schedule.name}`, () =>
      boss!.schedule(schedule.name, schedule.cron, {}, { singletonKey: schedule.singletonKey }),
    );
  }

  const jobId = await startupStep('enqueue-smoke-job', () =>
    boss!.send(NOOP_JOB_NAME, { smoke: true, at: new Date().toISOString() }),
  );
  logger.info(
    {
      smokeJobId: jobId,
      queues: WORKER_QUEUES,
      schedules: WORKER_SCHEDULES,
    },
    'pg-boss worker started',
  );
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
  const sessionPoolExhausted = isSessionPoolExhausted(err);
  logger.error(
    {
      err,
      startupStep: startupStepOf(err),
      sessionPoolExhausted,
    },
    sessionPoolExhausted
      ? 'Worker failed to start because the Supabase session pooler refused a connection (EMAXCONNSESSION). The process will exit so Coolify can restart it after other clients disconnect.'
      : 'Worker failed to start',
  );
  process.exit(1);
});
