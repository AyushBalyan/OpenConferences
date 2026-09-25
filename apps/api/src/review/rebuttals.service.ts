import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { RoleKind } from '@openconferences/db';
import { generateId, withTenantContext } from '@openconferences/db';
import type { RebuttalDto, SubmitRebuttalInput } from '@openconferences/schemas';
import { assertScope } from '../common/scope/assert-scope';
import { AuditService } from '../audit/audit.service';
import { ConferenceService } from '../tenancy/conference.service';
import { canCoordinateReview } from '../tenancy/role-hierarchy';
import { mapRebuttal } from './review.mapper';
import { lockReviewRound } from './rounds.service';

@Injectable()
export class RebuttalsService {
  constructor(
    private readonly conferences: ConferenceService,
    private readonly audit: AuditService,
  ) {}

  async getRebuttal(
    userId: string,
    conferenceId: string,
    paperId: string,
    roles: RoleKind[],
    roundId?: string,
  ): Promise<RebuttalDto | null> {
    const conference = await this.conferences.loadConference(userId, conferenceId, roles);
    const paper = await this.loadPaper(userId, conferenceId, paperId);

    const targetRoundId =
      roundId ?? (await this.resolveRebuttalRound(userId, conferenceId, paperId));

    if (!targetRoundId) {
      return null;
    }

    const rebuttal = await withTenantContext(
      { userId, conferenceId, organizationId: conference.organizationId },
      async (tx) =>
        tx.rebuttal.findUnique({
          where: { paperId_roundId: { paperId, roundId: targetRoundId } },
        }),
    );

    if (!rebuttal) {
      return null;
    }

    const canRead =
      canCoordinateReview(roles) ||
      this.isCorrespondingAuthor(paper, userId) ||
      (await this.isAssignedReviewer(userId, conferenceId, paperId, targetRoundId));

    if (!canRead) {
      throw new ForbiddenException('Insufficient permissions to view rebuttal');
    }

    return mapRebuttal(rebuttal);
  }

