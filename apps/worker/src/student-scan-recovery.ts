import type PgBoss from 'pg-boss';
import { withTenantContext, prismaQueueAdapter } from '@openconferences/db';
import { FILE_SCAN_JOB_NAME } from '@openconferences/schemas';

/** Recover stranded proof scans, including jobs exhausted before the scanner fix. */
export async function recoverStudentScans(boss: Pick<PgBoss, 'send'>) {
  return withTenantContext(
    {},
    async (tx) => {
      const proofs = await tx.studentVerification.findMany({
        where: {
          status: { in: ['PENDING', 'CLARIFICATION_REQUESTED'] },
          fileAsset: {
            scanStatus: 'PENDING_SCAN',
            createdAt: { lt: new Date(Date.now() - 5 * 60_000) },
          },
          registration: { status: { in: ['PENDING', 'AWAITING_VERIFICATION'] } },
        },
        include: { fileAsset: true, registration: true },
        orderBy: { submittedAt: 'asc' },
        take: 100,
      });
      let queued = 0;
      for (const proof of proofs) {
        const job = await boss.send(
          FILE_SCAN_JOB_NAME,
          {
            fileAssetId: proof.fileAssetId,
            paperVersionId: proof.fileAssetId,
            paperId: proof.registration.paperId,
            organizationId: proof.organizationId,
            conferenceId: proof.registration.conferenceId,
            originalFilename: proof.fileAsset.originalFilename,
          },
          {
            db: prismaQueueAdapter(tx),
            singletonKey: proof.fileAssetId,
            retryLimit: 5,
            retryDelay: 30,
            retryBackoff: true,
          },
        );
        if (job) queued++;
      }
      return queued;
    },
    { timeout: 30000 },
  );
}
