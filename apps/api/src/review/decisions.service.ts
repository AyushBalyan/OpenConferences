import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  Decision,
  DecisionOutcome,
  PaperStatus,
  ReviewRound,
  RoleKind,
} from '@openconferences/db';
import { generateId, withTenantContext } from '@openconferences/db';
import type {
  BulkDecisionInput,
  DecisionDto,
  DecisionListDto,
  MakeDecisionInput,
  NotifyDecisionsInput,
} from '@openconferences/schemas';
import type { TransactionClient } from '../common/types/transaction-client';
import { assertScope } from '../common/scope/assert-scope';
import { AuditService } from '../audit/audit.service';
import { NotificationPublisher } from '../messaging/notification.publisher';
import { ConferenceService } from '../tenancy/conference.service';
import { canCoordinateReview } from '../tenancy/role-hierarchy';
import { mapDecision, mapReviewRound } from './review.mapper';
import { RoundsService } from './rounds.service';
import { RegistrationsService } from '../billing/registrations.service';

const REVISION_OUTCOMES: DecisionOutcome[] = ['MINOR_REVISION', 'MAJOR_REVISION'];
const DECIDABLE_ROUND_STATUSES = new Set(['REBUTTAL', 'DECIDING']);

type PaperForDecision = {
  id: string;
  organizationId: string;
  conferenceId: string;
  title: string;
  status: PaperStatus;
  version: number;
  authorships: Array<{
    email: string;
    fullName: string;
    isCorresponding: boolean;
    userId: string | null;
  }>;
};

@Injectable()
export class DecisionsService {
  constructor(
    private readonly conferences: ConferenceService,
    private readonly rounds: RoundsService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationPublisher,
    private readonly registrations: RegistrationsService,
  ) {}

  async listDecisions(
    userId: string,
    conferenceId: string,
    roles: RoleKind[],
    roundId?: string,
  ): Promise<DecisionListDto> {
    if (!canCoordinateReview(roles)) {
      throw new ForbiddenException('Insufficient permissions to list decisions');
    }

    const conference = await this.conferences.loadConference(userId, conferenceId, roles);

    const decisions = await withTenantContext(
      { userId, conferenceId, organizationId: conference.organizationId },
      async (tx) =>
        tx.decision.findMany({
          where: {
            conferenceId,
            ...(roundId ? { roundId } : {}),
          },
          include: {
            paper: { select: { title: true } },
            round: { select: { roundNumber: true } },
          },
          orderBy: [{ createdAt: 'desc' }],
        }),
    );

    return {
      data: decisions.map((d) => ({
        ...mapDecision(d),
        paperTitle: d.paper.title,
        roundNumber: d.round.roundNumber,
      })),
      roundId,
    };
  }

  async getPaperDecision(
    userId: string,
    conferenceId: string,
    paperId: string,
    roles: RoleKind[],
    roundId?: string,
  ): Promise<DecisionDto> {
    const conference = await this.conferences.loadConference(userId, conferenceId, roles);
    const paper = await this.loadPaper(userId, conferenceId, paperId);

    const privileged = canCoordinateReview(roles);
    const isAuthor =
      paper.submittedById === userId || paper.authorships.some((a) => a.userId === userId);

    if (!privileged && !isAuthor) {
      throw new ForbiddenException('Insufficient permissions to view decision');
    }

    const decision = await withTenantContext(
      { userId, conferenceId, organizationId: conference.organizationId },
      async (tx) =>
        tx.decision.findFirst({
          where: {
            paperId,
            conferenceId,
            ...(roundId ? { roundId } : {}),
          },
          orderBy: { createdAt: 'desc' },
        }),
    );

    if (!decision) {
      throw new NotFoundException('Decision not found');
    }

    if (!privileged && !decision.notifiedAt) {
      throw new NotFoundException('Decision not found');
    }

    return mapDecision(decision);
  }

  async makeDecision(
    userId: string,
    conferenceId: string,
    paperId: string,
    input: MakeDecisionInput,
    roles: RoleKind[],
  ) {
    if (!canCoordinateReview(roles)) {
      throw new ForbiddenException('Insufficient permissions to make decisions');
    }

    const conference = await this.conferences.loadConference(userId, conferenceId, roles);
    const round = await this.rounds.loadRound(userId, conferenceId, input.roundId, roles);

    const result = await this.applyDecisionInTransaction(
      userId,
      conference.organizationId,
      conferenceId,
      paperId,
      round,
      input.outcome,
      input.rationale ?? null,
      input.version,
    );

    await this.audit.log({
      actorUserId: userId,
      organizationId: conference.organizationId,
      conferenceId,
      action: 'decision.made',
      entity: 'Decision',
      entityId: result.decision.id,
      diff: {
        paperId,
        roundId: input.roundId,
        outcome: input.outcome,
      },
    });

    const shouldNotify = input.notify !== false;
    if (shouldNotify) {
      await this.notifyDecisionAuthors([result.paper], [result.decision], input.roundId);
    }

    if (input.outcome === 'ACCEPT') {
      await this.registrations.openRegistration(conference.organizationId, conferenceId, paperId);
    }

    return {
      decision: mapDecision(result.decision),
      nextRound: result.nextRound ? mapReviewRound(result.nextRound) : null,
      message: 'Decision recorded successfully',
    };
  }

