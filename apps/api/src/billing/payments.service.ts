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
import type { RefundInput, VerifyPaymentInput, PaymentQuote } from '@openconferences/schemas';
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
import { parseFeeSchedule } from './fee-resolver';
import { RazorpayProvider } from './razorpay.provider';
import type { ParsedWebhookEvent } from './payment-provider.interface';

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
    private readonly razorpay: RazorpayProvider,
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

    const feeSchedule = parseFeeSchedule(conference.feeSchedule);
    const billingAffiliation = await this.registrations.resolveBillingAffiliation(
      userId,
      registration,
    );
    if (!billingAffiliation) {
      throw new UnprocessableEntityException(
        'Enter your affiliation for the invoice before payment.',
      );
    }
    const provider = this.providerRegistry.resolve(conference.organizationId);
    let quote: PaymentQuote | undefined;
    if (!registration.lockedTiming && registration.status === 'PENDING') {
      try {
        quote = await this.registrations.quoteForPayment(userId, registration, feeSchedule);
      } catch (error) {
        throw new UnprocessableEntityException(
          error instanceof Error ? error.message : 'Unable to calculate fee',
        );
      }
    }

    // Reserve locally under a row lock; call Razorpay after committing, keeping network I/O
    // outside the transaction. Concurrent clicks reuse the same checkout for this paper.
    const reserved = await withTenantContext(
      { userId, conferenceId, organizationId: conference.organizationId },
      async (tx) => {
        const current = await lockRegistrationForUpdate(tx, registration.id);
        if (!current) throw new NotFoundException('Registration not found');
        if (!['PENDING', 'ADDITIONAL_PAYMENT_REQUIRED'].includes(current.status)) {
          throw new ConflictException('Registration is already paid or is no longer payable');
        }
        const deadline = current.additionalGraceUntil ?? current.deadlineAt;
        if (new Date() > deadline || new Date() < current.windowOpensAt) {
          throw new ConflictException('Registration payment window is closed');
        }
        if (current.userId && current.userId !== userId) {
          throw new ConflictException(
            'Another author has already started registration for this paper',
          );
        }
        if (current.audience === 'STUDENT' && current.status !== 'ADDITIONAL_PAYMENT_REQUIRED') {
          const verification = await tx.studentVerification.findFirst({
            where: { registrationId: current.id },
            include: { fileAsset: true },
            orderBy: { createdAt: 'desc' },
          });
          if (
            !verification ||
            !['PENDING', 'APPROVED'].includes(verification.status) ||
            verification.fileAsset.scanStatus !== 'CLEAN'
          ) {
            throw new UnprocessableEntityException(
              'Upload a valid student verification document before payment',
            );
          }
        }
        const byKey = await tx.payment.findFirst({ where: { idempotencyKey } });
        if (byKey && byKey.registrationId !== current.id) {
          throw new ConflictException('Idempotency key belongs to another registration');
        }
        const pending = await tx.payment.findFirst({
          where: { registrationId: current.id, status: 'CREATED' },
          orderBy: { createdAt: 'desc' },
        });
        if (pending?.providerOrderId && pending.provider === provider.name)
          return { payment: pending, registration: current, create: false };
        if (
          pending &&
          pending.provider === provider.name &&
          pending.createdAt.getTime() > Date.now() - 60000
        ) {
          throw new ConflictException('Checkout is being prepared. Please try again shortly.');
        }
        if (pending)
          await tx.payment.update({ where: { id: pending.id }, data: { status: 'FAILED' } });
        if (byKey) throw new ConflictException('Use a new idempotency key to retry this payment');
        if (current.version !== registration.version) {
          throw new ConflictException(
            'Registration details changed. Please refresh and try again.',
          );
        }
        const kind = current.status === 'ADDITIONAL_PAYMENT_REQUIRED' ? 'ADDITIONAL' : 'INITIAL';
        const paidState = await computePaidState(tx, current.id);
        const amountMinor =
          kind === 'ADDITIONAL'
            ? current.amountDueMinor - paidState.netMinor
            : (quote?.amountMinor ?? current.amountDueMinor);
        const currency = quote?.currency ?? current.currency;
        if (!Number.isSafeInteger(amountMinor) || amountMinor < 100) {
          throw new ConflictException('No payable amount is due');
        }
        const updated = await tx.registration.update({
          where: { id: current.id },
          data: {
            userId,
            billingAffiliation,
            ...(quote
              ? {
                  amountDueMinor: quote.amountMinor,
                  regularAmountDueMinor: quote.regularAmountMinor,
                  currency: quote.currency,
                  lockedTiming: quote.timing,
                  isAdditionalPaper: quote.isAdditionalPaper,
                }
              : {}),
            version: { increment: 1 },
          },
        });
        const payment = await tx.payment.create({
          data: {
            id: generateId(),
            organizationId: conference.organizationId,
            registrationId: current.id,
            provider: provider.name,
            status: 'CREATED',
            amountMinor,
            currency,
            kind,
            idempotencyKey,
          },
        });
        return { payment, registration: updated, create: true };
      },
    );
    if (!reserved.create)
      return this.buildInitiateResponse(
        reserved.payment,
        reserved.registration,
        reserved.payment.provider,
      );

    let payment;
    try {
      const order = await provider.createOrder({
        amountMinor: reserved.payment.amountMinor,
        currency: reserved.payment.currency,
        receipt: `r${reserved.payment.id.replace(/-/g, '')}`,
        notes: {
          registrationId: registration.id,
          paperId,
          conferenceId,
          billingCountry: registration.billingCountry ?? '',
        },
      });
      payment = await withTenantContext({ userId, conferenceId }, async (tx) =>
        tx.payment.update({
          where: { id: reserved.payment.id },
          data: {
            providerOrderId: order.orderId,
            rawPayload: order.raw as object,
          },
        }),
      );
    } catch (error) {
      await withTenantContext({ userId, conferenceId }, async (tx) =>
        tx.payment.update({ where: { id: reserved.payment.id }, data: { status: 'FAILED' } }),
      );
      throw error;
    }
    await this.audit.log({
      actorUserId: userId,
      organizationId: conference.organizationId,
      conferenceId,
      action: 'payment.initiated',
      entity: 'Payment',
      entityId: payment.id,
      diff: {
        orderId: payment.providerOrderId,
        amountMinor: payment.amountMinor,
        kind: payment.kind,
      },
    });
    return this.buildInitiateResponse(payment, reserved.registration, payment.provider);
  }

  async verifyPayment(
    userId: string,
    conferenceId: string,
    paperId: string,
    input: VerifyPaymentInput,
    roles: RoleKind[],
  ) {
    await this.conferences.loadConference(userId, conferenceId, roles);
    // Access remains valid for a paid paper even if its decision changes later.
    const registration = await this.registrations.loadRegistration(userId, conferenceId, paperId);
    if (registration.userId !== userId)
      throw new ForbiddenException('Only the registering author can verify payment');
    const payment = await withTenantContext({ userId, conferenceId }, async (tx) =>
      tx.payment.findFirst({
        where: {
          registrationId: registration.id,
          provider: 'razorpay',
          providerOrderId: input.razorpay_order_id,
        },
      }),
    );
    if (!payment?.providerOrderId) throw new NotFoundException('Payment order not found');
    // Use the order ID saved by the server, never an untrusted client ID in isolation.
    if (
      !this.razorpay.verifyCheckoutSignature(
        payment.providerOrderId,
        input.razorpay_payment_id,
        input.razorpay_signature,
      )
    ) {
      throw new BadRequestException('Invalid payment signature');
    }
    const entity = await this.razorpay.fetchPayment(input.razorpay_payment_id);
    if (
      entity.id !== input.razorpay_payment_id ||
      entity.order_id !== payment.providerOrderId ||
      entity.amount !== payment.amountMinor ||
      entity.currency !== payment.currency
    ) {
      throw new BadRequestException('Payment does not match the registration order');
    }
    const captured = entity.status === 'captured' && entity.captured === true;
    if (captured) {
      await this.processCapture('razorpay', {
        eventType: 'payment.captured',
        orderId: entity.order_id,
        paymentId: entity.id,
        amountMinor: entity.amount,
        currency: entity.currency,
        capturedAt: new Date(entity.created_at * 1000),
        raw: entity,
      });
    }
    return {
      verified: true as const,
      captured,
      registration: mapRegistration(
        await this.registrations.loadRegistration(userId, conferenceId, paperId),
      ),
    };
  }

  async handleWebhook(rawBody: Buffer, signature: string, timestamp?: string) {
    const provider = this.providerRegistry.resolve();

    if (!provider.verifyWebhookSignature(rawBody, signature, timestamp)) {
      throw new ForbiddenException('Invalid webhook signature');
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody.toString('utf8'));
    } catch {
      throw new BadRequestException('Invalid webhook payload');
    }
    const event = provider.parseWebhook(payload);

    if (!event) {
      return { received: true };
    }

    return this.processCapture(provider.name, event);
  }

  private async processCapture(providerName: string, event: ParsedWebhookEvent) {
    const payment = await withTenantContext({}, async (tx) =>
      tx.payment.findFirst({
        where: {
          provider: providerName,
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
          provider: providerName,
          providerPaymentId: event.paymentId,
        },
      }),
    );

    if (duplicate && duplicate.id !== payment.id) {
      return { received: true };
    }

    const captureContext = {
      userId: payment.registration.userId ?? undefined,
      organizationId: payment.organizationId,
      conferenceId: payment.registration.conferenceId,
    };
    const applied = await withTenantContext(captureContext, async (tx) => {
      const locked = await lockRegistrationForUpdate(tx, payment.registrationId);
      if (!locked) {
        throw new NotFoundException('Registration not found');
      }

      const currentPayment = await tx.payment.findUnique({ where: { id: payment.id } });
      if (!currentPayment) throw new NotFoundException('Payment not found');
      if (
        currentPayment.status === 'CAPTURED' ||
        currentPayment.status === 'REFUNDED' ||
        currentPayment.status === 'PARTIALLY_REFUNDED'
      )
        return false;
      if (
        event.amountMinor !== currentPayment.amountMinor ||
        event.currency !== currentPayment.currency
      ) {
        throw new BadRequestException(
          'Captured payment amount or currency does not match the order',
        );
      }

      let lockedTiming = locked.lockedTiming;
      let amountDueMinor = locked.amountDueMinor;

      if (payment.kind === 'INITIAL' && !lockedTiming) {
        const conference = await tx.conference.findFirst({ where: { id: locked.conferenceId } });
        if (!conference) throw new NotFoundException('Conference not found');
        const feeSchedule = parseFeeSchedule(conference.feeSchedule);
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
      let nextStatus = deriveRegistrationStatusAfterCapture(updatedRegistration, paidState);
      if (nextStatus === 'AWAITING_VERIFICATION') {
        const verification = await tx.studentVerification.findFirst({
          where: { registrationId: locked.id },
          orderBy: { createdAt: 'desc' },
        });
        if (verification?.status === 'APPROVED') nextStatus = 'PAID';
      }

      await tx.registration.update({
        where: { id: locked.id },
        data: { status: nextStatus },
      });
      return true;
    });
    const capturedPayment = await withTenantContext(captureContext, async (tx) =>
      tx.payment.findFirst({
        where: { id: payment.id, status: 'CAPTURED', providerPaymentId: event.paymentId },
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
      if (applied)
        await this.audit.log({
          actorUserId: capturedPayment.registration.userId,
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

      // Capture is already committed. Invoice upload and mail must not
      // turn the webhook into a 500, or the provider retries a paid order.
      try {
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
      } catch (err) {
        this.logger.error(
          { err, paymentId: capturedPayment.id },
          'Payment captured; invoice generation could not be scheduled',
        );
      }
      try {
        await this.sendPaymentConfirmation(capturedPayment);
      } catch (err) {
        this.logger.error(
          { err, paymentId: capturedPayment.id },
          'Payment captured; confirmation email could not be queued',
        );
        // A provider retry can retry the notification without repeating the charge.
        throw err;
      }
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

  private async sendPaymentConfirmation(
    payment: Payment & {
      registration: Registration & {
        paper: { title: string; authorships: Array<{ email: string; isCorresponding: boolean }> };
        payer: { email: string } | null;
      };
    },
  ) {
    const config = getConfig();

    const corresponding =
      payment.registration.paper.authorships.find((a) => a.isCorresponding) ??
      payment.registration.paper.authorships[0];
    const to = payment.registration.payer?.email ?? corresponding?.email;
    if (!to) {
      this.logger.warn({ paymentId: payment.id }, 'No recipient email for payment confirmation');
      return;
    }

    const amountFormatted = `${(payment.amountMinor / 100).toFixed(2)} ${payment.currency}`;

    await this.notifications.publishPaymentCaptured({
      to,
      conferenceId: payment.registration.conferenceId,
      organizationId: payment.organizationId,
      paperTitle: payment.registration.paper.title,
      amountFormatted,
      transactionId: payment.providerPaymentId ?? payment.id,
      registrationUrl: `${config.webUrl.replace(/\/$/, '')}/dashboard/conferences/${payment.registration.conferenceId}/submissions/${payment.registration.paperId}?section=registration`,
      paymentId: payment.id,
      idempotencyKey: `payment-captured-${payment.id}`,
    });
  }
}