  async submitRebuttal(
    userId: string,
    conferenceId: string,
    paperId: string,
    input: SubmitRebuttalInput,
    roles: RoleKind[],
  ): Promise<{ rebuttal: RebuttalDto; message: string }> {
    const conference = await this.conferences.loadConference(userId, conferenceId, roles);
    const paper = await this.loadPaper(userId, conferenceId, paperId);

    if (!this.isCorrespondingAuthor(paper, userId)) {
      throw new ForbiddenException('Only the corresponding author may submit a rebuttal');
    }

    const roundId = await this.resolveRebuttalRound(userId, conferenceId, paperId);

    if (!roundId) {
      throw new ConflictException('No rebuttal window is open for this paper');
    }

    const round = await withTenantContext({ userId, conferenceId }, async (tx) =>
      tx.reviewRound.findFirst({ where: { id: roundId } }),
    );

    if (!round?.reviewsReleasedAt) {
      throw new ConflictException('Rebuttal window is not open');
    }
    if (round.rebuttalDueAt && new Date() > round.rebuttalDueAt) {
      throw new ConflictException('Rebuttal deadline has passed');
    }

    const releasedReviewCount = await withTenantContext({ userId, conferenceId }, async (tx) =>
      tx.review.count({
        where: {
          paperId,
          roundId,
          visibility: 'AUTHOR_VISIBLE',
          submittedAt: { not: null },
        },
      }),
    );

    if (releasedReviewCount === 0) {
      throw new ConflictException('Reviews must be released before submitting a rebuttal');
    }

    const existing = await withTenantContext({ userId, conferenceId }, async (tx) =>
      tx.rebuttal.findUnique({
        where: { paperId_roundId: { paperId, roundId } },
      }),
    );

    if (existing && input.version !== existing.version) {
      throw this.versionConflict();
    }

    const rebuttal = await withTenantContext(
      { userId, conferenceId, organizationId: conference.organizationId },
      async (tx) => {
        const lockedRound = await lockReviewRound(tx, conferenceId, roundId);
        const decision = await tx.decision.findFirst({
          where: { roundId, conferenceId },
          select: { id: true },
        });
        if (!lockedRound.reviewsReleasedAt || decision) {
          throw new ConflictException({
            code: 'REBUTTAL_PHASE_LOCKED',
            message: 'Rebuttal window is not open',
          });
        }
        if (lockedRound.rebuttalDueAt && new Date() > lockedRound.rebuttalDueAt) {
          throw new ConflictException({
            code: 'REBUTTAL_PHASE_LOCKED',
            message: 'Rebuttal deadline has passed',
          });
        }
        if (existing) {
          const updated = await tx.rebuttal.updateMany({
            where: { id: existing.id, conferenceId, paperId, roundId, version: input.version },
            data: {
              body: input.body,
              submittedAt: new Date(),
              version: { increment: 1 },
            },
          });
          if (updated.count !== 1) throw this.versionConflict();
          return tx.rebuttal.findUniqueOrThrow({ where: { id: existing.id } });
        }

        if (input.version != null && input.version !== 0) {
          throw this.versionConflict();
        }

        const created = await tx.rebuttal.createMany({
          skipDuplicates: true,
          data: {
            id: generateId(),
            organizationId: conference.organizationId,
            conferenceId,
            paperId,
            roundId,
            authoredByUserId: userId,
            body: input.body,
            submittedAt: new Date(),
          },
        });
        if (created.count !== 1) throw this.versionConflict();
        return tx.rebuttal.findUniqueOrThrow({ where: { paperId_roundId: { paperId, roundId } } });
      },
    );

    await this.audit.log({
      actorUserId: userId,
      organizationId: conference.organizationId,
      conferenceId,
      action: 'rebuttal.submitted',
      entity: 'Rebuttal',
      entityId: rebuttal.id,
      diff: { paperId, roundId },
    });

    return {
      rebuttal: mapRebuttal(rebuttal),
      message: 'Rebuttal submitted successfully',
    };
  }

  private versionConflict() {
    return new ConflictException({
      code: 'REBUTTAL_VERSION_CONFLICT',
      message: 'Rebuttal was modified by another request. Refresh before submitting again.',
    });
  }

  private async loadPaper(userId: string, conferenceId: string, paperId: string) {
    const paper = await withTenantContext({ userId, conferenceId }, async (tx) =>
      tx.paper.findFirst({
        where: { id: paperId, conferenceId },
        include: { authorships: true },
      }),
    );

    if (!paper) {
      throw new NotFoundException('Paper not found');
    }

    assertScope(paper, { conferenceId });
    return paper;
  }

  private isCorrespondingAuthor(
    paper: {
      submittedById: string;
      authorships: Array<{ userId: string | null; isCorresponding: boolean }>;
    },
    userId: string,
  ): boolean {
    if (paper.submittedById === userId) {
      return true;
    }

    return paper.authorships.some((a) => a.isCorresponding && a.userId === userId);
  }

  private async resolveRebuttalRound(
    userId: string,
    conferenceId: string,
    paperId: string,
  ): Promise<string | null> {
    const round = await withTenantContext({ userId, conferenceId }, async (tx) =>
      tx.reviewRound.findFirst({
        where: {
          conferenceId,
          paperId,
          reviewsReleasedAt: { not: null },
          decisions: { none: {} },
          reviews: { some: { paperId, visibility: 'AUTHOR_VISIBLE' } },
        },
        orderBy: { roundNumber: 'desc' },
      }),
    );

    return round?.id ?? null;
  }

  private async isAssignedReviewer(
    userId: string,
    conferenceId: string,
    paperId: string,
    roundId: string,
  ): Promise<boolean> {
    const assignment = await withTenantContext({ userId, conferenceId }, async (tx) =>
      tx.reviewerAssignment.findFirst({
        where: { conferenceId, paperId, roundId, reviewerUserId: userId },
      }),
    );

    return assignment != null;
  }
}
