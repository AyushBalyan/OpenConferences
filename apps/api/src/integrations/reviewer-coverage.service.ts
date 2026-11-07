import { Injectable } from '@nestjs/common';
import { withTenantContext } from '@openconferences/db';
import { effectiveReviewDeadline } from '@openconferences/schemas';
import { IntegrationStore } from './integration.store';
import type { IntegrationPrincipal } from './integration.security';
@Injectable()
export class ReviewerCoverageService {
  constructor(private readonly store: IntegrationStore) {}
  async summary(p: IntegrationPrincipal, query: { cursor?: string; limit: number }) {
    return withTenantContext(
      p,
      async (tx) => {
        const conference = await this.store.authorizeOperation(
          tx,
          p,
          ['analytics:read', 'assignments:read', 'papers:read', 'reviewers:read'],
          false,
        );
        const now = new Date();
        const papers = await tx.paper.findMany({
          where: { conferenceId: p.conferenceId, status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } },
          orderBy: { id: 'asc' },
          select: {
            id: true,
            submissionNumber: true,
            reviewRounds: {
              orderBy: { roundNumber: 'desc' },
              take: 1,
              select: {
                id: true,
                reviewDueAt: true,
                reviewsReleasedAt: true,
                decisions: { select: { id: true } },
                assignments: {
                  where: { status: { notIn: ['DECLINED', 'REPLACED'] } },
                  select: {
                    status: true,
                    createdAt: true,
                    dueAt: true,
                    review: { select: { submittedAt: true } },
                  },
                },
              },
            },
          },
        });
        const all = papers.flatMap((paper) => {
          const cycle = paper.reviewRounds[0];
          if (cycle?.reviewsReleasedAt || cycle?.decisions.length) return [];
          const assignments = cycle?.assignments ?? [];
          const submitted = assignments.filter((a) => a.review?.submittedAt).length;
          const inconsistent = assignments.filter(
            (a) => a.status === 'COMPLETED' && !a.review?.submittedAt,
          ).length;
          const overdue = assignments.filter(
            (a) =>
              !a.review?.submittedAt &&
              a.status !== 'COMPLETED' &&
              effectiveReviewDeadline(a, cycle?.reviewDueAt, conference.reviewDueAt) < now,
          ).length;
          return [
            {
              paperId: paper.id,
              submissionNumber: paper.submissionNumber,
              cycleId: cycle?.id ?? null,
              activeReviewers: assignments.length,
              submittedReviews: submitted,
              overdueAssignments: overdue,
              inconsistentAssignments: inconsistent,
              overdueOnly:
                assignments.length > 0 && submitted === 0 && overdue === assignments.length,
            },
          ];
        });
        const zeroActive = all.filter((row) => row.activeReviewers === 0).length;
        const overdueOnly = all.filter((row) => row.overdueOnly).length;
        const selected = all.filter((row) => !query.cursor || row.paperId > query.cursor);
        const page = selected.slice(0, query.limit);
        return {
          observedAt: now.toISOString(),
          definitionVersion: '1',
          eligiblePapers: all.length,
          zeroActive,
          oneActive: all.filter((row) => row.activeReviewers === 1).length,
          twoOrMoreActive: all.filter((row) => row.activeReviewers >= 2).length,
          overdueOnly,
          operationallyUncovered: zeroActive + overdueOnly,
          data: page,
          nextCursor: selected.length > query.limit ? page.at(-1)!.paperId : null,
        };
      },
      { isolationLevel: 'RepeatableRead', timeout: 10000 },
    );
  }
}
