import {
  withTenantContext,
  processInvitationBatchChunk,
  recordInvitationChange,
} from '@openconferences/db';
import { getConfig } from '@openconferences/config/env';
export async function processInvitationBatchJob(batchId: string) {
  for (;;) {
    const result = await withTenantContext(
      {},
      (tx) => processInvitationBatchChunk(tx, batchId, getConfig().auth.secret),
      { timeout: 15000 },
    );
    if (result.done) return result;
  }
}
export async function sweepInvitationLifecycle() {
  const now = new Date();
  const rows = await withTenantContext({}, (tx) =>
    tx.reviewerInvitation.findMany({
      where: { status: 'PENDING', revokedAt: null, expiresAt: { lte: now } },
      select: { id: true, conferenceId: true },
      take: 100,
      orderBy: { expiresAt: 'asc' },
    }),
  );
  for (const candidate of rows)
    await withTenantContext({ conferenceId: candidate.conferenceId }, async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`invitation-changes:${candidate.conferenceId}`},0))::text`;
      await tx.$queryRaw`SELECT id FROM reviewer_invitations WHERE id=${candidate.id}::uuid FOR UPDATE`;
      const current = await tx.reviewerInvitation.findUnique({ where: { id: candidate.id } });
      if (!current || current.status !== 'PENDING' || current.revokedAt || current.expiresAt > now)
        return;
      const updated = await tx.reviewerInvitation.update({
        where: { id: current.id },
        data: { status: 'EXPIRED', version: { increment: 1 } },
      });
      await recordInvitationChange(tx, updated, 'EXPIRED');
    });
  await withTenantContext({}, (tx) =>
    tx.reviewerInvitationBatch.updateMany({
      where: { expiresAt: { lte: now }, inputEncrypted: { not: '' } },
      data: { inputEncrypted: '' },
    }),
  );
  return { expired: rows.length };
}
