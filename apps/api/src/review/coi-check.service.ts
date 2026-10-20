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
    const paper = await tx.paper.findFirst({
      where: { id: paperId, conferenceId },
      select: {
        submittedById: true,
        authorships: { select: { userId: true, email: true } },
      },
    });

    if (!paper) return { hasConflict: false };

    if (
      paper.submittedById === reviewerUserId ||
      paper.authorships.some((a) => a.userId === reviewerUserId)
    ) {
      return { hasConflict: true, reason: 'AUTHORSHIP' };
    }

    // Coauthors can be entered by email before they have a linked account.
    // Match their registered address in every path that uses this shared check.
    const reviewer = await tx.user.findUnique({
      where: { id: reviewerUserId },
      select: { email: true },
    });
    const email = reviewer?.email.trim().toLowerCase();
    if (email && paper.authorships.some((a) => a.email.trim().toLowerCase() === email)) {
      return { hasConflict: true, reason: 'AUTHORSHIP' };
    }

    const authorUserIds = [
      ...new Set([
        paper.submittedById,
        ...paper.authorships.map((a) => a.userId).filter((id): id is string => id !== null),
      ]),
    ];

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
