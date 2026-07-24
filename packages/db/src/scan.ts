import { generateId, withTenantContext } from './index.js';
import type { FileScanStatus } from '@prisma/client';

export type ApplyScanResultInput = {
  fileAssetId: string;
  paperVersionId: string;
  paperId: string;
  scanStatus: FileScanStatus;
};

export type ApplyScanResultOutcome = {
  activatedCameraReady: boolean;
};

/**
 * Apply AV scan result: link currentVersion when CLEAN; leave quarantined when INFECTED.
 * Clean camera-ready versions also advance paper status to CAMERA_READY.
 */
export async function applyScanResult(
  input: ApplyScanResultInput,
): Promise<ApplyScanResultOutcome> {
  return withTenantContext({}, async (tx) => {
    const version = await tx.paperVersion.findFirst({
      where: { id: input.paperVersionId },
      select: { kind: true },
    });

    await tx.fileAsset.update({
      where: { id: input.fileAssetId },
      data: { scanStatus: input.scanStatus },
    });

    if (input.scanStatus !== 'CLEAN') {
      return { activatedCameraReady: false };
    }

    const isCameraReady = version?.kind === 'CAMERA_READY';

    await tx.paper.update({
      where: { id: input.paperId },
      data: {
        currentVersionId: input.paperVersionId,
        ...(isCameraReady ? { status: 'CAMERA_READY', version: { increment: 1 } } : {}),
      },
    });

    return { activatedCameraReady: isCameraReady };
  });
}

export { generateId };