  async bulkDecide(
    userId: string,
    conferenceId: string,
    roundId: string,
    input: BulkDecisionInput,
    roles: RoleKind[],
  ) {
    if (!canCoordinateReview(roles)) {
      throw new ForbiddenException('Insufficient permissions to make decisions');
    }

    const conference = await this.conferences.loadConference(userId, conferenceId, roles);
    const round = await this.rounds.loadRound(userId, conferenceId, roundId, roles);

    const paperIds = input.items.map((item) => item.paperId);
    if (new Set(paperIds).size !== paperIds.length) {
      throw new BadRequestException('Duplicate paper IDs in bulk decision request');
    }

    const papers = await withTenantContext(
      { userId, conferenceId, organizationId: conference.organizationId },
      async (tx) =>
        tx.paper.findMany({
          where: { id: { in: paperIds }, conferenceId },
          include: {
            authorships: {
              where: { isCorresponding: true },
              select: { email: true, fullName: true, isCorresponding: true, userId: true },
            },
          },
        }),
    );

    if (papers.length !== paperIds.length) {
      throw new NotFoundException('One or more papers were not found in this conference');
    }

    const paperById = new Map(papers.map((p) => [p.id, p]));

    try {
      const results = await withTenantContext(
        { userId, conferenceId, organizationId: conference.organizationId, bypass: true },
        async (tx) => {
          const applied: Array<{ decision: Decision; paper: PaperForDecision }> = [];
          let currentRound = round;

          for (const item of input.items) {
            const paper = paperById.get(item.paperId)!;
            assertScope(paper, { conferenceId });

            const outcome = await this.createDecisionAndUpdatePaper(
              tx,
              userId,
              conference.organizationId,
              conferenceId,
              paper,
              currentRound,
              item.outcome,
              item.rationale ?? null,
            );

            applied.push({ decision: outcome.decision, paper: outcome.paper });

            if (outcome.nextRound) {
              currentRound = outcome.nextRound;
            }
          }

          return applied;
        },
      );

      for (const { decision } of results) {
        await this.audit.log({
          actorUserId: userId,
          organizationId: conference.organizationId,
          conferenceId,
          action: 'decision.made',
          entity: 'Decision',
          entityId: decision.id,
          diff: { paperId: decision.paperId, roundId, outcome: decision.outcome, bulk: true },
        });
      }

      if (input.notify !== false) {
        await this.notifyDecisionAuthors(
          results.map((r) => r.paper),
          results.map((r) => r.decision),
          roundId,
        );
      }

      for (const { decision, paper } of results) {
        if (decision.outcome === 'ACCEPT') {
          await this.registrations.openRegistration(
            conference.organizationId,
            conferenceId,
            paper.id,
          );
        }
      }

      return {
        data: results.map((r) => mapDecision(r.decision)),
        message: `${results.length} decision(s) recorded successfully`,
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes('Unique constraint')) {
        throw new ConflictException(
          'A decision already exists for one or more papers in this round',
        );
      }
      throw error;
    }
  }

  async notifyDecisions(
    userId: string,
    conferenceId: string,
    roundId: string,
    input: NotifyDecisionsInput,
    roles: RoleKind[],
  ) {
    if (!canCoordinateReview(roles)) {
      throw new ForbiddenException('Insufficient permissions to notify decisions');
    }

    const conference = await this.conferences.loadConference(userId, conferenceId, roles);
    await this.rounds.loadRound(userId, conferenceId, roundId, roles);

    const decisions = await withTenantContext(
      { userId, conferenceId, organizationId: conference.organizationId },
      async (tx) =>
        tx.decision.findMany({
          where: {
            conferenceId,
            roundId,
            ...(input.paperIds?.length ? { paperId: { in: input.paperIds } } : {}),
          },
          include: {
            paper: {
              include: {
                authorships: {
                  where: { isCorresponding: true },
                  select: { email: true, fullName: true, isCorresponding: true, userId: true },
                },
              },
            },
          },
        }),
    );

    if (decisions.length === 0) {
      throw new NotFoundException('No decisions found to notify');
    }

    await this.notifyDecisionAuthors(
      decisions.map((d) => d.paper),
      decisions,
      roundId,
    );

    return {
      notifiedCount: decisions.length,
      message: 'Decision notifications sent',
    };
  }

