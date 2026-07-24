import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { NotificationPublisher } from '../messaging/notification.publisher';
import { generateId, withTenantContext } from '@openconferences/db';
import type { Payment, Registration, RoleKind } from '@openconferences/db';
import type { RefundInput } from '@openconferences/schemas';
import { getConfig } from '@openconferences/config/env';
import { AuditService } from '../audit/audit.service';
import { QueueService } from '../queue/queue.service';
import { ConferenceService } from '../tenancy/conference.service';
import { canCoordinateReview } from '../tenancy/role-hierarchy';
import { mapRegistration } from './billing.mapper';
import {
  computePaidState,
  deriveRegistrationStatusAfterCapture,
  deriveRegistrationStatusAfterRefund,
  lockRegistrationForUpdate,
} from './paid-state';
import { PaymentProviderRegistry } from './payment-provider.registry';
import { RegistrationsService } from './registrations.service';
import { InvoicesService } from './invoices.service';
import { estimateProvisionalAmount, parseFeeSchedule } from './fee-resolver';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly conferences: ConferenceService,
    private readonly registrations: RegistrationsService,
    private readonly providerRegistry: PaymentProviderRegistry,
    private readonly audit: AuditService,
    private readonly notifications: NotificationPublisher,
    private readonly queue: QueueService,
    private readonly invoices: InvoicesService,
  ) {}

  async initiatePayment(
    userId: string,
    conferenceId: string,
    paperId: string,
    idempotencyKey: string,
    roles: RoleKind[],
  ) {
    const conference = await this.conferences.loadConference(userId, conferenceId, roles);
    const registration = await this.registrations.loadRegistrationForPayment(
      userId,
      conferenceId,
      paperId,
      roles,
    );

    if (registration.status === 'PAID') {
      throw new ConflictException('Registration is already paid');
    }

    if (registration.status === 'AWAITING_VERIFICATION') {
      throw new ConflictException('Registration payment is pending verification');
    }

    if (registration.status === 'DISCARDED_NONPAYMENT' || registration.status === 'CANCELLED') {
      throw new ConflictException('Registration is no longer payable');
    }

    if (new Date() > registration.deadlineAt) {
      throw new ConflictException('Registration deadline has passed');
    }

    if (registration.audience === 'STUDENT') {
      const hasDoc = await this.hasStudentDocument(registration.id);
      if (!hasDoc) {
        throw new UnprocessableEntityException(
          'Student verification document is required before payment',
        );
      }
    }

    const existingByKey = await withTenantContext({}, async (tx) =>
      tx.payment.findFirst({ where: { idempotencyKey } }),
    );

    if (existingByKey) {
      const provider = this.providerRegistry.resolve(conference.organizationId);
      return this.buildInitiateResponse(existingByKey, registration, provider.name);
    }

    const feeSchedule = parseFeeSchedule(conference.feeSchedule);
    const kind = registration.status === 'ADDITIONAL_PAYMENT_REQUIRED' ? 'ADDITIONAL' : 'INITIAL';

    let amountMinor: number;
    if (kind === 'ADDITIONAL') {
      const paidState = await withTenantContext({}, async (tx) =>
        computePaidState(tx, registration.id),
      );
      amountMinor = registration.amountDueMinor - paidState.netMinor;
      if (amountMinor <= 0) {
        throw new ConflictException('No additional payment is due');
      }
    } else {
      amountMinor = estimateProvisionalAmount(feeSchedule, registration.audience);
    }

    const provider = this.providerRegistry.resolve(conference.organizationId);
    const order = await provider.createOrder({
      amountMinor,
      currency: feeSchedule.currency,
      receipt: `reg-${registration.id}-${kind.toLowerCase()}`,
      notes: {
        registrationId: registration.id,
        paperId,
        conferenceId,
      },
    });

    const payment = await withTenantContext(
      { userId, conferenceId, organizationId: conference.organizationId },
      async (tx) =>
        tx.payment.create({
          data: {
            id: generateId(),
            organizationId: conference.organizationId,
            registrationId: registration.id,
            provider: provider.name,
            providerOrderId: order.orderId,
            status: 'CREATED',
            amountMinor: order.amountMinor,
            currency: order.currency,
            kind,
            idempotencyKey,
            rawPayload: order.raw as object,
          },
        }),
    );

    await withTenantContext({}, async (tx) =>
      tx.registration.update({
        where: { id: registration.id },
        data: { userId },
      }),
    );

    await this.audit.log({
      actorUserId: userId,
      organizationId: conference.organizationId,
      conferenceId,
      action: 'payment.initiated',
      entity: 'Payment',
      entityId: payment.id,
      diff: { orderId: order.orderId, amountMinor, kind },
    });

    return this.buildInitiateResponse(payment, registration, provider.name);
  }

  async handleWebhook(rawBody: Buffer, signature: string, timestamp?: string) {
    const provider = this.providerRegistry.resolve();

    if (!provider.verifyWebhookSignature(rawBody, signature, timestamp)) {
      throw new ForbiddenException('Invalid webhook signature');
    }

    const payload = JSON.parse(rawBody.toString('utf8')) as unknown;
    const event = provider.parseWebhook(payload);

    if (!event) {
      return { received: true };
    }

    const payment = await withTenantContext({}, async (tx) =>
      tx.payment.findFirst({
        where: {
          provider: provider.name,
          providerOrderId: event.orderId,
        },
        include: { registration: true },
      }),
    );

    if (!payment) {
      this.logger.warn({ orderId: event.orderId }, 'Webhook for unknown payment order');
      return { received: true };
    }

    const duplicate = await withTenantContext({}, async (tx) =>
      tx.payment.findFirst({
        where: {
          provider: provider.name,
          providerPaymentId: event.paymentId,
        },
      }),
    );

    if (duplicate && duplicate.id !== payment.id) {
      return { received: true };
    }

    if (payment.status === 'CAPTURED' && payment.providerPaymentId === event.paymentId) {
      return { received: true };
    }

    await withTenantContext({}, async (tx) => {
      const locked = await lockRegistrationForUpdate(tx, payment.registrationId);
      if (!locked) {
        throw new NotFoundException('Registration not found');
      }

      const conference = await tx.conference.findFirst({
        where: { id: locked.conferenceId },
      });

      if (!conference) {
        throw new NotFoundException('Conference not found');
      }

      const feeSchedule = parseFeeSchedule(conference.feeSchedule);

      let lockedTiming = locked.lockedTiming;
      let amountDueMinor = locked.amountDueMinor;

      if (payment.kind === 'INITIAL' && !lockedTiming) {
        const resolved = this.registrations.resolveAmountDue(
          feeSchedule,
          locked.audience,
          locked.lockedTiming,
          event.capturedAt,
          conference.registrationDueAt,
        );
        lockedTiming = resolved.lockedTiming;
        amountDueMinor = resolved.amountDueMinor;
      }

      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: 'CAPTURED',
          providerPaymentId: event.paymentId,
          amountMinor: event.amountMinor,
          currency: event.currency,
          rawPayload: event.raw as object,
        },
      });

      const updatedRegistration = await tx.registration.update({
        where: { id: locked.id },
        data: {
          lockedTiming: lockedTiming ?? locked.lockedTiming,
          amountDueMinor: payment.kind === 'INITIAL' ? amountDueMinor : locked.amountDueMinor,
          version: { increment: 1 },
        },
      });

      const paidState = await computePaidState(tx, locked.id);
      const nextStatus = deriveRegistrationStatusAfterCapture(updatedRegistration, paidState);

      await tx.registration.update({
        where: { id: locked.id },
        data: { status: nextStatus },
      });
    });

    const capturedPayment = await withTenantContext({}, async (tx) =>
      tx.payment.findFirst({
        where: { id: payment.id },
        include: {
          registration: {
            include: {
              paper: { include: { authorships: true } },
              payer: { select: { email: true } },
            },
          },
        },
      }),
    );

    if (capturedPayment) {
      await this.audit.log({
        organizationId: capturedPayment.organizationId,
        conferenceId: capturedPayment.registration.conferenceId,
        action: 'payment.captured',
        entity: 'Payment',
        entityId: capturedPayment.id,
        diff: {
          providerPaymentId: event.paymentId,
          amountMinor: event.amountMinor,
        },
      });

      await this.queue.enqueueInvoiceGeneration({
        paymentId: capturedPayment.id,
        organizationId: capturedPayment.organizationId,
        conferenceId: capturedPayment.registration.conferenceId,
        registrationId: capturedPayment.registrationId,
      });

      if (getConfig().isTest) {
        await this.invoices.generateInvoice({
          paymentId: capturedPayment.id,
          organizationId: capturedPayment.organizationId,
          conferenceId: capturedPayment.registration.conferenceId,
          registrationId: capturedPayment.registrationId,
        });
      }

      await this.sendPaymentConfirmation(capturedPayment);
    }

    return { received: true };
  }

  async refund(
    userId: string,
    conferenceId: string,
    registrationId: string,
    input: RefundInput,
    roles: RoleKind[],
  ) {
    if (!canCoordinateReview(roles)) {
      throw new ForbiddenException('Insufficient permissions to refund');
    }

    const conference = await this.conferences.loadConference(userId, conferenceId, roles);
    const provider = this.providerRegistry.resolve(conference.organizationId);

    const result = await withTenantContext(
      { userId, conferenceId, organizationId: conference.organizationId },
      async (tx) => {
        const registration = await lockRegistrationForUpdate(tx, registrationId);
        if (!registration || registration.conferenceId !== conferenceId) {
          throw new NotFoundException('Registration not found');
        }

        if (registration.version !== input.version) {
          throw new ConflictException('Registration was modified by another request');
        }

        const captured = await tx.payment.findFirst({
          where: {
            registrationId,
            status: 'CAPTURED',
            kind: { in: ['INITIAL', 'ADDITIONAL'] },
            providerPaymentId: { not: null },
          },
          orderBy: { createdAt: 'desc' },
        });

        if (!captured?.providerPaymentId) {
          throw new BadRequestException('No captured payment available to refund');
        }

        const paidState = await computePaidState(tx, registrationId);
        if (input.amountMinor > paidState.netMinor) {
          throw new BadRequestException('Refund amount exceeds net paid amount');
        }

        const refundResult = await provider.refund({
          paymentId: captured.providerPaymentId,
          amountMinor: input.amountMinor,
          notes: { reason: input.reason },
        });

        await tx.payment.create({
          data: {
            id: generateId(),
            organizationId: conference.organizationId,
            registrationId,
            provider: provider.name,
            providerPaymentId: refundResult.refundId,
            status: 'REFUNDED',
            amountMinor: input.amountMinor,
            currency: captured.currency,
            kind: 'REFUND',
            rawPayload: refundResult.raw as object,
          },
        });

        const newPaidState = await computePaidState(tx, registrationId);
        const nextStatus = deriveRegistrationStatusAfterRefund(registration, newPaidState);

        const updated = await tx.registration.update({
          where: { id: registrationId },
          data: {
            status: nextStatus,
            version: { increment: 1 },
          },
        });

        return updated;
      },
    );

    await this.audit.log({
      actorUserId: userId,
      organizationId: conference.organizationId,
      conferenceId,
      action: 'payment.refunded',
      entity: 'Registration',
      entityId: registrationId,
      diff: { amountMinor: input.amountMinor, reason: input.reason },
    });

    return {
      registration: mapRegistration(result),
      message: 'Refund processed successfully',
    };
  }

  async runReconciliation(paymentId?: string) {
    const stalePayments = await withTenantContext({}, async (tx) =>
      tx.payment.findMany({
        where: {
          status: 'CREATED',
          ...(paymentId ? { id: paymentId } : {}),
          createdAt: { lt: new Date(Date.now() - 30 * 60 * 1000) },
        },
        take: 100,
      }),
    );

    for (const payment of stalePayments) {
      await this.audit.log({
        organizationId: payment.organizationId,
        action: 'payment.reconciliation_stale',
        entity: 'Payment',
        entityId: payment.id,
        diff: { providerOrderId: payment.providerOrderId },
      });
    }

    return { inspected: stalePayments.length };
  }

  private buildInitiateResponse(
    payment: Payment,
    registration: Registration,
    providerName: string,
  ) {
    return {
      paymentId: payment.id,
      provider: providerName,
      orderId: payment.providerOrderId!,
      amountMinor: payment.amountMinor,
      currency: payment.currency,
      keyId: this.providerRegistry.getKeyId(),
      registration: mapRegistration(registration),
    };
  }

  private async hasStudentDocument(registrationId: string): Promise<boolean> {
    const verification = await withTenantContext({}, async (tx) =>
      tx.studentVerification.findFirst({
        where: {
          registrationId,
          status: {
            in: ['PENDING', 'APPROVED', 'CLARIFICATION_REQUESTED', 'REJECTED'],
          },
        },
        include: { fileAsset: true },
        orderBy: { createdAt: 'desc' },
      }),
    );

    return Boolean(verification?.fileAsset?.scanStatus === 'CLEAN');
  }

  private async sendPaymentConfirmation(
    payment: Payment & {
      registration: Registration & {
        paper: { title: string; authorships: Array<{ email: string; isCorresponding: boolean }> };
        payer: { email: string } | null;
      };
    },
  ) {
    const config = getConfig();
    if (config.isTest) {
      return;
    }

    const corresponding =
      payment.registration.paper.authorships.find((a) => a.isCorresponding) ??
      payment.registration.paper.authorships[0];
    const to = payment.registration.payer?.email ?? corresponding?.email;
    if (!to) {
      this.logger.warn({ paymentId: payment.id }, 'No recipient email for payment confirmation');
      return;
    }

    const amountFormatted = `${payment.amountMinor / 100} ${payment.currency}`;

    await this.notifications.publishPaymentCaptured({
      to,
      conferenceId: payment.registration.conferenceId,
      organizationId: payment.organizationId,
      paperTitle: payment.registration.paper.title,
      amountFormatted,
      paymentId: payment.id,
      idempotencyKey: `payment-captured-${payment.id}`,
    });
  }
}
