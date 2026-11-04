import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { Registration, RoleKind } from '@openconferences/db';
import { generateId, withTenantContext } from '@openconferences/db';
import type {
  CreateRegistrationInput,
  BillingFeeSchedule,
  RegistrationDetailDto,
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
import { canCoordinateReview } from '../tenancy/role-hierarchy';
import { PapersService } from '../submission/papers.service';
import { mapRegistration } from './billing.mapper';
import {
  getEarlyBirdEndsAt,
  getRegistrationDeadline,
  parseFeeSchedule,
  resolveMatrixAmount,
  quoteRegistration,
  resolveTiming,
} from './fee-resolver';
import { lockRegistrationForUpdate } from './paid-state';

@Injectable()
export class RegistrationsService {
  async resolveBillingAffiliation(
    userId: string,
    registration: Registration,
  ): Promise<string | null> {
    if (registration.billingAffiliation?.trim()) return registration.billingAffiliation.trim();
    const payerId = registration.userId ?? userId;
    return withTenantContext({ userId, conferenceId: registration.conferenceId }, async (tx) => {
      const linked = await tx.authorship.findFirst({
        where: { paperId: registration.paperId, userId: payerId },
        orderBy: { order: 'asc' },
      });
      if (linked) return linked.affiliation?.trim() || null;
      const payer = await tx.user.findUnique({ where: { id: payerId }, select: { email: true } });
      if (!payer) return null;
      const legacy = await tx.authorship.findFirst({
        where: {
          paperId: registration.paperId,
          userId: null,
          email: { equals: payer.email, mode: 'insensitive' },
        },
        orderBy: { order: 'asc' },
      });
      return legacy?.affiliation?.trim() || null;
    });
  }
  constructor(
    private readonly conferences: ConferenceService,
    private readonly papers: PapersService,
    private readonly audit: AuditService,
  ) {}

  async openRegistration(
    organizationId: string,
    conferenceId: string,
    paperId: string,
    actorUserId?: string,
  ): Promise<Registration> {
    const context = { userId: actorUserId, organizationId, conferenceId };
    const conference = await withTenantContext(context, async (tx) =>
      tx.conference.findFirst({ where: { id: conferenceId } }),
    );

    if (!conference) {
      throw new NotFoundException('Conference not found');
    }

    const feeSchedule = parseFeeSchedule(conference.feeSchedule);
    const deadlineAt = getRegistrationDeadline(feeSchedule, conference.registrationDueAt);

    const existing = await withTenantContext(context, async (tx) =>
      tx.registration.findUnique({
        where: { conferenceId_paperId: { conferenceId, paperId } },
      }),
    );

    if (existing) {
      if (existing.status === 'CANCELLED') {
        // Preserve captures and locked quotes; never silently reopen a paid cancellation.
        const payments = await withTenantContext(context, (tx) =>
          tx.payment.count({
            where: {
              registrationId: existing.id,
              status: { in: ['CAPTURED', 'REFUNDED', 'PARTIALLY_REFUNDED'] },
            },
          }),
        );
        if (payments || existing.lockedTiming) {
          throw new ConflictException(
            'Cancelled checkout requires organizer reconciliation before acceptance can be released',
          );
        }
        await withTenantContext(context, (tx) =>
          tx.registration.updateMany({
            where: { id: existing.id, status: 'CANCELLED', version: existing.version },
            data: {
              status: 'PENDING',
              windowOpensAt: new Date(),
              deadlineAt,
              version: { increment: 1 },
            },
          }),
        );
        return this.loadRegistration(actorUserId!, conferenceId, paperId);
      }
      return existing;
    }

    const registration = await withTenantContext(context, async (tx) =>
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
      actorUserId,
      organizationId,
      conferenceId,
      action: 'registration.opened',
      entity: 'Registration',
      entityId: registration.id,
      diff: { paperId },
    });

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
    let paymentQuote = null;
    let paymentQuoteError: string | null = null;
    if (registration.status === 'PENDING' && !registration.lockedTiming) {
      try {
        paymentQuote = await this.quoteForPayment(userId, registration, feeSchedule);
      } catch (error) {
        paymentQuoteError =
          error instanceof Error ? error.message : 'Unable to calculate registration fee';
      }
    }

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
      billingAffiliation: await this.resolveBillingAffiliation(userId, registration),
      paymentQuote,
      paymentQuoteError,
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

    await this.assertPaperAccepted(paper.id, conferenceId, userId);

    const registration = await this.loadRegistration(userId, conferenceId, paperId);

    const billingFields = [
      'billingAffiliation',
      'billingName',
      'billingEmail',
      'billingAddress',
      'billingTaxId',
    ] as const;
    // Legacy checkouts may fill missing invoice details, but cannot overwrite
    // the saved snapshot or change the category/country that determined the fee.
    const missingBillingOnly = (row: Registration) =>
      ['PENDING', 'ADDITIONAL_PAYMENT_REQUIRED'].includes(row.status) &&
      (!row.userId || row.userId === userId) &&
      billingFields.some((field) => !row[field]?.trim() && Boolean(input[field]?.trim())) &&
      billingFields.every(
        (field) =>
          input[field] === undefined ||
          !row[field]?.trim() ||
          input[field]?.trim() === row[field]?.trim(),
      ) &&
      input.audience === row.audience &&
      (!input.billingCountry || input.billingCountry === row.billingCountry);
    if (
      (registration.status !== 'PENDING' || registration.lockedTiming) &&
      !missingBillingOnly(registration)
    ) {
      throw new ConflictException('Registration details cannot be changed after checkout begins');
    }

    const billingAffiliation =
      input.billingAffiliation ?? (await this.resolveBillingAffiliation(userId, registration));
    if (!billingAffiliation)
      throw new UnprocessableEntityException(
        'Enter your affiliation for the invoice before payment.',
      );

    const updated = await withTenantContext(
      { userId, conferenceId, organizationId: conference.organizationId },
      async (tx) => {
        const current = await lockRegistrationForUpdate(tx, registration.id);

        if (!current) {
          throw new NotFoundException('Registration not found');
        }
        const lockedDetails = current.status !== 'PENDING' || Boolean(current.lockedTiming);
        if (lockedDetails && !missingBillingOnly(current)) {
          throw new ConflictException(
            'Registration details cannot be changed after checkout begins',
          );
        }

        return tx.registration.update({
          where: { id: current.id },
          data: {
            ...(!lockedDetails
              ? {
                  audience: input.audience,
                  ...(input.billingCountry ? { billingCountry: input.billingCountry } : {}),
                }
              : {}),
            billingAffiliation:
              lockedDetails && current.billingAffiliation?.trim()
                ? current.billingAffiliation
                : billingAffiliation,
            ...(input.billingName !== undefined ? { billingName: input.billingName } : {}),
            ...(input.billingEmail !== undefined
              ? { billingEmail: input.billingEmail || null }
              : {}),
            ...(input.billingAddress !== undefined ? { billingAddress: input.billingAddress } : {}),
            ...(input.billingTaxId !== undefined
              ? { billingTaxId: input.billingTaxId || null }
              : {}),
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

  async listRegistrations(
    userId: string,
    conferenceId: string,
    roles: RoleKind[],
    options: CursorPaginationOptions & {
      status?: Registration['status'] | 'at-risk' | 'unpaid' | 'paid';
      audience?: Registration['audience'];
    } = {},
  ) {
    if (!canCoordinateReview(roles)) {
      throw new ForbiddenException('Insufficient permissions to list registrations');
    }

    const conference = await this.conferences.loadConference(userId, conferenceId, roles);
    const limit = resolveLimit(options.limit);

    const rows = await withTenantContext(
      { userId, conferenceId, organizationId: conference.organizationId },
      async (tx) =>
        tx.registration.findMany({
          where: {
            conferenceId,
            ...this.buildRegistrationListFilters(options),
          },
          include: { paper: { select: { title: true, submittedAt: true } } },
          orderBy: { createdAt: 'desc' },
          ...prismaCursorArgs(options, limit),
        }),
    );

    const page = paginateItems(rows, limit, (row) => row.id);

    return {
      data: page.data.map((row) => ({
        ...mapRegistration(row),
        paperTitle: row.paper.title,
        paperSubmittedAt: row.paper.submittedAt?.toISOString() ?? null,
      })),
      nextCursor: page.nextCursor,
    };
  }

  async loadRegistrationForPayment(
    userId: string,
    conferenceId: string,
    paperId: string,
    roles: RoleKind[],
  ): Promise<Registration> {
    const paper = await this.papers.loadPaper(userId, conferenceId, paperId, roles);
    if (
      paper.submittedById !== userId &&
      !paper.authorships.some((author) => author.userId === userId)
    ) {
      throw new ForbiddenException('Only a paper author can pay for registration');
    }
    await this.assertPaperAccepted(paperId, conferenceId, userId);
    return this.loadRegistration(userId, conferenceId, paperId);
  }

  async quoteForPayment(
    userId: string,
    registration: Registration,
    feeSchedule: BillingFeeSchedule,
  ) {
    const bases = await withTenantContext(
      { userId, conferenceId: registration.conferenceId },
      async (tx) =>
        tx.registration.findMany({
          where: {
            conferenceId: registration.conferenceId,
            userId,
            id: { not: registration.id },
            isAdditionalPaper: false,
            status: { in: ['PAID', 'AWAITING_VERIFICATION'] },
          },
          include: { payments: true },
        }),
    );
    // Require actual captured funds, not merely an organizer-set status.
    const hasPaidBasePaper = bases.some((base) => {
      const net = base.payments.reduce((sum, payment) => {
        if (
          payment.kind === 'REFUND' &&
          ['REFUNDED', 'PARTIALLY_REFUNDED'].includes(payment.status)
        )
          return sum - payment.amountMinor;
        if (payment.kind !== 'REFUND' && payment.status === 'CAPTURED')
          return sum + payment.amountMinor;
        return sum;
      }, 0);
      return base.amountDueMinor > 0 && net >= base.amountDueMinor;
    });
    return quoteRegistration(
      feeSchedule,
      registration.audience,
      registration.billingCountry,
      hasPaidBasePaper,
    );
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
    const timing = lockedTiming ?? resolveTiming(capturedAt, earlyBirdEndsAt);

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
      { userId, conferenceId, organizationId: conference.organizationId },
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

  private buildRegistrationListFilters(options: {
    status?: Registration['status'] | 'at-risk' | 'unpaid' | 'paid';
    audience?: Registration['audience'];
  }) {
    const filters: {
      status?: Registration['status'] | { notIn: Registration['status'][] };
      audience?: Registration['audience'];
      deadlineAt?: { lte: Date };
    } = {};

    if (options.audience) {
      filters.audience = options.audience;
    }

    if (options.status === 'paid') {
      filters.status = 'PAID';
    } else if (options.status === 'unpaid') {
      filters.status = { notIn: ['PAID', 'REFUNDED'] };
    } else if (options.status === 'at-risk') {
      filters.status = { notIn: ['PAID', 'CANCELLED', 'REFUNDED', 'DISCARDED_NONPAYMENT'] };
      filters.deadlineAt = { lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) };
    } else if (options.status) {
      filters.status = options.status;
    }

    return filters;
  }

  private async assertPaperAccepted(paperId: string, conferenceId: string, userId: string) {
    const [decision, paper] = await withTenantContext({ userId, conferenceId }, async (tx) =>
      Promise.all([
        tx.decision.findFirst({
          where: { paperId, conferenceId },
          orderBy: [{ round: { roundNumber: 'desc' } }, { createdAt: 'desc' }],
        }),
        tx.paper.findFirst({ where: { id: paperId, conferenceId }, select: { status: true } }),
      ]),
    );

    if (
      decision?.outcome !== 'ACCEPT' ||
      !decision.notifiedAt ||
      !paper ||
      !['DECISION_MADE', 'CAMERA_READY'].includes(paper.status)
    ) {
      throw new UnprocessableEntityException('Registration is only available for accepted papers');
    }
  }
}
