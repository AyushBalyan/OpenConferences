import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { DecisionOutcome, Registration, RoleKind } from '@openconferences/db';
import { generateId, withTenantContext } from '@openconferences/db';
import type {
  CreateRegistrationInput,
  BillingFeeSchedule,
  RegistrationDetailDto,
} from '@openconferences/schemas';
import { assertScope } from '../common/scope/assert-scope';
import { AuditService } from '../audit/audit.service';
import { NotificationPublisher } from '../messaging/notification.publisher';
import { ConferenceService } from '../tenancy/conference.service';
import { canCoordinateReview } from '../tenancy/role-hierarchy';
import { PapersService } from '../submission/papers.service';
import { mapRegistration } from './billing.mapper';
import {
  getEarlyBirdEndsAt,
  getRegistrationDeadline,
  parseFeeSchedule,
  resolveMatrixAmount,
} from './fee-resolver';

@Injectable()
export class RegistrationsService {
  constructor(
    private readonly conferences: ConferenceService,
    private readonly papers: PapersService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationPublisher,
  ) {}

  async openRegistration(
    organizationId: string,
    conferenceId: string,
    paperId: string,
  ): Promise<Registration> {
    const conference = await withTenantContext({ bypass: true }, async (tx) =>
      tx.conference.findFirst({ where: { id: conferenceId } }),
    );

    if (!conference) {
      throw new NotFoundException('Conference not found');
    }

    const feeSchedule = parseFeeSchedule(conference.feeSchedule);
    const deadlineAt = getRegistrationDeadline(feeSchedule, conference.registrationDueAt);

    const existing = await withTenantContext({ bypass: true }, async (tx) =>
      tx.registration.findUnique({
        where: { conferenceId_paperId: { conferenceId, paperId } },
      }),
    );

    if (existing) {
      return existing;
    }

    const registration = await withTenantContext({ bypass: true }, async (tx) =>
      tx.registration.create({
        data: {
          id: generateId(),
          organizationId,
          conferenceId,
          paperId,
          audience: 'REGULAR',
          amountDueMinor: 0,
          currency: feeSchedule.currency,
          status: 'PENDING',
          windowOpensAt: new Date(),
          deadlineAt,
        },
      }),
    );

    await this.audit.log({
      organizationId,
      conferenceId,
      action: 'registration.opened',
      entity: 'Registration',
      entityId: registration.id,
      diff: { paperId },
    });

    const paper = await withTenantContext({ bypass: true }, async (tx) =>
      tx.paper.findFirst({
        where: { id: paperId },
        include: { authorships: true },
      }),
    );

    const corresponding =
      paper?.authorships.find((a) => a.isCorresponding) ?? paper?.authorships[0];
    if (corresponding?.email) {
      await this.notifications.publishRegistrationWindowOpen({
        to: corresponding.email,
        conferenceId,
        organizationId,
        paperTitle: paper?.title ?? 'Your paper',
        deadlineAt: deadlineAt.toISOString(),
        registrationId: registration.id,
        idempotencyKey: `registration-window-${registration.id}`,
      });
    }

    return registration;
  }

  async getRegistration(
    userId: string,
    conferenceId: string,
    paperId: string,
    roles: RoleKind[],
  ): Promise<RegistrationDetailDto> {
    const conference = await this.conferences.loadConference(userId, conferenceId, roles);
    await this.papers.loadPaper(userId, conferenceId, paperId, roles);

    const registration = await this.loadRegistration(userId, conferenceId, paperId);
    const feeSchedule = parseFeeSchedule(conference.feeSchedule);

    const [payments, verifications, invoice] = await withTenantContext(
      { userId, conferenceId, organizationId: conference.organizationId },
      async (tx) => {
        const paymentRows = await tx.payment.findMany({
          where: { registrationId: registration.id },
          orderBy: { createdAt: 'asc' },
        });

        const verificationRows = await tx.studentVerification.findMany({
          where: { registrationId: registration.id },
          orderBy: { createdAt: 'desc' },
          take: 1,
        });

        const captured = paymentRows.find((p) => p.status === 'CAPTURED' && p.kind !== 'REFUND');
        const invoiceRow = captured
          ? await tx.invoice.findUnique({ where: { paymentId: captured.id } })
          : null;

        return [paymentRows, verificationRows, invoiceRow] as const;
      },
    );

    return {
      ...mapRegistration(registration),
      payments: payments.map((p) => ({
        id: p.id,
        organizationId: p.organizationId,
        registrationId: p.registrationId,
        provider: p.provider,
        providerOrderId: p.providerOrderId,
        providerPaymentId: p.providerPaymentId,
        status: p.status,
        amountMinor: p.amountMinor,
        currency: p.currency,
        kind: p.kind,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      })),
      latestVerification: verifications[0]
        ? {
            id: verifications[0].id,
            organizationId: verifications[0].organizationId,
            registrationId: verifications[0].registrationId,
            fileAssetId: verifications[0].fileAssetId,
            reviewedById: verifications[0].reviewedById,
            status: verifications[0].status,
            note: verifications[0].note,
            submittedAt: verifications[0].submittedAt.toISOString(),
            reviewedAt: verifications[0].reviewedAt?.toISOString() ?? null,
            createdAt: verifications[0].createdAt.toISOString(),
            updatedAt: verifications[0].updatedAt.toISOString(),
          }
        : null,
      invoice: invoice
        ? {
            id: invoice.id,
            paymentId: invoice.paymentId,
            number: invoice.number,
            issuedAt: invoice.issuedAt.toISOString(),
          }
        : null,
      feeSchedule,
      earlyBirdEndsAt:
        getEarlyBirdEndsAt(feeSchedule, conference.registrationDueAt)?.toISOString() ?? null,
    };
  }

