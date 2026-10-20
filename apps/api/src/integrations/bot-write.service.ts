import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { Prisma, withTenantContext } from '@openconferences/db';
import { botAssignmentSchema, type BotCreateAssignment } from '@openconferences/schemas';
import { NotificationPublisher } from '../messaging/notification.publisher';
import { CoiCheckService } from '../review/coi-check.service';
import { RoundsService, lockReviewRound } from '../review/rounds.service';
import { IntegrationStore } from './integration.store';
import type { IntegrationPrincipal } from './integration.security';

export const BOT_ASSIGNMENT_ROUTE = '/integrations/v1/conferences/:conferenceId/assignments';

@Injectable()
export class BotWriteService {
  constructor(
    private readonly store: IntegrationStore,
    private readonly rounds: RoundsService,
    private readonly coi: CoiCheckService,
    private readonly notifications: NotificationPublisher,
  ) {}

  private async authorize(tx: Prisma.TransactionClient, p: IntegrationPrincipal) {
    // Serialize with suspension, reauthorization and key revocation before admitting a mutation.
    await tx.$queryRaw`SELECT id FROM api_integrations WHERE id=${p.integrationId}::uuid AND "conferenceId"=${p.conferenceId}::uuid FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM api_integration_keys WHERE id=${p.keyId}::uuid AND "integrationId"=${p.integrationId}::uuid FOR UPDATE`;
    const key = await tx.apiIntegrationKey.findFirst({
      where: {
        id: p.keyId,
        integrationId: p.integrationId,
        conferenceId: p.conferenceId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        integration: {
          include: { authorizer: true, conference: { include: { organization: true } } },
        },
      },
    });
    if (
      !key ||
      key.integration.status !== 'ACTIVE' ||
      key.integration.authorizedByUserId !== p.userId ||
      !key.integration.authorizer.twoFactorEnabled ||
      key.integration.authorizer.deletedAt ||
      key.integration.conference.deletedAt ||
      key.integration.conference.organization.deletedAt
    )
      throw new UnauthorizedException('Invalid API credential');
    const scopes = ['assignments:write', 'assignments:read', 'papers:read', 'reviewers:read'];
    if (scopes.some((s) => !key.scopes.includes(s) || !key.integration.scopes.includes(s)))
      throw new ForbiddenException('Missing assignments:write scope');
    const membership = await tx.membership.findFirst({
      where: {
        userId: p.userId,
        OR: [
          { scope: 'CONFERENCE', conferenceId: p.conferenceId },
          { scope: 'ORGANIZATION', organizationId: p.organizationId },
        ],
        roles: { some: { role: { in: ['CHAIR', 'ORGANIZER', 'ORG_ADMIN'] } } },
      },
      select: { id: true },
    });
    if (!membership) throw new UnauthorizedException('Invalid API credential');
    return key.integration.conference;
  }

