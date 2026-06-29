import PgBoss from 'pg-boss';
import pino from 'pino';
import { getConfig } from '@openconferences/config/env';
import { EMAIL_SEND_JOB_NAME, emailJobPayloadSchema } from '@openconferences/schemas';

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
