import { ConflictException, NotFoundException } from '@nestjs/common';
import { isCfpOpen, type CfpWindow } from '@openconferences/schemas';
import type { Prisma } from '@openconferences/db';

export function assertCfpOpen(conference: CfpWindow): void {
  if (!isCfpOpen(conference))
    throw new ConflictException('The call for papers is closed or has not opened yet');
}

/** Serialize a submission write with manual closure and recheck the cutoff after lock waits. */
export async function lockOpenCfp(
  tx: Prisma.TransactionClient,
  conferenceId: string,
): Promise<CfpWindow> {
  const [conference] = await tx.$queryRaw<CfpWindow[]>`
    SELECT status, "cfpOpensAt", "cfpClosesAt" FROM conferences
    WHERE id = ${conferenceId}::uuid AND "deletedAt" IS NULL FOR SHARE
  `;
  if (!conference) throw new NotFoundException('Conference not found');
  assertCfpOpen(conference);
  return conference;
}
