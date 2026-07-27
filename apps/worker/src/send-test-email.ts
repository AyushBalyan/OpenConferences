/**
 * Send a test notification email through the same pipeline as production:
 *
 *   template (DB) → render → notification_log → pg-boss (optional) → processNotificationJob → ZeptoMail
 *
 * Usage:
 *   pnpm mail:test -- --to you@example.com
 *   pnpm mail:test -- --to you@example.com --template submission.confirmed
 *   pnpm mail:test -- --to you@example.com --mode queue   # enqueue only; worker must be running
 *   pnpm mail:test -- --list-templates
 *
 * Requires .env with DATABASE_URL, MAIL_FROM, and ZEPTO_MAIL_API_KEY (for real sends).
 */
import PgBoss from 'pg-boss';
import { getConfig } from '@openconferences/config/env';
import type { NotificationTemplate } from '@openconferences/db';
import { generateId, withTenantContext } from '@openconferences/db';
import { NOTIFICATION_SEND_JOB_NAME, type NotificationJobPayload } from '@openconferences/schemas';
import { createMailerAdapter } from './mailer.js';
import { processNotificationJob } from './notification.js';

type SendMode = 'send' | 'queue' | 'full';

const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function renderTemplate(template: string, context: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    if (!(key in context)) {
      return '';
    }
    return String(context[key] ?? '').replace(/[&<>"']/g, (char) => HTML_ESCAPE_MAP[char] ?? char);
  });
}

async function resolveActiveTemplate(
  organizationId: string | null | undefined,
  key: string,
): Promise<NotificationTemplate> {
  const orgTemplate = organizationId
    ? await withTenantContext({}, async (tx) =>
        tx.notificationTemplate.findFirst({
          where: { organizationId, key, isActive: true },
          orderBy: { version: 'desc' },
        }),
      )
    : null;

  if (orgTemplate) {
    return orgTemplate;
  }

  const platformTemplate = await withTenantContext({}, async (tx) =>
    tx.notificationTemplate.findFirst({
      where: { organizationId: null, key, isActive: true },
      orderBy: { version: 'desc' },
    }),
  );

  if (!platformTemplate) {
    throw new Error(
      `Template "${key}" not found. Run: pnpm db:seed (or pnpm --filter @openconferences/db exec prisma migrate deploy)`,
    );
  }

  return platformTemplate;
}

function buildSampleContext(templateKey: string, webUrl: string): Record<string, string> {
  const base = webUrl.replace(/\/$/, '');
  const deadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const byKey: Record<string, Record<string, string>> = {
    'auth.email_verify': {
      otp: '123456',
      expiresMinutes: '10',
    },
    'auth.password_reset': {
      resetUrl: `${base}/reset-password?token=deliverability-test-token`,
    },
    'auth.mfa_otp': {
      otp: '123456',
      expiresMinutes: '10',
    },
    'submission.confirmed': {
      paperTitle: 'Deliverability Test Paper',
    },
    'reviewer.invitation': {
      conferenceName: 'OpenConferences Test Conference',
      signupUrl: `${base}/join/reviewer?token=deliverability-test-token&invitationToken=test-invite`,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'UTC',
        timeZoneName: 'short',
      }),
    },
    'assignment.notified': {
      paperTitle: 'Deliverability Test Paper',
      roundNumber: '1',
      dueAt: deadline,
    },
    'review.reminder': {
      paperTitle: 'Deliverability Test Paper',
      dueAt: deadline,
    },
    'decision.notified': {
      paperTitle: 'Deliverability Test Paper',
      outcomeLabel: 'Accept',
      rationaleBlock: 'This is a test message for spam/deliverability checking.',
      acceptBlock: 'Camera-ready instructions would appear here in a real notification.',
    },
    'review.released': {
      paperTitle: 'Deliverability Test Paper',
    },
    'cameraready.reminder': {
      paperTitle: 'Deliverability Test Paper',
      deadlineAt: deadline,
    },
    'registration.window_open': {
      paperTitle: 'Deliverability Test Paper',
      deadlineAt: deadline,
    },
    'registration.early_bird_ending': {
      paperTitle: 'Deliverability Test Paper',
      earlyBirdEndsAt: deadline,
    },
    'registration.confirmed': {
      paperTitle: 'Deliverability Test Paper',
      amountFormatted: '₹1,500.00',
    },
    'registration.verification_approved': {
      paperTitle: 'Deliverability Test Paper',
    },
    'registration.clarification_requested': {
      paperTitle: 'Deliverability Test Paper',
      note: 'Please upload a clearer student ID image.',
    },
    'registration.additional_payment_required': {
      paperTitle: 'Deliverability Test Paper',
      amountFormatted: '₹500.00',
    },
    'registration.deadline_reminder': {
      paperTitle: 'Deliverability Test Paper',
      deadlineAt: deadline,
    },
    'registration.discarded': {
      paperTitle: 'Deliverability Test Paper',
    },
  };

  return byKey[templateKey] ?? {};
}

