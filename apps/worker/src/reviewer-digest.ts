import type PgBoss from 'pg-boss';
import {
  generateId,
  prismaQueueAdapter,
  validateDigestTargets,
  withTenantContext,
  type Prisma,
} from '@openconferences/db';
import { NOTIFICATION_SEND_JOB_NAME, reviewerDigestSnapshotSchema } from '@openconferences/schemas';

/** Durable relay: revalidate under the review-cycle locks and atomically create the log + email job. */
export async function processReviewerDigestJob(
  boss: Pick<PgBoss, 'send'>,
  payload: { digestId: string; requestId: string },
) {
  return withTenantContext(
    {},
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM reviewer_reminder_digests WHERE id=${payload.digestId}::uuid FOR UPDATE`;
      const digest = await tx.reviewerReminderDigest.findUnique({
        where: { id: payload.digestId },
      });
      if (!digest || digest.status !== 'PREPARING' || digest.requestId !== payload.requestId)
        return;
      const snapshot = reviewerDigestSnapshotSchema.parse(digest.snapshot);
      const cycles = [...new Set(snapshot.items.map((i) => i.roundId))].sort();
      await tx.$queryRaw`SELECT public.app_lock_digest_cycles(${digest.conferenceId}::uuid,${cycles}::uuid[])::text`;
      const cancel = async (status: 'CANCELLED' | 'SUPPRESSED', error: string) => {
        await tx.reviewerReminderDigest.update({
          where: { id: digest.id },
          data: { status, error },
        });
        await tx.auditLog.createMany({
          data: {
            id: generateId(),
            actorUserId: digest.requestedById,
            organizationId: digest.organizationId,
            conferenceId: digest.conferenceId,
            action: `reviewer.digest_${status.toLowerCase()}`,
            entity: 'ReviewerReminderDigest',
            entityId: digest.id,
            diff: { reason: error, requestId: digest.requestId },
          },
        });
      };
      let current;
      try {
        current = await validateDigestTargets(
          tx,
          digest.conferenceId,
          digest.reviewerUserId,
          snapshot.items,
        );
      } catch (e) {
        await cancel('CANCELLED', e instanceof Error ? e.message : 'Assignments changed');
        return;
      }
      if (
        current.member.email.trim().toLowerCase() !== snapshot.recipient ||
        current.member.name !== snapshot.reviewerName ||
        current.conferenceName !== snapshot.conferenceName ||
        current.items.some((item, i) => {
          const old = snapshot.items[i];
          return (
            !old ||
            item.id !== old.id ||
            item.dueAt !== old.dueAt ||
            item.paperTitle !== old.paperTitle ||
            item.submissionNumber !== old.submissionNumber
          );
        })
      ) {
        await cancel(
          'CANCELLED',
          'Reviewer, paper details or deadlines changed after the preview. Preview a new reminder.',
        );
        return;
      }
      if (await tx.emailSuppression.findUnique({ where: { email: snapshot.recipient } })) {
        await cancel('SUPPRESSED', 'Recipient is suppressed');
        return;
      }
      const logId = generateId();
      const idempotencyKey = `reviewer-digest-${digest.id}`;
      await tx.notificationLog.create({
        data: {
          id: logId,
          organizationId: digest.organizationId,
          conferenceId: digest.conferenceId,
          templateKey: 'reviewer.reminder_digest',
          templateVersion: snapshot.templateVersion,
          toEmail: snapshot.recipient,
          subject: snapshot.subject,
          renderedHtml: snapshot.html,
          status: 'QUEUED',
          idempotencyKey,
          relatedEntity: 'ReviewerReminderDigest',
          relatedEntityId: digest.id,
        },
      });
      const jobId = await boss.send(
        NOTIFICATION_SEND_JOB_NAME,
        {
          logId,
          to: snapshot.recipient,
          subject: snapshot.subject,
          html: snapshot.html,
          text: snapshot.text,
          idempotencyKey,
        },
        {
          db: prismaQueueAdapter(tx),
          singletonKey: idempotencyKey,
          retryLimit: 5,
          retryDelay: 30,
          retryBackoff: true,
        },
      );
      if (!jobId) throw new Error('Email queue rejected the digest handoff');
      await tx.reviewerReminderDigest.update({
        where: { id: digest.id },
        data: { status: 'QUEUED', notificationLogId: logId, error: null },
      });
      await tx.auditLog.createMany({
        data: {
          id: generateId(),
          actorUserId: digest.requestedById,
          organizationId: digest.organizationId,
          conferenceId: digest.conferenceId,
          entity: 'ReviewerReminderDigest',
          entityId: digest.id,
          action: 'reviewer.digest_queued',
          diff: {
            notificationLogId: logId,
            requestId: digest.requestId,
            assignmentIds: snapshot.items.map((i) => i.id),
          } as Prisma.InputJsonValue,
        },
      });
    },
    { timeout: 15000 },
  );
}

export async function recordDigestFailure(
  payload: { digestId: string; requestId: string },
  err: unknown,
  terminal: boolean,
) {
  await withTenantContext({}, (tx) =>
    tx.reviewerReminderDigest.updateMany({
      where: { id: payload.digestId, requestId: payload.requestId, status: 'PREPARING' },
      data: {
        error: err instanceof Error ? err.message : 'Reminder preparation failed',
        ...(terminal ? { status: 'FAILED' } : {}),
      },
    }),
  );
}
