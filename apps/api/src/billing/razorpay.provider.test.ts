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
});