  async assign(
    p: IntegrationPrincipal,
    input: BotCreateAssignment,
    accessRequestId: string,
    started: number,
  ) {
    if (!p.scopes.includes('assignments:write'))
      throw new ForbiddenException('Missing assignments:write scope');
    const dueAt = new Date(input.dueAt);
    if (!Number.isFinite(dueAt.getTime()))
      throw new BadRequestException('Choose a valid individual review deadline');
    const payloadHash = createHash('sha256')
      .update(
        JSON.stringify({
          paperId: input.paperId,
          reviewerId: input.reviewerId,
          cycleId: input.cycleId ?? null,
          dueAt: dueAt.toISOString(),
        }),
      )
      .digest('hex');
    let outcome;
    try {
      outcome = await withTenantContext(
        p,
        async (tx) => {
          await tx.$executeRaw`SET LOCAL statement_timeout = '3s'`;
          const conference = await this.authorize(tx, p);
          const prior = await tx.apiIntegrationMutation.findUnique({
            where: {
              integrationId_requestId: {
                integrationId: p.integrationId,
                requestId: input.requestId,
              },
            },
          });
          if (prior) {
            if (prior.payloadHash !== payloadHash)
              throw new ConflictException(
                'requestId was already used with different assignment details',
              );
            const data = botAssignmentSchema.parse(prior.response);
            await this.store.recordInTransaction(
              tx,
              p,
              accessRequestId,
              BOT_ASSIGNMENT_ROUTE,
              201,
              1,
              performance.now() - started,
              'POST',
            );
            return { data, replayed: true, email: null };
          }
          if (!Number.isFinite(dueAt.getTime()) || dueAt <= new Date())
            throw new BadRequestException('Choose a future individual review deadline');
          await tx.$queryRaw`SELECT id FROM papers WHERE id=${input.paperId}::uuid AND "conferenceId"=${p.conferenceId}::uuid FOR UPDATE`;
          const paper = await tx.paper.findFirst({
            where: {
              id: input.paperId,
              conferenceId: p.conferenceId,
              organizationId: p.organizationId,
              status: { not: 'DRAFT' },
            },
            include: { authorships: { select: { userId: true, email: true } } },
          });
          if (!paper) throw new NotFoundException('Resource not found');
          if (paper.status !== 'SUBMITTED' && paper.status !== 'UNDER_REVIEW')
            throw new ConflictException('Paper is not open for review');
          const ref = await tx.apiIntegrationReviewerReference.findFirst({
            where: {
              id: input.reviewerId,
              integrationId: p.integrationId,
              conferenceId: p.conferenceId,
            },
            select: { reviewerUserId: true },
          });
          if (!ref) throw new NotFoundException('Resource not found');
          const member = await tx.membership.findFirst({
            where: {
              userId: ref.reviewerUserId,
              conferenceId: p.conferenceId,
              scope: 'CONFERENCE',
              roles: { some: { role: 'REVIEWER' } },
              user: { deletedAt: null },
            },
            include: { user: { select: { name: true, email: true } } },
          });
          if (!member)
            throw new ConflictException('Reviewer must have accepted access to this conference');
          if (
            paper.submittedById === ref.reviewerUserId ||
            paper.authorships.some(
              (a) =>
                a.userId === ref.reviewerUserId ||
                a.email.trim().toLowerCase() === member.user.email.toLowerCase(),
            )
          )
            throw new ConflictException('Reviewer is an author of this paper');
          const round = await this.rounds.ensureOpenCycle(tx, {
            organizationId: p.organizationId,
            conferenceId: p.conferenceId,
            paperId: paper.id,
            reviewDueAt: conference.reviewDueAt,
            rebuttalDueAt: conference.rebuttalDueAt,
          });
          if (input.cycleId && input.cycleId !== round.id) {
            const supplied = await tx.reviewRound.findFirst({
              where: { id: input.cycleId, paperId: paper.id, conferenceId: p.conferenceId },
              select: { id: true },
            });
            if (!supplied) throw new NotFoundException('Resource not found');
            throw new ConflictException('Assignments require the current review cycle');
          }
          await lockReviewRound(tx, p.conferenceId, round.id);
          if (
            await tx.decision.findFirst({
              where: { roundId: round.id, conferenceId: p.conferenceId },
              select: { id: true },
            })
          )
            throw new ConflictException('This paper cycle already has a decision');
          if (
            await tx.reviewerAssignment.findFirst({
              where: { roundId: round.id, paperId: paper.id, reviewerUserId: ref.reviewerUserId },
              select: { id: true },
            })
          )
            throw new ConflictException('Reviewer is already assigned in this cycle');
          const conflict = await this.coi.checkReviewerPaperConflict(
            tx,
            ref.reviewerUserId,
            paper.id,
            p.conferenceId,
          );
          const bid = await tx.bid.findUnique({
            where: {
              paperId_reviewerUserId: { paperId: paper.id, reviewerUserId: ref.reviewerUserId },
            },
            select: { value: true },
          });
          if (conflict.hasConflict || bid?.value === 'CONFLICT')
            throw new ConflictException('Reviewer has a conflict of interest');
          const assignment = await tx.reviewerAssignment.create({
            data: {
              id: randomUUID(),
              organizationId: p.organizationId,
              conferenceId: p.conferenceId,
              paperId: paper.id,
              roundId: round.id,
              reviewerUserId: ref.reviewerUserId,
              status: 'ASSIGNED',
              dueAt,
            },
          });
          if (paper.status === 'SUBMITTED')
            await tx.paper.update({
              where: { id: paper.id },
              data: { status: 'UNDER_REVIEW', version: { increment: 1 } },
            });
          const data = botAssignmentSchema.parse({
            id: assignment.id,
            paperId: paper.id,
            submissionNumber: paper.submissionNumber,
            reviewerId: input.reviewerId,
            cycleId: round.id,
            cycleNumber: round.roundNumber,
            isCurrentCycle: true,
            status: assignment.status,
            progress: 'NOT_STARTED',
            submittedAt: null,
            dueAt: dueAt.toISOString(),
            deadlineSource: 'INDIVIDUAL',
            overdue: false,
            retired: false,
          });
          await tx.auditLog.create({
            data: {
              id: randomUUID(),
              actorUserId: p.userId,
              organizationId: p.organizationId,
              conferenceId: p.conferenceId,
              action: 'integration.assignment.created',
              entity: 'ReviewerAssignment',
              entityId: assignment.id,
              diff: {
                integrationId: p.integrationId,
                keyId: p.keyId,
                requestId: input.requestId,
                paperId: paper.id,
                reviewerUserId: ref.reviewerUserId,
                roundId: round.id,
                dueAt: dueAt.toISOString(),
              },
            },
          });
          await tx.apiIntegrationMutation.create({
            data: {
              id: randomUUID(),
              integrationId: p.integrationId,
              organizationId: p.organizationId,
              conferenceId: p.conferenceId,
              requestId: input.requestId,
              payloadHash,
              response: data,
            },
          });
          await this.store.recordInTransaction(
            tx,
            p,
            accessRequestId,
            BOT_ASSIGNMENT_ROUTE,
            201,
            1,
            performance.now() - started,
            'POST',
          );
          return {
            data,
            replayed: false,
            email: {
              to: member.user.email,
              reviewerName: member.user.name,
              conferenceName: conference.name,
              conferenceId: p.conferenceId,
              organizationId: p.organizationId,
              paperTitle: paper.title,
              roundNumber: round.roundNumber,
              dueAt: data.dueAt,
              assignmentId: assignment.id,
              idempotencyKey: `reviewer-assignment-${assignment.id}`,
            },
          };
        },
        { timeout: 5000 },
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw new ConflictException('Reviewer is already assigned in this cycle');
      throw error;
    }
    let notificationWarning: string | undefined;
    if (outcome.email) {
      try {
        if (!(await this.notifications.publishReviewerAssigned(outcome.email)))
          notificationWarning =
            'Assignment saved, but the email was not queued. Check the email log before sending a reminder.';
      } catch {
        notificationWarning =
          'Assignment saved, but the email could not be queued. Check the email log before sending a reminder.';
      }
    }
    return {
      data: outcome.data,
      replayed: outcome.replayed,
      message: outcome.replayed
        ? 'Assignment already created for this request.'
        : 'Reviewer assigned successfully.',
      ...(notificationWarning ? { notificationWarning } : {}),
    };
  }
}
