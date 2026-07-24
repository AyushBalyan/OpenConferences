import { Injectable, Logger } from '@nestjs/common';
import { withTenantContext } from '@openconferences/db';
import type { DiscardSweepJobPayload } from '@openconferences/schemas';
import { getConfig } from '@openconferences/config/env';
import { AuditService } from '../audit/audit.service';
import { NotificationPublisher } from '../messaging/notification.publisher';
import { computePaidState, isEffectivelyPaid } from './paid-state';

@Injectable()
export class DiscardSweepService {
  private readonly logger = new Logger(DiscardSweepService.name);

  constructor(
    private readonly audit: AuditService,
    private readonly notifications: NotificationPublisher,
  ) {}

  async runDiscardSweep(payload: DiscardSweepJobPayload = {}) {
    const now = new Date();
    const config = getConfig();

    const candidates = await withTenantContext({}, async (tx) =>
      tx.registration.findMany({
        where: {
          status: {
            notIn: ['PAID', 'DISCARDED_NONPAYMENT', 'CANCELLED', 'REFUNDED'],
          },
          ...(payload.conferenceId ? { conferenceId: payload.conferenceId } : {}),
          OR: [
            { deadlineAt: { lt: now }, status: { not: 'ADDITIONAL_PAYMENT_REQUIRED' } },
            {
              status: 'ADDITIONAL_PAYMENT_REQUIRED',
              additionalGraceUntil: { lt: now },
            },
            {
              status: 'ADDITIONAL_PAYMENT_REQUIRED',
              additionalGraceUntil: null,
              deadlineAt: {
                lt: new Date(now.getTime() - config.billing.additionalGraceDays * 86400000),
              },
            },
          ],
        },
        include: {
          paper: {
            include: {
              authorships: {
                where: { isCorresponding: true },
                select: { email: true, fullName: true },
              },
            },
          },
        },
      }),
    );

    let discarded = 0;

    for (const registration of candidates) {
      const paidState = await withTenantContext({}, async (tx) =>
        computePaidState(tx, registration.id),
      );

      if (
        registration.status === 'AWAITING_VERIFICATION' &&
        isEffectivelyPaid(registration, paidState)
      ) {
        continue;
      }

      if (registration.status === 'ADDITIONAL_PAYMENT_REQUIRED') {
        const graceEnd =
          registration.additionalGraceUntil ??
          new Date(
            registration.deadlineAt.getTime() + config.billing.additionalGraceDays * 86400000,
          );
        if (now <= graceEnd && paidState.netMinor < registration.amountDueMinor) {
          // still in grace
        } else if (paidState.netMinor >= registration.amountDueMinor) {
          continue;
        }
      } else if (
        paidState.netMinor >= registration.amountDueMinor &&
        registration.amountDueMinor > 0
      ) {
        continue;
      }

      if (registration.status === 'PAID') {
        continue;
      }

      await withTenantContext({}, async (tx) => {
        await tx.registration.update({
          where: { id: registration.id },
          data: { status: 'DISCARDED_NONPAYMENT', version: { increment: 1 } },
        });

        await tx.paper.update({
          where: { id: registration.paperId },
          data: { status: 'WITHDRAWN_NONPAYMENT', version: { increment: 1 } },
        });
      });

      await this.audit.log({
        organizationId: registration.organizationId,
        conferenceId: registration.conferenceId,
        action: 'registration.discarded_nonpayment',
        entity: 'Registration',
        entityId: registration.id,
        diff: { paperId: registration.paperId },
      });

      const author = registration.paper.authorships[0];
      if (author?.email && !config.isTest) {
        await this.notifications.publishRegistrationDiscarded({
          to: author.email,
          conferenceId: registration.conferenceId,
          organizationId: registration.organizationId,
          paperTitle: registration.paper.title,
          registrationId: registration.id,
          idempotencyKey: `registration-discarded-${registration.id}`,
        });
      }

      discarded += 1;
    }

    this.logger.log({ discarded, conferenceId: payload.conferenceId }, 'Discard sweep completed');
    return { discarded };
  }
}
