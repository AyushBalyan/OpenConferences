import { Injectable } from '@nestjs/common';
import type { TransactionClient } from '../common/types/transaction-client';

export type CoiCheckResult = {
  hasConflict: boolean;
  reason?: 'AUTHORSHIP' | 'DECLARED_COI' | 'CONFLICT_BID';
};

@Injectable()
export class CoiCheckService {
  async checkReviewerPaperConflict(
    tx: TransactionClient,
    reviewerUserId: string,
    paperId: string,
    conferenceId: string,
  ): Promise<CoiCheckResult> {
    const authorship = await tx.authorship.findFirst({
      where: { paperId, userId: reviewerUserId },
    });

    if (authorship) {
      return { hasConflict: true, reason: 'AUTHORSHIP' };
    }

    const paper = await tx.paper.findFirst({
      where: { id: paperId, conferenceId },
      include: { authorships: true },
    });

    if (!paper) {
      return { hasConflict: false };
    }

    const authorUserIds = paper.authorships
      .map((a) => a.userId)
      .filter((id): id is string => id !== null);

    const declaredCoi = await tx.conflictOfInterest.findFirst({
      where: {
        conferenceId,
        userId: reviewerUserId,
        OR: [
          { paperId },
          ...(authorUserIds.length > 0 ? [{ withUserId: { in: authorUserIds } }] : []),
        ],
      },
    });

    if (declaredCoi) {
      return { hasConflict: true, reason: 'DECLARED_COI' };
    }

    return { hasConflict: false };
  }
}
