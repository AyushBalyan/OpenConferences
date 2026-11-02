import { createHmac } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RazorpayProvider } from './razorpay.provider';

vi.mock('@openconferences/config/env', () => ({
  getConfig: () => ({
    razorpay: { keyId: 'test-key', keySecret: 'test-secret', webhookSecret: 'hook-secret' },
    billing: { webhookReplayWindowSeconds: 300 },
  }),
}));
afterEach(() => vi.unstubAllGlobals());

describe('Razorpay protocol', () => {
  const provider = new RazorpayProvider();
  const signature = createHmac('sha256', 'test-secret').update('order_123|pay_123').digest('hex');
  it('verifies the saved order ID and payment ID with HMAC-SHA256', () => {
    expect(provider.verifyCheckoutSignature('order_123', 'pay_123', signature)).toBe(true);
    expect(provider.verifyCheckoutSignature('order_other', 'pay_123', signature)).toBe(false);
    expect(provider.verifyCheckoutSignature('order_123', 'pay_other', signature)).toBe(false);
    expect(provider.verifyCheckoutSignature('order_123', 'pay_123', 'invalid')).toBe(false);
    expect(provider.verifyCheckoutSignature('order_123', 'pay_123', '0'.repeat(64))).toBe(false);
  });
  it('rejects undersized or fractional order amounts before calling Razorpay', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    for (const amountMinor of [0, 99, 100.5, NaN]) {
      await expect(
        provider.createOrder({ amountMinor, currency: 'INR', receipt: 'test' }),
      ).rejects.toThrow('at least 100');
    }
    expect(fetch).not.toHaveBeenCalled();
  });
  it('creates an order using server authentication and the requested currency subunit', async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'order_123', amount: 12500, currency: 'USD' }),
    });
    vi.stubGlobal('fetch', fetch);
    expect(
      await provider.createOrder({ amountMinor: 12500, currency: 'USD', receipt: 'r123' }),
    ).toMatchObject({ orderId: 'order_123', amountMinor: 12500, currency: 'USD' });
    const options = fetch.mock.calls[0]![1];
    expect(JSON.parse(options.body)).toMatchObject({
      amount: 12500,
      currency: 'USD',
      receipt: 'r123',
    });
    expect(options.headers.Authorization).toBe(
      `Basic ${Buffer.from('test-key:test-secret').toString('base64')}`,
    );
  });
  it('rejects a provider response whose amount does not match', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'order_123', amount: 1, currency: 'USD' }),
      }),
    );
    await expect(
      provider.createOrder({ amountMinor: 12500, currency: 'USD', receipt: 'r123' }),
    ).rejects.toThrow('unexpected order');
  });
  it('does not expose upstream authentication errors to clients', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }));
    await expect(
      provider.createOrder({ amountMinor: 12500, currency: 'USD', receipt: 'r123' }),
    ).rejects.toThrow('Unable to start payment');
  });
  it('requires a separately signed raw webhook and ignores uncaptured events', () => {
    const body = Buffer.from('{"event":"payment.captured"}');
    const signed = createHmac('sha256', 'hook-secret').update(body).digest('hex');
    expect(provider.verifyWebhookSignature(body, signed)).toBe(true);
    expect(provider.verifyWebhookSignature(Buffer.from('{}'), signed)).toBe(false);
    expect(provider.verifyWebhookSignature(body, signature)).toBe(false);
    expect(provider.parseWebhook({ event: 'payment.authorized' })).toBeNull();
    expect(
      provider.parseWebhook({
        event: 'payment.captured',
        payload: {
          payment: { entity: { id: 'pay_123', order_id: 'order_123', status: 'authorized' } },
        },
      }),
    ).toBeNull();
  });
  it.each([
    '',
    'a',
    'a'.repeat(63),
    'a'.repeat(65),
    'g'.repeat(64),
    '../'.repeat(22),
    ' '.repeat(64),
    '零'.repeat(64),
  ])('rejects malformed signature %j without throwing', (signature) => {
    expect(provider.verifyCheckoutSignature('order_123', 'pay_123', signature)).toBe(false);
    expect(provider.verifyWebhookSignature(Buffer.from('{}'), signature)).toBe(false);
  });
  it.each([
    '../orders',
    'pay_../secrets',
    'https://example.test',
    'pay_123?x=1',
    'pay_123/other',
    '',
  ])('rejects unsafe payment ID %j before network access', async (paymentId) => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await expect(provider.fetchPayment(paymentId)).rejects.toThrow('Invalid payment ID');
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each([-1, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1])(
    'rejects non-payable amount %j before network access',
    async (amountMinor) => {
      const fetch = vi.fn();
      vi.stubGlobal('fetch', fetch);
      await expect(
        provider.createOrder({ amountMinor, currency: 'INR', receipt: 'audit' }),
      ).rejects.toThrow();
      expect(fetch).not.toHaveBeenCalled();
    },
  );
  it('sends durable refund idempotency keys with identical retry bodies and a timeout', async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'rfnd_123',
        payment_id: 'pay_123',
        amount: 100,
        status: 'pending',
      }),
    });
    vi.stubGlobal('fetch', fetch);
    const input = {
      paymentId: 'pay_123',
      amountMinor: 100,
      idempotencyKey: 'refund-request-123',
      notes: { refundIntentId: 'intent' },
    };
    await provider.refund(input);
    await provider.refund(input);
    expect(fetch.mock.calls[0][1].headers['X-Refund-Idempotency']).toBe(input.idempotencyKey);
    expect(fetch.mock.calls[0][1].body).toBe(fetch.mock.calls[1][1].body);
    expect(fetch.mock.calls[0][1].signal).toBeDefined();
  });
  it('rejects refund responses for another payment or amount', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'rfnd_123',
          payment_id: 'pay_other',
          amount: 100,
          status: 'processed',
        }),
      }),
    );
    await expect(
      provider.refund({
        paymentId: 'pay_123',
        amountMinor: 100,
        idempotencyKey: 'refund-request-123',
      }),
    ).rejects.toThrow('Unexpected refund');
  });
});
