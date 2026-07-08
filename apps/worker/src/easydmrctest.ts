/**
 * EasyDMARC deliverability test — bulk send through the full notification pipeline:
 *
 *   notification_log → pg-boss (notification.send) → processNotificationJob → ZeptoMail
 *
 * Body is fixed to SPEAUD3QMCK for all recipients.
 *
 * Usage:
 *   pnpm easydmrctest
 *   pnpm easydmrctest -- --dry-run
 *   pnpm easydmrctest -- --delay-ms 500
 *
 * Requires .env with DATABASE_URL, MAIL_FROM, and ZEPTO_MAIL_API_KEY.
 */
import PgBoss from 'pg-boss';
import { getConfig } from '@openconferences/config/env';
import { generateId, withTenantContext } from '@openconferences/db';
import {
  NOTIFICATION_SEND_JOB_NAME,
  notificationJobPayloadSchema,
  type NotificationJobPayload,
} from '@openconferences/schemas';
import { createMailerAdapter } from './mailer.js';
import { formatMailError } from './mail-error.js';
import { processNotificationJob } from './notification.js';

export const EASYDMARC_TEST_NAME = 'easydmrctest';
export const EASYDMARC_TEST_BODY = 'SPEAUD3QMCK';

const RECIPIENTS = [
  'lucindasmith7291@gmail.com',
  'marcusrodriguez5042@gmail.com',
  'felicitynguyen9015@gmail.com',
  'donovanwilliams2876@gmail.com',
  'cynthiawilson6329@gmail.com',
  'elliotthughes4158@gmail.com',
  'mackenzieparker92032@gmail.com',
  'lincolnadams5634@gmail.com',
  'isabellahall3816@gmail.com',
  'gabrielcooper8973@gmail.com',
  'paigebrown6148@gmail.com',
  'zacharythompson2847@gmail.com',
  'emilysanchez4791@gmail.com',
  'owenrussell7921@gmail.com',
  'carterbutler5682@gmail.com',
  'averymartin4018@gmail.com',
  'lilygonzalez8261@gmail.com',
  'ethanmurphy9407@gmail.com',
  'savannahturner6053@gmail.com',
  'hudsonwright4196@gmail.com',
  'nataliehill7281@gmail.com',
  'jacobroberts58291@gmail.com',
  'zoeycollins9087@gmail.com',
  'dylanmorris2547@gmail.com',
  'madelinecook6398@gmail.com',
  'owenjackson7015@gmail.com',
  'audreymorgan1285@gmail.com',
  'noahwoodward9456@gmail.com',
  'clairekelly3769@gmail.com',
  'brooklynrogers2937@gmail.com',
  'ronaldtaylor1265@mail.ru',
  'lindadavis451@mail.ru',
  'torben.russel@yandex.ru',
  'karan.bell@yandex.ru',
  'team-ed@m365.easydmarc.com',
  'team-ed@m365.easydmarc.co.uk',
  'team-ed@m365.easydmarc.nl',
  'team-ed@m365.easydmarc.email',
  'team-ed@m365.easydmarc.help',
  'jonathan.shumacher@freenet.de',
  'easydmarc@interia.pl',
  'clarapearce16@aol.com',
  'victoryoung939@aol.com',
  'holmes_abel@aol.com',
  'lucidodson585@aol.com',
  'westemily343@aol.com',
  'adalinemcintosh69@aol.com',
  'leejack380@aol.com',
  'ed-global@seznam.cz',
  'ed-global2@seznam.cz',
  'easydmarc@sfr.fr',
  'hag@checkphishing.com',
  'ed-global@workmail.easydmarc.com',
  'ed-global2@workmail.easydmarc.com',
  'amayathompson6274@gmx.com',
  'finleyroberts9501@gmx.com',
  'arianawalker3816@gmx.com',
  'asherrussell7192@gmx.com',
  'adrianawilson5031@gmx.com',
  'lucahamilton2954@gmx.com',
  'elliebutler6109@gmx.com',
  'xaviercook1982@gmx.com',
  'skylarhughes5287@gmx.com',
  'oliverrodriguez8173@gmx.com',
  'evelynedwards6947@gmx.com',
  'elliotprice4138@gmx.com',
  'saranichols8625@gmx.com',
  'milesward2517@gmx.com',
  'paigehoward2421@gmx.com',
  'ziggybeltran@yahoo.com',
  'myers.ridley@yahoo.com',
  'aiylacortes@yahoo.com',
  'miller.burton35@yahoo.com',
  'sandy.allen7663@yahoo.com',
  'burriscassidy156@yahoo.com',
  'hillnancy886@yahoo.com',
  'fitzpatrickedgar@yahoo.com',
  'ed-global@op.pl',
  'ed-global@onet.pl',
  'team-ed@dmarc.am',
  'team-ed@easydmarc.co.uk',
  'team-ed@easydmarc.email',
  'team-ed@easydmarc.help',
  'team-ed@easydmarc.nl',
  'norawoodard6719@zohomail.com',
  'henrymartinez2864@zohomail.com',
  'leohenderson1295@zohomail.com',
  'jackcoleman2964@zohomail.com',
  'harperroberts9350@zohomail.com',
  'sydneypeterson9012@zohomail.com',
  'evabennett2045@zohomail.com',
  'julianramirez4758@zohomail.com',
  'arielturner5704@zohomail.com',
  'ivycollins6097@zohomail.com',
  'ed-global@libero.it',
  'vincentmarshall9240@outlook.com',
  'sophiawright1707@outlook.com',
  'nataliemorris4018@outlook.com',
  'lucasrivera5629@outlook.com',
  'camillemurray5964@outlook.com',
  'alexandergreen31867@outlook.com',
  'ameliawilson5167@outlook.com',
  'isaacperry6239@outlook.com',
  'zarahamilton3196@outlook.com',
  'sebastiansanders4862@outlook.com',
  'elisabethpowell7854@outlook.com',
  'joshuarobinson1629@outlook.com',
  'madisonharris4185@outlook.com',
  'jonathanrodriguez7549@outlook.com',
  'benjaminprice2195@outlook.com',
  'lillianwoodard64191@outlook.com',
  'elijahbailey39781@outlook.com',
  'scarlettcoleman6237@outlook.com',
  'victoriaroberts85075@outlook.com',
  'ryangonzalez2164@outlook.com',
  'easydmarc@laposte.net',
  'hkhatchoian@icloud.com',
  'ed-global@centrum.cz',
  'easydmarc@free.fr',
  'jonathan.shumacher@web.de',
  'ed-global@att.net',
  'ed-global@bluetiehome.com',
  'jonathan.shumacher@t-online.de',
  'jonathan.shumacher@gmx.de',
] as const;

