import { withTenantContext } from '@openconferences/db';
import type { PaymentReconcileJobPayload } from '@openconferences/schemas';

export async function processPaymentReconcileJob(
  payload: PaymentReconcileJobPayload,
): Promise<{ inspected: number }> {
  const stalePayments = await withTenantContext({ bypass: true }, async (tx) =>
    tx.payment.findMany({
      where: {
        status: 'CREATED',
        ...(payload.paymentId ? { id: payload.paymentId } : {}),
        createdAt: { lt: new Date(Date.now() - 30 * 60 * 1000) },
      },
      take: 100,
    }),
  );

  return { inspected: stalePayments.length };
}
