import type { Payment, Registration } from '@openconferences/db';
import type { TransactionClient } from '../common/types/transaction-client';

export type PaidState = {
  capturedMinor: number;
  refundedMinor: number;
  netMinor: number;
};

export async function computePaidState(
  tx: TransactionClient,
  registrationId: string,
): Promise<PaidState> {
  const payments = await tx.payment.findMany({
    where: { registrationId },
  });

  let capturedMinor = 0;
  let refundedMinor = 0;

  for (const payment of payments) {
    if (payment.status === 'CAPTURED' && payment.kind !== 'REFUND') {
      capturedMinor += payment.amountMinor;
    }
    if (
      payment.kind === 'REFUND' &&
      (payment.status === 'REFUNDED' || payment.status === 'PARTIALLY_REFUNDED')
    ) {
      refundedMinor += payment.amountMinor;
    }
  }

  return {
    capturedMinor,
    refundedMinor,
    netMinor: capturedMinor - refundedMinor,
  };
}

export function isEffectivelyPaid(registration: Registration, paidState: PaidState): boolean {
  if (registration.status === 'AWAITING_VERIFICATION') {
    return paidState.netMinor >= registration.amountDueMinor && registration.amountDueMinor > 0;
  }
  return paidState.netMinor >= registration.amountDueMinor && registration.amountDueMinor > 0;
}

export function deriveRegistrationStatusAfterCapture(
  registration: Registration,
  paidState: PaidState,
): Registration['status'] {
  if (paidState.netMinor < registration.amountDueMinor) {
    if (registration.status === 'ADDITIONAL_PAYMENT_REQUIRED') {
      return 'ADDITIONAL_PAYMENT_REQUIRED';
    }
    return registration.status;
  }

  if (
    registration.audience === 'STUDENT' &&
    registration.status !== 'ADDITIONAL_PAYMENT_REQUIRED'
  ) {
    return 'AWAITING_VERIFICATION';
  }

  return 'PAID';
}

export function deriveRegistrationStatusAfterRefund(
  registration: Registration,
  paidState: PaidState,
): Registration['status'] {
  if (paidState.netMinor >= registration.amountDueMinor && registration.amountDueMinor > 0) {
    if (registration.audience === 'STUDENT' && registration.status === 'AWAITING_VERIFICATION') {
      return 'AWAITING_VERIFICATION';
    }
    return 'PAID';
  }

  if (registration.status === 'ADDITIONAL_PAYMENT_REQUIRED') {
    return 'ADDITIONAL_PAYMENT_REQUIRED';
  }

  if (paidState.netMinor > 0) {
    return 'ADDITIONAL_PAYMENT_REQUIRED';
  }

  return 'REFUNDED';
}

export async function lockRegistrationForUpdate(
  tx: TransactionClient,
  registrationId: string,
): Promise<Registration | null> {
  const rows = await tx.$queryRaw<Registration[]>`
    SELECT * FROM registrations WHERE id = ${registrationId}::uuid FOR UPDATE
  `;
  return rows[0] ?? null;
}

export function findLatestCapturedPayment(payments: Payment[]): Payment | undefined {
  return payments
    .filter((p) => p.status === 'CAPTURED' && p.kind !== 'REFUND')
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
}