  async createRegistration(
    userId: string,
    conferenceId: string,
    paperId: string,
    input: CreateRegistrationInput,
    roles: RoleKind[],
  ) {
    const conference = await this.conferences.loadConference(userId, conferenceId, roles);
    const paper = await this.papers.loadPaper(userId, conferenceId, paperId, roles);

    await this.assertPaperAccepted(paper.id, conferenceId);

    const registration = await this.loadRegistration(userId, conferenceId, paperId);

    if (!['PENDING', 'ADDITIONAL_PAYMENT_REQUIRED'].includes(registration.status)) {
      throw new ConflictException('Registration audience cannot be changed after payment begins');
    }

    const updated = await withTenantContext(
      { userId, conferenceId, organizationId: conference.organizationId, bypass: true },
      async (tx) => {
        const current = await tx.registration.findFirst({
          where: { id: registration.id },
        });

        if (!current) {
          throw new NotFoundException('Registration not found');
        }

        return tx.registration.update({
          where: { id: current.id },
          data: {
            audience: input.audience,
            version: { increment: 1 },
          },
        });
      },
    );

    await this.audit.log({
      actorUserId: userId,
      organizationId: conference.organizationId,
      conferenceId,
      action: 'registration.audience_selected',
      entity: 'Registration',
      entityId: updated.id,
      diff: { audience: input.audience },
    });

    return mapRegistration(updated);
  }

  async listRegistrations(userId: string, conferenceId: string, roles: RoleKind[]) {
    if (!canCoordinateReview(roles)) {
      throw new ForbiddenException('Insufficient permissions to list registrations');
    }

    const conference = await this.conferences.loadConference(userId, conferenceId, roles);

    const rows = await withTenantContext(
      { userId, conferenceId, organizationId: conference.organizationId },
      async (tx) =>
        tx.registration.findMany({
          where: { conferenceId },
          include: { paper: { select: { title: true } } },
          orderBy: { createdAt: 'desc' },
        }),
    );

    return {
      data: rows.map((row) => ({
        ...mapRegistration(row),
        paperTitle: row.paper.title,
      })),
    };
  }

  async loadRegistrationForPayment(
    userId: string,
    conferenceId: string,
    paperId: string,
    roles: RoleKind[],
  ): Promise<Registration> {
    await this.papers.loadPaper(userId, conferenceId, paperId, roles);
    return this.loadRegistration(userId, conferenceId, paperId);
  }

  async loadRegistration(
    userId: string,
    conferenceId: string,
    paperId: string,
  ): Promise<Registration> {
    const registration = await withTenantContext({ userId, conferenceId }, async (tx) =>
      tx.registration.findFirst({
        where: { paperId, conferenceId },
      }),
    );

    if (!registration) {
      throw new NotFoundException('Registration not found');
    }

    assertScope(registration, { conferenceId });
    return registration;
  }

  resolveAmountDue(
    feeSchedule: BillingFeeSchedule,
    audience: Registration['audience'],
    lockedTiming: Registration['lockedTiming'],
    capturedAt: Date,
    conferenceRegistrationDueAt: Date | null,
  ): { amountDueMinor: number; lockedTiming: Registration['lockedTiming'] } {
    const earlyBirdEndsAt = getEarlyBirdEndsAt(feeSchedule, conferenceRegistrationDueAt);
    const timing =
      lockedTiming ?? (earlyBirdEndsAt && capturedAt <= earlyBirdEndsAt ? 'EARLY' : 'REGULAR');

    return {
      lockedTiming: timing,
      amountDueMinor: resolveMatrixAmount(feeSchedule, audience, timing!),
    };
  }

  async extendDeadline(
    userId: string,
    conferenceId: string,
    registrationId: string,
    deadlineAt: string,
    version: number,
    roles: RoleKind[],
  ) {
    if (!canCoordinateReview(roles)) {
      throw new ForbiddenException('Insufficient permissions to extend deadline');
    }

    const conference = await this.conferences.loadConference(userId, conferenceId, roles);

    const updated = await withTenantContext(
      { userId, conferenceId, organizationId: conference.organizationId, bypass: true },
      async (tx) => {
        const registration = await tx.registration.findFirst({
          where: { id: registrationId, conferenceId },
        });

        if (!registration) {
          throw new NotFoundException('Registration not found');
        }

        if (registration.version !== version) {
          throw new ConflictException('Registration was modified by another request');
        }

        return tx.registration.update({
          where: { id: registrationId },
          data: {
            deadlineAt: new Date(deadlineAt),
            additionalGraceUntil: null,
            version: { increment: 1 },
          },
        });
      },
    );

    await this.audit.log({
      actorUserId: userId,
      organizationId: conference.organizationId,
      conferenceId,
      action: 'registration.deadline_extended',
      entity: 'Registration',
      entityId: registrationId,
      diff: { deadlineAt },
    });

    return {
      registration: mapRegistration(updated),
      message: 'Registration deadline extended',
    };
  }

  private async assertPaperAccepted(paperId: string, conferenceId: string) {
    const decision = await withTenantContext({ bypass: true }, async (tx) =>
      tx.decision.findFirst({
        where: { paperId, conferenceId, outcome: 'ACCEPT' as DecisionOutcome },
      }),
    );

    if (!decision) {
      throw new UnprocessableEntityException('Registration is only available for accepted papers');
    }
  }
}