type PendingJob = {
  logId: string;
  to: string;
  payload: NotificationJobPayload;
};

function buildMessageContent(): { subject: string; html: string; text: string } {
  return {
    subject: EASYDMARC_TEST_NAME,
    html: `<!DOCTYPE html><html><body><p>${EASYDMARC_TEST_BODY}</p></body></html>`,
    text: EASYDMARC_TEST_BODY,
  };
}

function parseArgs(argv: string[]): {
  dryRun: boolean;
  delayMs: number;
  retryFailed: boolean;
  help: boolean;
} {
  let dryRun = false;
  let delayMs = 200;
  let retryFailed = false;
  let help = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    switch (arg) {
      case '--dry-run':
        dryRun = true;
        break;
      case '--retry-failed':
        retryFailed = true;
        break;
      case '--delay-ms':
        delayMs = Number(argv[++i]);
        if (!Number.isFinite(delayMs) || delayMs < 0) {
          throw new Error('--delay-ms must be a non-negative number');
        }
        break;
      case '--help':
      case '-h':
        help = true;
        break;
      default:
        if (arg.startsWith('--')) {
          throw new Error(`Unknown option: ${arg}`);
        }
    }
  }

  return { dryRun, delayMs, retryFailed, help };
}

function printHelp(): void {
  console.log(`EasyDMARC bulk deliverability test (${EASYDMARC_TEST_NAME}).

Sends body "${EASYDMARC_TEST_BODY}" to ${RECIPIENTS.length} recipients through:
  notification_log → pg-boss → processNotificationJob → ZeptoMail

Usage:
  pnpm easydmrctest
  pnpm easydmrctest -- --dry-run
  pnpm easydmrctest -- --delay-ms 1000
  pnpm easydmrctest -- --retry-failed --delay-ms 1000

Options:
  --dry-run       List recipients and exit without sending
  --retry-failed  Resend only to addresses that failed in a previous run
  --delay-ms <n>  Pause between enqueues (default: 200)
  --help          Show this help

Environment:
  DATABASE_URL, MAIL_FROM, ZEPTO_MAIL_API_KEY
`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForAllLogs(
  logIds: string[],
  timeoutMs: number,
): Promise<Map<string, 'SENT' | 'FAILED' | 'QUEUED'>> {
  const results = new Map<string, 'SENT' | 'FAILED' | 'QUEUED'>();
  const pending = new Set(logIds);
  const started = Date.now();

  while (pending.size > 0 && Date.now() - started < timeoutMs) {
    const batch = [...pending];
    const logs = await withTenantContext({ bypass: true }, async (tx) =>
      tx.notificationLog.findMany({
        where: { id: { in: batch } },
        select: { id: true, status: true },
      }),
    );

    for (const log of logs) {
      if (log.status === 'SENT' || log.status === 'FAILED') {
        results.set(log.id, log.status);
        pending.delete(log.id);
      }
    }

    if (pending.size > 0) {
      await sleep(1000);
    }
  }

  for (const id of pending) {
    results.set(id, 'QUEUED');
  }

  return results;
}

async function loadFailedRecipients(): Promise<string[]> {
  const logs = await withTenantContext({ bypass: true }, async (tx) =>
    tx.notificationLog.findMany({
      where: { templateKey: EASYDMARC_TEST_NAME, status: 'FAILED' },
      orderBy: { toEmail: 'asc' },
      select: { toEmail: true },
    }),
  );

  return [...new Set(logs.map((log) => log.toEmail))];
}

async function runBulkSend(recipients: string[], delayMs: number): Promise<number> {
  const config = getConfig();
  const mailer = createMailerAdapter();
  const { subject, html, text } = buildMessageContent();
  const runId = Date.now();

  console.log(`${EASYDMARC_TEST_NAME} — full pipeline bulk send`);
  console.log(`  adapter:    ${mailer.name}`);
  console.log(`  from:       ${config.mail.from}`);
  console.log(`  subject:    ${subject}`);
  console.log(`  body:       ${EASYDMARC_TEST_BODY}`);
  console.log(`  recipients: ${recipients.length}`);
  console.log(`  delay:      ${delayMs}ms between enqueues`);

  if (mailer.name === 'log') {
    console.warn('\nWarning: ZEPTO_MAIL_API_KEY is not set — emails will be logged, not sent.');
  }

  const boss = new PgBoss({
    connectionString: config.databaseUrl,
    schema: 'pgboss',
    application_name: 'openconferences-easydmrctest',
  });

  boss.on('error', (err: Error) => {
    console.error('pg-boss error:', err.message);
  });

  await boss.start();
  await boss.createQueue(NOTIFICATION_SEND_JOB_NAME);

  let processed = 0;

  await boss.work(NOTIFICATION_SEND_JOB_NAME, async (jobs) => {
    for (const job of jobs) {
      const parsed = notificationJobPayloadSchema.safeParse(job.data);
      if (!parsed.success) {
        console.error(`Invalid job payload (job ${job.id}):`, parsed.error.message);
        continue;
      }

      try {
        await processNotificationJob(parsed.data);
        processed += 1;
        console.log(`  sent ${processed}/${recipients.length}: ${parsed.data.to}`);
      } catch (err) {
        console.error(`  failed ${parsed.data.to}: ${formatMailError(err)}`);
      }
    }
  });

  const pendingJobs: PendingJob[] = [];

  for (const [index, to] of recipients.entries()) {
    const logId = generateId();
    const idempotencyKey = `${EASYDMARC_TEST_NAME}:${runId}:${to}`;

    await withTenantContext({ bypass: true }, async (tx) =>
      tx.notificationLog.create({
        data: {
          id: logId,
          organizationId: null,
          conferenceId: null,
          templateKey: EASYDMARC_TEST_NAME,
          templateVersion: null,
          toEmail: to,
          subject,
          renderedHtml: html,
          status: 'QUEUED',
          idempotencyKey,
          relatedEntity: 'EasydmarcTest',
        },
      }),
    );

    const payload: NotificationJobPayload = {
      logId,
      to,
      subject,
      html,
      text,
      tags: [EASYDMARC_TEST_NAME],
      idempotencyKey,
    };

    await boss.send(NOTIFICATION_SEND_JOB_NAME, payload, {
      singletonKey: idempotencyKey,
      retryLimit: 5,
      retryDelay: 30,
      retryBackoff: true,
    });

    pendingJobs.push({ logId, to, payload });

    if (delayMs > 0 && index < recipients.length - 1) {
      await sleep(delayMs);
    }
  }

  console.log(`\nEnqueued ${pendingJobs.length} jobs. Waiting for delivery...`);

  const timeoutMs = Math.max(120_000, pendingJobs.length * 5_000);
  const outcomes = await waitForAllLogs(
    pendingJobs.map((job) => job.logId),
    timeoutMs,
  );

  await boss.stop({ graceful: true, timeout: 30_000 });

  let sent = 0;
  let failed = 0;
  let queued = 0;

  for (const job of pendingJobs) {
    const status = outcomes.get(job.logId) ?? 'QUEUED';
    if (status === 'SENT') sent += 1;
    else if (status === 'FAILED') failed += 1;
    else queued += 1;
  }

  const failedLogs = await withTenantContext({ bypass: true }, async (tx) =>
    tx.notificationLog.findMany({
      where: {
        id: { in: pendingJobs.map((job) => job.logId) },
        status: 'FAILED',
      },
      select: { toEmail: true, error: true },
      orderBy: { toEmail: 'asc' },
    }),
  );

  console.log('\nSummary');
  console.log(`  sent:    ${sent}`);
  console.log(`  failed:  ${failed}`);
  console.log(`  queued:  ${queued}`);
  console.log(`  total:   ${pendingJobs.length}`);

  if (failedLogs.length > 0) {
    console.log('\nFailed recipients:');
    for (const log of failedLogs) {
      console.log(`  ${log.toEmail}: ${log.error ?? '(no error recorded)'}`);
    }
  }

  if (failed > 0 || queued > 0) {
    return 1;
  }

  return 0;
}

async function main(): Promise<void> {
  const cliArgs = process.argv.slice(2).filter((arg) => arg !== '--');
  const args = parseArgs(cliArgs);

  if (args.help) {
    printHelp();
    return;
  }

  const recipients = RECIPIENTS.map((email) => email.trim().toLowerCase());
  const uniqueRecipients = [...new Set(recipients)];

  if (args.dryRun) {
    console.log(`${EASYDMARC_TEST_NAME} dry run`);
    console.log(`  body:       ${EASYDMARC_TEST_BODY}`);
    console.log(`  recipients: ${uniqueRecipients.length} (${RECIPIENTS.length} listed)`);
    for (const email of uniqueRecipients) {
      console.log(`    ${email}`);
    }
    return;
  }

  if (args.retryFailed) {
    const failedRecipients = await loadFailedRecipients();
    if (failedRecipients.length === 0) {
      console.log('No failed easydmrctest recipients to retry.');
      return;
    }

    console.log(`Retrying ${failedRecipients.length} previously failed recipient(s)...`);
    process.exitCode = await runBulkSend(failedRecipients, args.delayMs);
    return;
  }

  process.exitCode = await runBulkSend(uniqueRecipients, args.delayMs);
}

main().catch((err: unknown) => {
  console.error(`\nError: ${formatMailError(err)}`);
  process.exit(1);
});
