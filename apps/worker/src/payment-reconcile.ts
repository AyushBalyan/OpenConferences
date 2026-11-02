import { createHmac } from 'node:crypto';
import { getConfig } from '@openconferences/config/env';
import type { PaymentReconcileJobPayload } from '@openconferences/schemas';

/** Delegate to the API's shared capture/refund state machine; never duplicate its accounting. */
export async function processPaymentReconcileJob(
  payload: PaymentReconcileJobPayload,
): Promise<{ inspected: number; failed: number }> {
  const config = getConfig();
  const timestamp = String(Math.floor(Date.now() / 1000));
  const body = JSON.stringify(payload);
  const signature = createHmac('sha256', config.auth.secret)
    .update(`${timestamp}.${body}`)
    .digest('hex');
  const url = new URL(
    `${config.api.basePath.replace(/\/$/, '')}/internal/billing/reconcile`,
    config.auth.url,
  );
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-reconcile-signature': signature,
      'x-reconcile-timestamp': timestamp,
    },
    body,
    signal: AbortSignal.timeout(120000),
  });
  if (!response.ok) throw new Error(`Payment reconciliation failed: HTTP ${response.status}`);
  const result = (await response.json()) as { inspected: number; failed: number };
  if (result.failed)
    throw new Error(`Payment reconciliation could not recover ${result.failed} operations`);
  return result;
}
