import { withTenantContext } from '@openconferences/db';
import type { DiscardSweepJobPayload } from '@openconferences/schemas';

export async function processDiscardSweepJob(
  payload: DiscardSweepJobPayload,
): Promise<{ discarded: number }> {
  const now = new Date();

  const candidates = await withTenantContext({}, async (tx) =>
    tx.registration.findMany({
      where: {
        status: { notIn: ['PAID', 'DISCARDED_NONPAYMENT', 'CANCELLED', 'REFUNDED'] },
        ...(payload.conferenceId ? { conferenceId: payload.conferenceId } : {}),
      },
    }),
  );

  let discarded = 0;

  for (const registration of candidates) {
    const payments = await withTenantContext({}, async (tx) =>
      tx.payment.findMany({ where: { registrationId: registration.id } }),
    );

    let captured = 0;
    let refunded = 0;
    for (const payment of payments) {
      if (payment.status === 'CAPTURED' && payment.kind !== 'REFUND')
        captured += payment.amountMinor;
      if (payment.kind === 'REFUND') refunded += payment.amountMinor;
    }
    const net = captured - refunded;

    if (registration.status === 'AWAITING_VERIFICATION' && net >= registration.amountDueMinor) {
      continue;
    }

    if (net >= registration.amountDueMinor && registration.amountDueMinor > 0) {
      continue;
    }

    const pastDeadline = registration.deadlineAt < now;
    const pastGrace =
      registration.status === 'ADDITIONAL_PAYMENT_REQUIRED' &&
      registration.additionalGraceUntil &&
      registration.additionalGraceUntil < now;

    if (!pastDeadline && !pastGrace) {
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

    discarded += 1;
  }

  return { discarded };
}
