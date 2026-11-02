import { createHmac, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export function loadTestGateway(root) {
  if (process.env.DEMO_RAZORPAY_TEST !== 'true') return null;
  const file = readFileSync(resolve(root, '.env'), 'utf8');
  const value = (name) => {
    const raw = file.match(new RegExp(`^${name}=(.*)$`, 'm'))?.[1]?.trim();
    return process.env[name] ?? raw?.replace(/^(['"])(.*)\1$/, '$2');
  };
  return createTestGateway(value('RAZORPAY_KEY_ID'), value('RAZORPAY_KEY_SECRET'));
}

// Deliberately refuses live keys: this API has fictional users and no real authentication.
export function createTestGateway(keyId, keySecret, fetchImpl = fetch) {
  if (!keyId?.startsWith('rzp_test_') || !keySecret) {
    throw new Error('The dummy API requires Razorpay TEST credentials. Live keys are forbidden.');
  }
  async function request(path, body) {
    const response = await fetchImpl(`https://api.razorpay.com/v1/${path}`, {
      method: body ? 'POST' : 'GET',
      headers: {
        Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      const error = new Error(`Razorpay test API returned HTTP ${response.status}.`);
      error.status = 502;
      throw error;
    }
    return response.json();
  }
  return {
    keyId,
    async createOrder(amount, currency) {
      if (!Number.isSafeInteger(amount) || amount < 100) {
        throw Object.assign(new Error('Invalid test payment amount.'), { status: 400 });
      }
      return request('orders', {
        amount,
        currency,
        receipt: `demo_${Date.now()}`,
        notes: { purpose: 'Local fictional conference demo' },
      });
    },
    async verify(payment, input) {
      const { razorpay_payment_id: paymentId, razorpay_order_id: orderId, razorpay_signature: signature } = input;
      const expected = createHmac('sha256', keySecret)
        .update(`${payment.providerOrderId}|${paymentId}`)
        .digest();
      if (
        !/^pay_[a-zA-Z0-9]+$/.test(paymentId ?? '') ||
        orderId !== payment.providerOrderId ||
        !/^[a-fA-F0-9]{64}$/.test(signature ?? '') ||
        !timingSafeEqual(expected, Buffer.from(signature, 'hex'))
      ) {
        throw Object.assign(new Error('Invalid Razorpay test payment signature.'), { status: 400 });
      }
      const remote = await request(`payments/${paymentId}`);
      if (
        remote.id !== paymentId || remote.order_id !== payment.providerOrderId ||
        remote.amount !== payment.amountMinor || remote.currency !== payment.currency
      ) {
        throw Object.assign(new Error('Test payment does not match this registration order.'), { status: 400 });
      }
      return { paymentId, captured: remote.status === 'captured' && remote.captured === true };
    },
  };
}
