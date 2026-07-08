import type PgBoss from 'pg-boss';
import { generateId, prisma, withTenantContext } from '@openconferences/db';
import type { ReminderSweepJobPayload } from '@openconferences/schemas';
import { NOTIFICATION_SEND_JOB_NAME } from '@openconferences/schemas';

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderTemplate(template: string, context: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    if (!(key in context)) return '';
    return escapeHtml(context[key]);
  });
}

async function enqueueDirect(
  boss: PgBoss,
  input: {
    templateKey: string;
    to: string;
    context: Record<string, unknown>;
    organizationId: string;
    conferenceId: string;
    idempotencyKey: string;
    relatedEntity: string;
    relatedEntityId: string;
  },
): Promise<boolean> {
  const normalizedEmail = input.to.trim().toLowerCase();

  const suppressed = await prisma.emailSuppression.findUnique({
    where: { email: normalizedEmail },
  });
  if (suppressed) return false;

  const existing = await prisma.notificationLog.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
  });
  if (existing) return false;

  const template = await prisma.notificationTemplate.findFirst({
    where: {
      key: input.templateKey,
      isActive: true,
      OR: [{ organizationId: input.organizationId }, { organizationId: null }],
    },
    orderBy: [{ organizationId: 'desc' }, { version: 'desc' }],
  });

  if (!template) return false;

  const subject = renderTemplate(template.subject, input.context);
  const html = renderTemplate(template.bodyHtml, input.context);
  const text = template.bodyText ? renderTemplate(template.bodyText, input.context) : undefined;
  const logId = generateId();

  await withTenantContext({ bypass: true }, async (tx) =>
    tx.notificationLog.create({
      data: {
        id: logId,
        organizationId: input.organizationId,
        conferenceId: input.conferenceId,
        templateKey: input.templateKey,
        templateVersion: template.version,
        toEmail: normalizedEmail,
        subject,
        renderedHtml: html,
        status: 'QUEUED',
        idempotencyKey: input.idempotencyKey,
        relatedEntity: input.relatedEntity,
        relatedEntityId: input.relatedEntityId,
      },
    }),
  );

  await boss.send(
    NOTIFICATION_SEND_JOB_NAME,
    {
      logId,
      to: normalizedEmail,
      subject,
      html,
      text,
      tags: [input.templateKey],
      idempotencyKey: input.idempotencyKey,
    },
    { singletonKey: input.idempotencyKey },
  );

  return true;
}

