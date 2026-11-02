import { createHmac } from 'node:crypto';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { processPaymentReconcileJob } from './payment-reconcile.js';
vi.mock('@openconferences/config/env', () => ({
  getConfig: () => ({
    auth: { secret: 'worker-secret', url: 'http://api:3001' },
    api: { basePath: '/api/v1' },
  }),
}));
afterEach(() => vi.unstubAllGlobals());
describe('payment reconciliation worker', () => {
  it('authenticates the request body and timestamp and delegates recovery to the API', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ inspected: 2, failed: 0 }) });
    vi.stubGlobal('fetch', fetch);
    expect(await processPaymentReconcileJob({})).toEqual({ inspected: 2, failed: 0 });
    const [url, request] = fetch.mock.calls[0]!;
    expect(String(url)).toBe('http://api:3001/api/v1/internal/billing/reconcile');
    expect(request.headers['x-reconcile-signature']).toBe(
      createHmac('sha256', 'worker-secret')
        .update(`${request.headers['x-reconcile-timestamp']}.${request.body}`)
        .digest('hex'),
    );
  });
  it('retries when the API reports a partial failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ inspected: 2, failed: 1 }) }),
    );
    await expect(processPaymentReconcileJob({})).rejects.toThrow('could not recover');
  });
});
