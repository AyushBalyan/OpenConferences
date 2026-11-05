import { Prisma, type FileScanStatus } from '@prisma/client';
import { generateId, withTenantContext } from './index.js';

export type ApplyScanResultInput = {
  fileAssetId: string;
  paperVersionId: string;
  paperId: string;
  scanStatus: FileScanStatus;
};

export type ApplyScanResultOutcome = {
  activatedCameraReady: boolean;
  openedRevisionCycle: boolean;
};

const REVISION_OUTCOMES = new Set(['MINOR_REVISION', 'MAJOR_REVISION']);

/**
 * Apply AV scan result: link currentVersion when CLEAN; leave quarantined when INFECTED.
 * Clean camera-ready versions also advance paper status to CAMERA_READY.
 * The first clean revision for a paper opens that paper's next review cycle.
 */
export async function applyScanResult(
  input: ApplyScanResultInput,
  onRevision?: (tx: Prisma.TransactionClient) => Promise<void>,
): Promise<ApplyScanResultOutcome> {
  return withTenantContext({}, (tx) => applyScanResultInTransaction(tx, input, onRevision));
}

export async function applyScanResultInTransaction(
  tx: Prisma.TransactionClient,
  input: ApplyScanResultInput,
  onRevision?: (tx: Prisma.TransactionClient) => Promise<void>,
): Promise<ApplyScanResultOutcome> {
  const version = await tx.paperVersion.findFirst({
    where: { id: input.paperVersionId },
    select: { kind: true, versionNumber: true },
  });

  await tx.fileAsset.update({
    where: { id: input.fileAssetId },
    data: { scanStatus: input.scanStatus },
  });

  if (input.scanStatus !== 'CLEAN') {
    return { activatedCameraReady: false, openedRevisionCycle: false };
  }

  // Student proof is a standalone asset, not a manuscript version. Legacy
  // queued jobs use the asset ID in paperVersionId. Never activate it as a PDF.
  if (!version) {
    const proof = await tx.studentVerification.findFirst({
      where: { fileAssetId: input.fileAssetId, registration: { paperId: input.paperId } },
    });
    if (!proof) throw new Error('Scan job does not identify a manuscript or student document');
    return { activatedCameraReady: false, openedRevisionCycle: false };
  }
  const isRevision = version.kind === 'REVISION';
  if (isRevision) {
    const latestRevision = await tx.paperVersion.findFirst({
      where: { paperId: input.paperId, kind: 'REVISION' },
      orderBy: [{ versionNumber: 'desc' }, { createdAt: 'desc' }],
      select: { id: true },
    });
    if (!latestRevision || latestRevision.id !== input.paperVersionId) {
      return { activatedCameraReady: false, openedRevisionCycle: false };
    }
  }

  const isCameraReady = version?.kind === 'CAMERA_READY';

  await tx.paper.update({
    where: { id: input.paperId },
    data: {
      currentVersionId: input.paperVersionId,
      ...(isCameraReady ? { status: 'CAMERA_READY', version: { increment: 1 } } : {}),
    },
  });

  const openedRevisionCycle = isRevision ? await openRevisionCycle(tx, input.paperId) : false;

  if (openedRevisionCycle && onRevision) await onRevision(tx);
  return { activatedCameraReady: isCameraReady, openedRevisionCycle };
}

async function openRevisionCycle(tx: Prisma.TransactionClient, paperId: string): Promise<boolean> {
  const latest = await tx.reviewRound.findFirst({
    where: { paperId },
    orderBy: { roundNumber: 'desc' },
    include: { decisions: { take: 1 } },
  });
  const outcome = latest?.decisions[0]?.outcome;
  if (!latest || !outcome || !REVISION_OUTCOMES.has(outcome)) {
    return false;
  }

  const conference = await tx.conference.findUniqueOrThrow({
    where: { id: latest.conferenceId },
    select: { reviewDueAt: true, rebuttalDueAt: true },
  });

  try {
    await tx.reviewRound.create({
      data: {
        id: generateId(),
        organizationId: latest.organizationId,
        conferenceId: latest.conferenceId,
        paperId,
        roundNumber: latest.roundNumber + 1,
        reviewDueAt: conference.reviewDueAt,
        rebuttalDueAt: conference.rebuttalDueAt,
        revisionDueAt: latest.revisionDueAt,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return false;
    }
    throw error;
  }

  return true;
}

export { generateId };
