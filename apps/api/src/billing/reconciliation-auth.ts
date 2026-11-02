import { createHmac, timingSafeEqual } from 'node:crypto';

export function verifyReconciliationRequest(
  body: Buffer,
  signature: string,
  timestamp: string,
  secret: string,
): boolean {
  if (
    !/^\d{10}$/.test(timestamp) ||
    !/^[a-f0-9]{64}$/.test(signature) ||
    Math.abs(Date.now() / 1000 - Number(timestamp)) > 300
  )
    return false;
  const expected = createHmac('sha256', secret).update(`${timestamp}.`).update(body).digest();
  return timingSafeEqual(expected, Buffer.from(signature, 'hex'));
}