export async function processReminderSweepJob(
  boss: PgBoss,
  payload: ReminderSweepJobPayload,
): Promise<{ enqueued: number }> {
  const kinds = payload.kind
    ? [payload.kind]
    : ([
        'review.reminder',
        'cameraready.reminder',
        'registration.early_bird_ending',
        'registration.deadline_reminder',
      ] as const);

  let enqueued = 0;
  const now = new Date();
  const inThreeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  for (const kind of kinds) {
    if (kind === 'review.reminder') {
      const assignments = await prisma.reviewerAssignment.findMany({
        where: {
          status: { in: ['ASSIGNED', 'ACCEPTED'] },
          ...(payload.conferenceId ? { conferenceId: payload.conferenceId } : {}),
        },
        include: {
          reviewer: { select: { email: true } },
          paper: { select: { title: true } },
          round: { select: { reviewDueAt: true } },
        },
      });

      for (const assignment of assignments) {
        const dueAt = assignment.dueAt ?? assignment.round.reviewDueAt;
        if (!dueAt || dueAt > inThreeDays || dueAt < now) continue;

        const sent = await enqueueDirect(boss, {
          templateKey: 'review.reminder',
          to: assignment.reviewer.email,
          context: {
            paperTitle: assignment.paper.title,
            dueAt: dueAt.toISOString(),
          },
          organizationId: assignment.organizationId,
          conferenceId: assignment.conferenceId,
          idempotencyKey: `review-reminder-${assignment.id}-${dueAt.toISOString().slice(0, 10)}`,
          relatedEntity: 'ReviewerAssignment',
          relatedEntityId: assignment.id,
        });
        if (sent) enqueued += 1;
      }
    }

    if (kind === 'cameraready.reminder') {
      const papers = await prisma.paper.findMany({
        where: {
          status: { in: ['DECISION_MADE', 'CAMERA_READY'] },
          ...(payload.conferenceId ? { conferenceId: payload.conferenceId } : {}),
        },
        include: {
          authorships: true,
          conference: { select: { cameraReadyDueAt: true } },
        },
      });

      for (const paper of papers) {
        const deadlineAt = paper.conference.cameraReadyDueAt;
        if (!deadlineAt || deadlineAt > inThreeDays || deadlineAt < now) continue;

        const author = paper.authorships.find((a) => a.isCorresponding) ?? paper.authorships[0];
        if (!author?.email) continue;

        const sent = await enqueueDirect(boss, {
          templateKey: 'cameraready.reminder',
          to: author.email,
          context: {
            paperTitle: paper.title,
            deadlineAt: deadlineAt.toISOString(),
          },
          organizationId: paper.organizationId,
          conferenceId: paper.conferenceId,
          idempotencyKey: `cameraready-reminder-${paper.id}`,
          relatedEntity: 'Paper',
          relatedEntityId: paper.id,
        });
        if (sent) enqueued += 1;
      }
    }

    if (kind === 'registration.deadline_reminder') {
      const registrations = await prisma.registration.findMany({
        where: {
          status: { in: ['PENDING', 'AWAITING_VERIFICATION', 'ADDITIONAL_PAYMENT_REQUIRED'] },
          ...(payload.conferenceId ? { conferenceId: payload.conferenceId } : {}),
          deadlineAt: { lte: inThreeDays, gte: now },
        },
        include: {
          paper: { include: { authorships: true } },
        },
      });

      for (const registration of registrations) {
        const author =
          registration.paper.authorships.find((a) => a.isCorresponding) ??
          registration.paper.authorships[0];
        if (!author?.email) continue;

        const sent = await enqueueDirect(boss, {
          templateKey: 'registration.deadline_reminder',
          to: author.email,
          context: {
            paperTitle: registration.paper.title,
            deadlineAt: registration.deadlineAt.toISOString(),
          },
          organizationId: registration.organizationId,
          conferenceId: registration.conferenceId,
          idempotencyKey: `registration-deadline-${registration.id}`,
          relatedEntity: 'Registration',
          relatedEntityId: registration.id,
        });
        if (sent) enqueued += 1;
      }
    }

    if (kind === 'registration.early_bird_ending') {
      const conferences = await prisma.conference.findMany({
        where: payload.conferenceId ? { id: payload.conferenceId } : {},
      });

      for (const conference of conferences) {
        const feeSchedule = conference.feeSchedule as { earlyBirdEndsAt?: string };
        const earlyBirdEndsAt = feeSchedule.earlyBirdEndsAt
          ? new Date(feeSchedule.earlyBirdEndsAt)
          : null;
        if (!earlyBirdEndsAt || earlyBirdEndsAt > inThreeDays || earlyBirdEndsAt < now) continue;

        const registrations = await prisma.registration.findMany({
          where: {
            conferenceId: conference.id,
            status: { in: ['PENDING', 'AWAITING_VERIFICATION', 'ADDITIONAL_PAYMENT_REQUIRED'] },
          },
          include: { paper: { include: { authorships: true } } },
        });

        for (const registration of registrations) {
          const author =
            registration.paper.authorships.find((a) => a.isCorresponding) ??
            registration.paper.authorships[0];
          if (!author?.email) continue;

          const sent = await enqueueDirect(boss, {
            templateKey: 'registration.early_bird_ending',
            to: author.email,
            context: {
              paperTitle: registration.paper.title,
              earlyBirdEndsAt: earlyBirdEndsAt.toISOString(),
            },
            organizationId: registration.organizationId,
            conferenceId: registration.conferenceId,
            idempotencyKey: `early-bird-${registration.id}`,
            relatedEntity: 'Registration',
            relatedEntityId: registration.id,
          });
          if (sent) enqueued += 1;
        }
      }
    }
  }

  return { enqueued };
}
