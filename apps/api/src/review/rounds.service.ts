import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { RoleKind, ReviewRound } from '@openconferences/db';
import { generateId, withTenantContext } from '@openconferences/db';
import type { CreateReviewRoundInput, UpdateReviewRoundInput } from '@openconferences/schemas';
import {
  paginateItems,
  prismaCursorArgs,
  resolveLimit,
  type CursorPaginationOptions,
} from '../common/pagination/cursor';
import { assertScope } from '../common/scope/assert-scope';
import { AuditService } from '../audit/audit.service';
import { ConferenceService } from '../tenancy/conference.service';
import { canCoordinateReview } from '../tenancy/role-hierarchy';
import { mapReviewRound } from './review.mapper';

const ALLOWED_TRANSITIONS: Record<
  'OPEN' | 'REVIEWING' | 'REBUTTAL' | 'DECIDING' | 'CLOSED',
  Array<'OPEN' | 'REVIEWING' | 'REBUTTAL' | 'DECIDING' | 'CLOSED'>
> = {
  OPEN: ['REVIEWING', 'CLOSED'],
  REVIEWING: ['REBUTTAL', 'DECIDING', 'CLOSED'],
  REBUTTAL: ['DECIDING', 'CLOSED'],
  DECIDING: ['CLOSED'],
  CLOSED: [],
};

@Injectable()
export class RoundsService {
  constructor(
    private readonly conferences: ConferenceService,
    private readonly audit: AuditService,
  ) {}

  async list(
    userId: string,
    conferenceId: string,
    roles: RoleKind[],
    options: CursorPaginationOptions = {},
  ) {
    const conference = await this.conferences.loadConference(userId, conferenceId, roles);
    const limit = resolveLimit(options.limit);

    const rows = await withTenantContext(
      { userId, conferenceId, organizationId: conference.organizationId },
      async (tx) =>
        tx.reviewRound.findMany({
          where: { conferenceId },
          orderBy: { roundNumber: 'asc' },
          ...prismaCursorArgs(options, limit),
        }),
    );

    const page = paginateItems(rows, limit, (row) => row.id);

    return {
      data: page.data.map(mapReviewRound),
      nextCursor: page.nextCursor,
    };
  }

  async create(
    userId: string,
    conferenceId: string,
    input: CreateReviewRoundInput,
    roles: RoleKind[],
  ) {
    if (!canCoordinateReview(roles)) {
      throw new ForbiddenException('Insufficient permissions to open review rounds');
    }

    const conference = await this.conferences.loadConference(userId, conferenceId, roles);

    try {
      const round = await withTenantContext(
        { userId, conferenceId, organizationId: conference.organizationId, bypass: true },
        async (tx) => {
          await tx.reviewRound.updateMany({
            where: {
              conferenceId,
              status: { not: 'CLOSED' },
            },
            data: {
              status: 'CLOSED',
              version: { increment: 1 },
            },
          });

          return tx.reviewRound.create({
            data: {
              id: generateId(),
              organizationId: conference.organizationId,
              conferenceId,
              roundNumber: input.roundNumber ?? 1,
              status: 'OPEN',
              reviewDueAt: input.reviewDueAt ? new Date(input.reviewDueAt) : conference.reviewDueAt,
              rebuttalDueAt: input.rebuttalDueAt
                ? new Date(input.rebuttalDueAt)
                : conference.rebuttalDueAt,
              revisionDueAt: input.revisionDueAt ? new Date(input.revisionDueAt) : null,
            },
          });
        },
      );

      await this.audit.log({
        actorUserId: userId,
        organizationId: conference.organizationId,
        conferenceId,
        action: 'review_round.opened',
        entity: 'ReviewRound',
        entityId: round.id,
        diff: { roundNumber: round.roundNumber },
      });

      return mapReviewRound(round);
    } catch (error) {
      if (error instanceof Error && error.message.includes('Unique constraint')) {
        throw new ConflictException('A round with this number already exists');
      }
      throw error;
    }
  }

  async update(
    userId: string,
    conferenceId: string,
    roundId: string,
    input: UpdateReviewRoundInput,
    roles: RoleKind[],
  ) {
    if (!canCoordinateReview(roles)) {
      throw new ForbiddenException('Insufficient permissions to update review rounds');
    }

    const conference = await this.conferences.loadConference(userId, conferenceId, roles);
    const round = await this.loadRound(userId, conferenceId, roundId, roles);

    if (input.version !== round.version) {
      throw new ConflictException('Review round was modified by another request');
    }

    if (input.status && input.status !== round.status) {
      const allowed = ALLOWED_TRANSITIONS[round.status];
      if (!allowed.includes(input.status)) {
        throw new ConflictException(
          `Cannot transition round from ${round.status} to ${input.status}`,
        );
      }
    }

    const updated = await withTenantContext(
      { userId, conferenceId, organizationId: conference.organizationId, bypass: true },
      async (tx) =>
        tx.reviewRound.update({
          where: { id: roundId },
          data: {
            ...(input.status !== undefined ? { status: input.status } : {}),
            ...(input.reviewDueAt !== undefined
              ? { reviewDueAt: input.reviewDueAt ? new Date(input.reviewDueAt) : null }
              : {}),
            ...(input.rebuttalDueAt !== undefined
              ? { rebuttalDueAt: input.rebuttalDueAt ? new Date(input.rebuttalDueAt) : null }
              : {}),
            ...(input.revisionDueAt !== undefined
              ? { revisionDueAt: input.revisionDueAt ? new Date(input.revisionDueAt) : null }
              : {}),
            version: { increment: 1 },
          },
        }),
    );

    await this.audit.log({
      actorUserId: userId,
      organizationId: conference.organizationId,
      conferenceId,
      action: 'review_round.updated',
      entity: 'ReviewRound',
      entityId: roundId,
      diff: input,
    });

    return mapReviewRound(updated);
  }

  async loadRound(
    userId: string,
    conferenceId: string,
    roundId: string,
    roles: RoleKind[],
  ): Promise<ReviewRound> {
    await this.conferences.loadConference(userId, conferenceId, roles);

    const round = await withTenantContext({ userId, conferenceId }, async (tx) =>
      tx.reviewRound.findFirst({ where: { id: roundId } }),
    );

    if (!round) {
      throw new NotFoundException('Review round not found');
    }

    assertScope(round, { conferenceId });
    return round;
  }
}
