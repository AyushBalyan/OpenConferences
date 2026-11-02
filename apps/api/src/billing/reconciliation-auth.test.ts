import { createHmac } from 'node:crypto';
import { it, expect } from 'vitest';
import { verifyReconciliationRequest } from './reconciliation-auth';
it('binds reconciliation authorization to raw body, timestamp and secret', () => {
  const body = Buffer.from('{}'),
    timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac('sha256', 'secret')
    .update(`${timestamp}.`)
    .update(body)
    .digest('hex');
  expect(verifyReconciliationRequest(body, signature, timestamp, 'secret')).toBe(true);
  expect(
    verifyReconciliationRequest(
      Buffer.from('{"paymentId":"other"}'),
      signature,
      timestamp,
      'secret',
    ),
  ).toBe(false);
  expect(verifyReconciliationRequest(body, signature, timestamp, 'wrong')).toBe(false);
  expect(
    verifyReconciliationRequest(body, signature, String(Number(timestamp) - 600), 'secret'),
  ).toBe(false);
});
