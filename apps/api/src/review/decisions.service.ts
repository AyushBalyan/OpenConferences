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
import {
  paginateItems,
  prismaCursorArgs,
  resolveLimit,
  type CursorPaginationOptions,
} from '../common/pagination/cursor';
import type { TransactionClient } from '../common/types/transaction-client';
import { assertScope } from '../common/scope/assert-scope';
import { AuditService } from '../audit/audit.service';
import { NotificationPublisher } from '../messaging/notification.publisher';
import { ConferenceService } from '../tenancy/conference.service';
import { canCoordinateReview } from '../tenancy/role-hierarchy';
import { mapDecision } from './review.mapper';
import { minimumReviewsFromConfig, reviewCountWarning } from './review-stage';
import { RoundsService } from './rounds.service';
import { RegistrationsService } from '../billing/registrations.service';

const REVISION_OUTCOMES: DecisionOutcome[] = ['MINOR_REVISION', 'MAJOR_REVISION'];

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
    options: CursorPaginationOptions & { roundId?: string; outcome?: DecisionOutcome } = {},
  ): Promise<DecisionListDto> {
    if (!canCoordinateReview(roles)) {
      throw new ForbiddenException('Insufficient permissions to list decisions');
    }

    const conference = await this.conferences.loadConference(userId, conferenceId, roles);
    const limit = resolveLimit(options.limit);

    const rows = await withTenantContext(
      { userId, conferenceId, organizationId: conference.organizationId },
      async (tx) =>
        tx.decision.findMany({
          where: {
            conferenceId,
            ...(options.roundId ? { roundId: options.roundId } : {}),
            ...(options.outcome ? { outcome: options.outcome } : {}),
          },
          include: {
            paper: { select: { title: true } },
            round: { select: { roundNumber: true } },
          },
          orderBy: { createdAt: 'desc' },
          ...prismaCursorArgs(options, limit),
        }),
    );

    const page = paginateItems(rows, limit, (row) => row.id);

    return {
      data: page.data.map((d) => ({
        ...mapDecision(d),
        paperTitle: d.paper.title,
        roundNumber: d.round.roundNumber,
      })),
      roundId: options.roundId,
      nextCursor: page.nextCursor,
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
      nextRound: null,
      warnings: result.warnings,
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

    void roundId;
    const conference = await this.conferences.loadConference(userId, conferenceId, roles);

    const paperIds = input.items.map((item) => item.paperId);
    if (new Set(paperIds).size !== paperIds.length) {
      throw new BadRequestException('Duplicate paper IDs in bulk decision request');
    }

    const successes: Array<{ decision: Decision; paper: PaperForDecision }> = [];
    const failures: Array<{ paperId: string; reason: string }> = [];

    for (const item of input.items) {
      try {
        const cycle = await withTenantContext(
          { userId, conferenceId, organizationId: conference.organizationId },
          async (tx) =>
            tx.reviewRound.findFirst({
              where: { conferenceId, paperId: item.paperId },
              orderBy: { roundNumber: 'desc' },
            }),
        );
        if (!cycle) {
          failures.push({ paperId: item.paperId, reason: 'Paper has no review cycle' });
          continue;
        }
        const paper = await this.loadPaper(userId, conferenceId, item.paperId);
        const result = await this.applyDecisionInTransaction(
          userId,
          conference.organizationId,
          conferenceId,
          item.paperId,
          cycle,
          item.outcome,
          item.rationale ?? null,
          paper.version,
        );
        successes.push({ decision: result.decision, paper: result.paper });
      } catch (error) {
        failures.push({
          paperId: item.paperId,
          reason: error instanceof Error ? error.message : 'Decision failed',
        });
      }
    }

    for (const { decision } of successes) {
      await this.audit.log({
        actorUserId: userId,
        organizationId: conference.organizationId,
        conferenceId,
        action: 'decision.made',
        entity: 'Decision',
        entityId: decision.id,
        diff: {
          paperId: decision.paperId,
          roundId: decision.roundId,
          outcome: decision.outcome,
          bulk: true,
        },
      });
    }

    const firstSuccess = successes[0];
    if (input.notify !== false && firstSuccess) {
      await this.notifyDecisionAuthors(
        successes.map((row) => row.paper),
        successes.map((row) => row.decision),
        firstSuccess.decision.roundId,
      );
    }

    for (const { decision, paper } of successes) {
      if (decision.outcome === 'ACCEPT') {
        await this.registrations.openRegistration(
          conference.organizationId,
          conferenceId,
          paper.id,
        );
      }
    }

    return {
      data: successes.map((row) => mapDecision(row.decision)),
      failures,
      message: `${successes.length} decision(s) recorded successfully`,
    };
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
      return await withTenantContext({ userId, conferenceId, organizationId }, async (tx) => {
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
      });
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
  ): Promise<{ decision: Decision; paper: PaperForDecision; warnings: string[] }> {
    if (paper.status === 'WITHDRAWN' || paper.status === 'WITHDRAWN_NONPAYMENT') {
      throw new ConflictException('Cannot decide on a withdrawn paper');
    }

    if (round.paperId !== paper.id) {
      throw new ConflictException('Review cycle does not belong to this paper');
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

    const submittedReviewCount = await tx.review.count({
      where: { roundId: round.id, conferenceId, submittedAt: { not: null } },
    });
    const conference = await tx.conference.findUniqueOrThrow({
      where: { id: conferenceId },
      select: { reviewConfig: true },
    });
    const warning = reviewCountWarning(
      submittedReviewCount,
      minimumReviewsFromConfig(conference.reviewConfig),
    );

    const nextPaperStatus: PaperStatus = REVISION_OUTCOMES.includes(outcome)
      ? 'UNDER_REVIEW'
      : 'DECISION_MADE';

    await tx.paper.update({
      where: { id: paper.id },
      data: {
        status: nextPaperStatus,
        version: { increment: 1 },
      },
    });

    return { decision, paper, warnings: warning ? [warning] : [] };
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

    const rounds = await withTenantContext({}, async (tx) => {
      await tx.decision.updateMany({
        where: { id: { in: decisionIds } },
        data: { notifiedAt: now },
      });
      return tx.reviewRound.findMany({
        where: { id: { in: decisions.map((decision) => decision.roundId) } },
        select: { id: true, revisionDueAt: true },
      });
    });
    const revisionDueByRound = new Map(rounds.map((round) => [round.id, round.revisionDueAt]));

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
        rationaleBlock: decision.rationale?.trim()
          ? `Committee note: ${decision.rationale.trim()}`
          : '',
        acceptBlock: this.decisionNextSteps(
          decision.outcome,
          revisionDueByRound.get(decision.roundId) ?? null,
        ),
        decisionId: decision.id,
        idempotencyKey: `decision-${decision.paperId}-${roundId}`,
      });
    }
  }

  private decisionNextSteps(outcome: DecisionOutcome, revisionDueAt: Date | null): string {
    if (outcome === 'ACCEPT') {
      return 'Next steps: upload your camera-ready version and complete conference registration before the deadline.';
    }
    if (outcome === 'REJECT') {
      return 'Thank you for your submission. We encourage you to consider the reviewer feedback when preparing future work.';
    }
    const deadline = revisionDueAt ? ` before ${revisionDueAt.toISOString()}` : '';
    return `Next steps: upload a revised PDF on this submission${deadline}.`;
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