  private async applyDecisionInTransaction(
    userId: string,
    organizationId: string,
    conferenceId: string,
    paperId: string,
    round: ReviewRound,
    outcome: DecisionOutcome,
    rationale: string | null,
    paperVersion: number,
  ) {
    try {
      return await withTenantContext(
        { userId, conferenceId, organizationId, bypass: true },
        async (tx) => {
          const paper = await tx.paper.findFirst({
            where: { id: paperId, conferenceId },
            include: {
              authorships: {
                where: { isCorresponding: true },
                select: { email: true, fullName: true, isCorresponding: true, userId: true },
              },
            },
          });

          if (!paper) {
            throw new NotFoundException('Paper not found');
          }

          assertScope(paper, { conferenceId });

          if (paper.version !== paperVersion) {
            throw new ConflictException('Paper was modified by another request');
          }

          return this.createDecisionAndUpdatePaper(
            tx,
            userId,
            organizationId,
            conferenceId,
            paper,
            round,
            outcome,
            rationale,
          );
        },
      );
    } catch (error) {
      if (error instanceof Error && error.message.includes('Unique constraint')) {
        throw new ConflictException('A decision already exists for this paper in this round');
      }
      throw error;
    }
  }

  private async createDecisionAndUpdatePaper(
    tx: TransactionClient,
    userId: string,
    organizationId: string,
    conferenceId: string,
    paper: PaperForDecision,
    round: ReviewRound,
    outcome: DecisionOutcome,
    rationale: string | null,
  ): Promise<{ decision: Decision; paper: PaperForDecision; nextRound: ReviewRound | null }> {
    if (paper.status === 'WITHDRAWN' || paper.status === 'WITHDRAWN_NONPAYMENT') {
      throw new ConflictException('Cannot decide on a withdrawn paper');
    }

    if (!DECIDABLE_ROUND_STATUSES.has(round.status)) {
      throw new ConflictException('Decisions can only be made during rebuttal or deciding phase');
    }

    const existingAssignment = await tx.reviewerAssignment.findFirst({
      where: { paperId: paper.id, roundId: round.id, conferenceId },
    });

    if (!existingAssignment) {
      throw new BadRequestException('Paper has no assignments in this review round');
    }

    const decision = await tx.decision.create({
      data: {
        id: generateId(),
        organizationId,
        conferenceId,
        paperId: paper.id,
        roundId: round.id,
        decidedById: userId,
        outcome,
        rationale,
        version: 1,
      },
    });

    let nextRound: ReviewRound | null = null;
    let nextPaperStatus: PaperStatus;

    if (REVISION_OUTCOMES.includes(outcome)) {
      nextPaperStatus = 'UNDER_REVIEW';

      await tx.reviewRound.update({
        where: { id: round.id },
        data: { status: 'CLOSED', version: { increment: 1 } },
      });

      nextRound = await tx.reviewRound.create({
        data: {
          id: generateId(),
          organizationId,
          conferenceId,
          roundNumber: round.roundNumber + 1,
          status: 'OPEN',
          revisionDueAt: round.revisionDueAt,
        },
      });
    } else {
      nextPaperStatus = 'DECISION_MADE';

      await tx.reviewRound.update({
        where: { id: round.id },
        data: { status: 'CLOSED', version: { increment: 1 } },
      });
    }

    await tx.paper.update({
      where: { id: paper.id },
      data: {
        status: nextPaperStatus,
        version: { increment: 1 },
      },
    });

    return { decision, paper, nextRound };
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

  private async notifyDecisionAuthors(
    papers: Array<PaperForDecision>,
    decisions: Array<Pick<Decision, 'id' | 'paperId' | 'roundId' | 'outcome' | 'rationale'>>,
    roundId: string,
  ) {
    const now = new Date();
    const decisionIds = decisions.map((d) => d.id);

    await withTenantContext({ bypass: true }, async (tx) => {
      await tx.decision.updateMany({
        where: { id: { in: decisionIds } },
        data: { notifiedAt: now },
      });
    });

    for (const decision of decisions) {
      const paper = papers.find((p) => p.id === decision.paperId);
      if (!paper) continue;

      const corresponding =
        paper.authorships.find((a) => a.isCorresponding) ?? paper.authorships[0];
      if (!corresponding?.email) continue;

      const outcomeLabel = this.outcomeLabel(decision.outcome);
      const title = paper.title;

      await this.notifications.publishDecisionNotified({
        to: corresponding.email,
        conferenceId: paper.conferenceId,
        organizationId: paper.organizationId,
        paperTitle: title,
        outcomeLabel,
        rationaleBlock: decision.rationale ?? '',
        acceptBlock:
          decision.outcome === 'ACCEPT'
            ? 'Please proceed with camera-ready submission and conference registration.'
            : '',
        decisionId: decision.id,
        idempotencyKey: `decision-${decision.paperId}-${roundId}`,
      });
    }
  }

  private outcomeLabel(outcome: DecisionOutcome): string {
    const labels: Record<DecisionOutcome, string> = {
      ACCEPT: 'Accept',
      REJECT: 'Reject',
      MINOR_REVISION: 'Minor revision',
      MAJOR_REVISION: 'Major revision',
    };
    return labels[outcome];
  }
}
