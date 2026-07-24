import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { RoleKind } from '@openconferences/db';
import { generateId, withTenantContext } from '@openconferences/db';
import type {
  DeclareCoiInput,
  UpsertBidInput,
  BlindedPaperPoolItemDto,
} from '@openconferences/schemas';
import {
  paginateItems,
  prismaCursorArgs,
  resolveLimit,
  type CursorPaginationOptions,
} from '../common/pagination/cursor';
import { assertScope } from '../common/scope/assert-scope';
import { AuditService } from '../audit/audit.service';
import { ConferenceService } from '../tenancy/conference.service';
import { CoiCheckService } from './coi-check.service';
import {
  blindAuthorships,
  isPrivilegedReader,
  mapOversightAuthorships,
  mapBid,
  mapConflictOfInterest,
} from './review.mapper';

@Injectable()
export class BidsService {
  constructor(
    private readonly conferences: ConferenceService,
    private readonly coiCheck: CoiCheckService,
  ) {}

  async list(
    userId: string,
    conferenceId: string,
    roles: RoleKind[],
    options: { limit?: number; cursor?: string; paperId?: string; reviewerUserId?: string },
  ) {
    if (!isPrivilegedReader(roles)) {
      throw new ForbiddenException('Insufficient permissions to list all bids');
    }

    const conference = await this.conferences.loadConference(userId, conferenceId, roles);
    const limit = options.limit ?? 50;

    const bids = await withTenantContext(
      { userId, conferenceId, organizationId: conference.organizationId },
      async (tx) =>
        tx.bid.findMany({
          where: {
            conferenceId,
            ...(options.paperId ? { paperId: options.paperId } : {}),
            ...(options.reviewerUserId ? { reviewerUserId: options.reviewerUserId } : {}),
          },
          include: {
            paper: { select: { title: true } },
            reviewer: { select: { name: true, email: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: limit + 1,
          ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
        }),
    );

    const hasMore = bids.length > limit;
    const data = hasMore ? bids.slice(0, limit) : bids;

    return {
      data: data.map((bid) => ({
        ...mapBid(bid),
        paperTitle: bid.paper.title,
        reviewerName: bid.reviewer.name,
        reviewerEmail: bid.reviewer.email,
      })),
      nextCursor: hasMore ? (data[data.length - 1]?.id ?? null) : null,
    };
  }

  async getPaperPool(
    userId: string,
    conferenceId: string,
    roles: RoleKind[],
    options: { limit?: number; cursor?: string },
  ): Promise<{
    data: BlindedPaperPoolItemDto[];
    nextCursor: string | null;
    blindingMode: 'SINGLE' | 'DOUBLE' | 'OPEN';
    mode: 'reviewer' | 'oversight';
  }> {
    const oversight = isPrivilegedReader(roles);
    const canBid = roles.includes('REVIEWER');

    if (!oversight && !canBid) {
      throw new ForbiddenException('Reviewer or coordinator role required');
    }

    const conference = await this.conferences.loadConference(userId, conferenceId, roles);
    if (!oversight) {
      this.assertBiddingOpen(conference);
    }

    const limit = options.limit ?? 20;

    const papers = await withTenantContext(
      { userId, conferenceId, organizationId: conference.organizationId },
      async (tx) =>
        tx.paper.findMany({
          where: {
            conferenceId,
            status: { in: ['SUBMITTED', 'UNDER_REVIEW'] },
            ...(canBid && !oversight ? { NOT: { authorships: { some: { userId } } } } : {}),
          },
          include: {
            authorships: { orderBy: { order: 'asc' } },
            bids: oversight
              ? {
                  include: {
                    reviewer: { select: { name: true, email: true } },
                  },
                }
              : { where: { reviewerUserId: userId } },
          },
          orderBy: { createdAt: 'desc' },
          take: limit + 1,
          ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
        }),
    );

    const hasMore = papers.length > limit;
    const data = hasMore ? papers.slice(0, limit) : papers;

    return {
      mode: oversight ? 'oversight' : 'reviewer',
      data: data.map((paper) => ({
        id: paper.id,
        title: paper.title,
        abstract: paper.abstract,
        keywords: paper.keywords,
        trackId: paper.trackId,
        status: paper.status,
        authorships: oversight
          ? mapOversightAuthorships(paper.authorships)
          : blindAuthorships(conference.blindingMode, paper.authorships),
        myBid: canBid
          ? oversight
            ? (paper.bids.find((bid) => bid.reviewerUserId === userId)?.value ?? null)
            : (paper.bids[0]?.value ?? null)
          : undefined,
        bids: oversight
          ? paper.bids
              .filter(
                (bid): bid is typeof bid & { reviewer: { name: string; email: string } } =>
                  'reviewer' in bid,
              )
              .map((bid) => ({
                reviewerUserId: bid.reviewerUserId,
                reviewerName: bid.reviewer.name,
                reviewerEmail: bid.reviewer.email,
                value: bid.value,
              }))
          : undefined,
      })),
      nextCursor: hasMore ? (data[data.length - 1]?.id ?? null) : null,
      blindingMode: conference.blindingMode,
    };
  }

  async upsert(
    userId: string,
    conferenceId: string,
    paperId: string,
    input: UpsertBidInput,
    roles: RoleKind[],
  ) {
    if (!roles.includes('REVIEWER') && !isPrivilegedReader(roles)) {
      throw new ForbiddenException('Reviewer role required to bid');
    }

    const conference = await this.conferences.loadConference(userId, conferenceId, roles);
    this.assertBiddingOpen(conference);

    const paper = await withTenantContext({ userId, conferenceId }, async (tx) =>
      tx.paper.findFirst({
        where: { id: paperId, conferenceId, status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } },
      }),
    );

    if (!paper) {
      throw new NotFoundException('Paper not found');
    }

    assertScope(paper, { conferenceId });

    const coiResult = await withTenantContext(
      { userId, conferenceId, organizationId: conference.organizationId },
      async (tx) => this.coiCheck.checkReviewerPaperConflict(tx, userId, paperId, conferenceId),
    );

    if (coiResult.hasConflict) {
      throw new ConflictException('Cannot bid on a paper with a conflict of interest');
    }

    const bid = await withTenantContext(
      { userId, conferenceId, organizationId: conference.organizationId },
      async (tx) =>
        tx.bid.upsert({
          where: { paperId_reviewerUserId: { paperId, reviewerUserId: userId } },
          create: {
            id: generateId(),
            organizationId: conference.organizationId,
            conferenceId,
            paperId,
            reviewerUserId: userId,
            value: input.value,
          },
          update: { value: input.value },
        }),
    );

    if (input.value === 'CONFLICT') {
      await withTenantContext(
        { userId, conferenceId, organizationId: conference.organizationId },
        async (tx) => {
          const existing = await tx.conflictOfInterest.findFirst({
            where: { conferenceId, userId, paperId },
          });
          if (!existing) {
            await tx.conflictOfInterest.create({
              data: {
                id: generateId(),
                organizationId: conference.organizationId,
                conferenceId,
                userId,
                paperId,
                type: 'OTHER',
                source: 'SELF',
                note: 'Declared via CONFLICT bid',
              },
            });
          }
        },
      );
    }

    return mapBid(bid);
  }

  private assertBiddingOpen(conference: {
    biddingOpensAt: Date | null;
    biddingClosesAt: Date | null;
  }) {
    const now = new Date();
    if (conference.biddingOpensAt && now < conference.biddingOpensAt) {
      throw new ConflictException('Bidding has not opened yet');
    }
    if (conference.biddingClosesAt && now > conference.biddingClosesAt) {
      throw new ConflictException('Bidding window has closed');
    }
  }
}

@Injectable()
export class CoiService {
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
    const privileged = isPrivilegedReader(roles);
    const limit = resolveLimit(options.limit);

    const rows = await withTenantContext(
      { userId, conferenceId, organizationId: conference.organizationId },
      async (tx) =>
        tx.conflictOfInterest.findMany({
          where: {
            conferenceId,
            ...(privileged ? {} : { userId }),
          },
          include: {
            user: { select: { name: true } },
            paper: { select: { title: true } },
          },
          orderBy: { createdAt: 'desc' },
          ...prismaCursorArgs(options, limit),
        }),
    );

    const page = paginateItems(rows, limit, (row) => row.id);

    return {
      data: page.data.map((coi) => ({
        ...mapConflictOfInterest(coi),
        userName: coi.user.name,
        paperTitle: coi.paper?.title ?? null,
      })),
      nextCursor: page.nextCursor,
    };
  }

  async declare(userId: string, conferenceId: string, input: DeclareCoiInput, roles: RoleKind[]) {
    const conference = await this.conferences.loadConference(userId, conferenceId, roles);
    const privileged = isPrivilegedReader(roles);

    const targetUserId = input.userId ?? userId;
    if (targetUserId !== userId && !privileged) {
      throw new ForbiddenException('Cannot declare COI for another user');
    }

    if (input.paperId) {
      const paper = await withTenantContext({ userId, conferenceId }, async (tx) =>
        tx.paper.findFirst({ where: { id: input.paperId, conferenceId } }),
      );
      if (!paper) {
        throw new NotFoundException('Paper not found');
      }
    }

    const source = targetUserId === userId ? 'SELF' : 'CHAIR';

    const coi = await withTenantContext(
      { userId, conferenceId, organizationId: conference.organizationId },
      async (tx) =>
        tx.conflictOfInterest.create({
          data: {
            id: generateId(),
            organizationId: conference.organizationId,
            conferenceId,
            userId: targetUserId,
            paperId: input.paperId ?? null,
            withUserId: input.withUserId ?? null,
            type: input.type,
            source,
            note: input.note ?? null,
          },
        }),
    );

    await this.audit.log({
      actorUserId: userId,
      organizationId: conference.organizationId,
      conferenceId,
      action: 'coi.declared',
      entity: 'ConflictOfInterest',
      entityId: coi.id,
      diff: { userId: targetUserId, paperId: input.paperId, type: input.type },
    });

    return mapConflictOfInterest(coi);
  }

  async remove(userId: string, conferenceId: string, coiId: string, roles: RoleKind[]) {
    const conference = await this.conferences.loadConference(userId, conferenceId, roles);
    const privileged = isPrivilegedReader(roles);

    const coi = await withTenantContext({ userId, conferenceId }, async (tx) =>
      tx.conflictOfInterest.findFirst({ where: { id: coiId } }),
    );

    if (!coi) {
      throw new NotFoundException('Conflict of interest not found');
    }

    assertScope(coi, { conferenceId });

    if (coi.userId !== userId && !privileged) {
      throw new ForbiddenException('Cannot remove this conflict declaration');
    }

    if (coi.source === 'SYSTEM' && !privileged) {
      throw new ForbiddenException('System-declared conflicts cannot be removed');
    }

    await withTenantContext(
      { userId, conferenceId, organizationId: conference.organizationId },
      async (tx) => tx.conflictOfInterest.delete({ where: { id: coiId } }),
    );

    await this.audit.log({
      actorUserId: userId,
      organizationId: conference.organizationId,
      conferenceId,
      action: 'coi.removed',
      entity: 'ConflictOfInterest',
      entityId: coiId,
    });
  }
}