function printHelp(): void {
  console.log(`Send a test email through the production notification pipeline.

Usage:
  pnpm mail:test -- --to <email> [options]

Options:
  --to <email>              Recipient (required unless --list-templates)
  --template <key>          Template key (default: auth.email_verify)
  --org-id <uuid>           Organization override for template resolution
  --mode <send|queue|full>  Pipeline mode (default: send)
                              send  — render, log, send via processNotificationJob (same as worker)
                              queue — enqueue pg-boss job only (worker must be running)
                              full  — enqueue then poll until worker marks log SENT/FAILED
  --list-templates          Print active platform template keys and exit

Environment:
  DATABASE_URL, MAIL_FROM, ZEPTO_MAIL_API_KEY (optional; without key uses log adapter)
`);
}

function parseArgs(argv: string[]): {
  to?: string;
  templateKey: string;
  organizationId?: string;
  mode: SendMode;
  listTemplates: boolean;
  help: boolean;
} {
  let to: string | undefined;
  let templateKey = 'auth.email_verify';
  let organizationId: string | undefined;
  let mode: SendMode = 'send';
  let listTemplates = false;
  let help = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    switch (arg) {
      case '--to':
        to = argv[++i];
        break;
      case '--template':
        templateKey = argv[++i] ?? templateKey;
        break;
      case '--org-id':
        organizationId = argv[++i];
        break;
      case '--mode':
        mode = argv[++i] as SendMode;
        break;
      case '--list-templates':
        listTemplates = true;
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

  if (!['send', 'queue', 'full'].includes(mode)) {
    throw new Error(`Invalid --mode "${mode}". Use send, queue, or full.`);
  }

  return { to, templateKey, organizationId, mode, listTemplates, help };
}

async function listTemplateKeys(): Promise<void> {
  const templates = await withTenantContext({}, async (tx) =>
    tx.notificationTemplate.findMany({
      where: { organizationId: null, isActive: true },
      orderBy: [{ key: 'asc' }, { version: 'desc' }],
      distinct: ['key'],
      select: { key: true, version: true },
    }),
  );

  if (templates.length === 0) {
    console.log('No platform templates found. Run: pnpm db:seed');
    return;
  }

  console.log('Active platform notification templates:\n');
  for (const row of templates) {
    console.log(`  ${row.key} (v${row.version})`);
  }
}

async function waitForLogStatus(
  logId: string,
  timeoutMs: number,
): Promise<'SENT' | 'FAILED' | 'QUEUED'> {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const log = await withTenantContext({}, async (tx) =>
      tx.notificationLog.findUnique({ where: { id: logId } }),
    );

    if (log?.status === 'SENT' || log?.status === 'FAILED') {
      return log.status;
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return 'QUEUED';
}

async function main(): Promise<void> {
  const cliArgs = process.argv.slice(2).filter((arg) => arg !== '--');
  const args = parseArgs(cliArgs);

  if (args.help) {
    printHelp();
    return;
  }

  if (args.listTemplates) {
    await listTemplateKeys();
    return;
  }

  if (!args.to) {
    printHelp();
    throw new Error('--to is required');
  }

  const config = getConfig();
  const mailer = createMailerAdapter();
  const normalizedTo = args.to.trim().toLowerCase();
  const idempotencyKey = `mail-test:${normalizedTo}:${args.templateKey}:${Date.now()}`;

  console.log('Mail deliverability test');
  console.log(`  adapter:  ${mailer.name}`);
  console.log(`  from:     ${config.mail.from}`);
  console.log(`  to:       ${normalizedTo}`);
  console.log(`  template: ${args.templateKey}`);
  console.log(`  mode:     ${args.mode}`);

  if (mailer.name === 'log') {
    console.warn('\nWarning: ZEPTO_MAIL_API_KEY is not set — email will be logged, not sent.');
  }

  const template = await resolveActiveTemplate(args.organizationId ?? null, args.templateKey);
  const context = buildSampleContext(args.templateKey, config.webUrl);
  const subject = renderTemplate(template.subject, context);
  const html = renderTemplate(template.bodyHtml, context);
  const text = template.bodyText ? renderTemplate(template.bodyText, context) : undefined;
  const tags = [args.templateKey, 'mail-test'];
  const logId = generateId();

  await withTenantContext({}, async (tx) =>
    tx.notificationLog.create({
      data: {
        id: logId,
        organizationId: args.organizationId ?? null,
        conferenceId: null,
        templateKey: args.templateKey,
        templateVersion: template.version,
        toEmail: normalizedTo,
        subject,
        renderedHtml: html,
        status: 'QUEUED',
        idempotencyKey,
        relatedEntity: 'MailTest',
      },
    }),
  );

  const payload: NotificationJobPayload = {
    logId,
    to: normalizedTo,
    subject,
    html,
    text,
    tags,
    idempotencyKey,
  };

  if (args.mode === 'send') {
    console.log('\nSending via processNotificationJob (worker mail path)...');
    await processNotificationJob(payload);

    const log = await withTenantContext({}, async (tx) =>
      tx.notificationLog.findUnique({ where: { id: logId } }),
    );

    console.log('\nDone.');
    console.log(`  log id:             ${logId}`);
    console.log(`  status:             ${log?.status ?? 'unknown'}`);
    console.log(`  provider message:   ${log?.providerMessageId ?? '(none)'}`);
    if (log?.error) {
      console.log(`  error:              ${log.error}`);
    }
    return;
  }

  const boss = new PgBoss({
    connectionString: config.databaseUrl,
    schema: 'pgboss',
    application_name: 'openconferences-mail-test',
  });

  boss.on('error', (err: Error) => {
    console.error('pg-boss error:', err.message);
  });

  await boss.start();
  await boss.createQueue(NOTIFICATION_SEND_JOB_NAME);

  const jobId = await boss.send(NOTIFICATION_SEND_JOB_NAME, payload, {
    singletonKey: idempotencyKey,
    retryLimit: 5,
    retryDelay: 30,
    retryBackoff: true,
  });

  console.log(`\nEnqueued notification.send job: ${jobId ?? '(deduplicated)'}`);

  if (args.mode === 'queue') {
    console.log('Start the worker to process: pnpm --filter @openconferences/worker dev');
    await boss.stop({ graceful: true, timeout: 5000 });
    return;
  }

  console.log('Waiting for worker to process (up to 60s)...');
  const status = await waitForLogStatus(logId, 60_000);
  const log = await withTenantContext({}, async (tx) =>
    tx.notificationLog.findUnique({ where: { id: logId } }),
  );

  await boss.stop({ graceful: true, timeout: 5000 });

  console.log('\nDone.');
  console.log(`  log id:             ${logId}`);
  console.log(`  status:             ${status}`);
  console.log(`  provider message:   ${log?.providerMessageId ?? '(none)'}`);
  if (log?.error) {
    console.log(`  error:              ${log.error}`);
  }

  if (status === 'QUEUED') {
    console.warn('\nTimed out waiting for worker. Is it running?');
    process.exitCode = 1;
  } else if (status === 'FAILED') {
    process.exitCode = 1;
  }
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`\nError: ${message}`);
  process.exit(1);
});
