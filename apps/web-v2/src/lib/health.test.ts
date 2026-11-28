import { describe, expect, it, vi } from 'vitest';
import { apiBaseUrl } from './api';
import { getApiHealth } from './health';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const timestamp = '2026-01-01T00:00:00.000Z';
const liveness = { status: 'ok', timestamp, version: '0.0.0', revision: null };

function fakeApi(readiness: { status: number; body: unknown }) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith('/healthz')) return json(liveness);
    if (url.endsWith('/readyz')) return json(readiness.body, readiness.status);
    return json({}, 404);
  });
}

describe('getApiHealth', () => {
  it('calls the contract paths under the configured base address', async () => {
    const fetch = fakeApi({
      status: 200,
      body: { status: 'ok', timestamp, checks: [{ name: 'postgres', status: 'ok' }] },
    });

    const health = await getApiHealth({ fetch });

    const called = fetch.mock.calls.map(([input]) => String(input)).sort();
    expect(called).toEqual([`${apiBaseUrl}/healthz`, `${apiBaseUrl}/readyz`]);
    expect(health).toEqual({
      reachable: true,
      liveness,
      readiness: { status: 'ok', timestamp, checks: [{ name: 'postgres', status: 'ok' }] },
    });
  });

  it('reports a failing dependency when the API is up but not ready', async () => {
    const fetch = fakeApi({
      status: 503,
      body: {
        status: 'error',
        timestamp,
        checks: [
          { name: 'postgres', status: 'ok' },
          { name: 'redis', status: 'error', message: 'Connection is closed.' },
        ],
      },
    });

    const health = await getApiHealth({ fetch });

    expect(health.reachable).toBe(true);
    if (health.reachable) {
      expect(health.readiness.status).toBe('error');
      expect(health.readiness.checks[1]).toMatchObject({ name: 'redis', status: 'error' });
    }
  });

  it('reports the API as unreachable when the request fails', async () => {
    const fetch = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });

    const health = await getApiHealth({ fetch });

    expect(health).toEqual({
      reachable: false,
      reason: 'The API could not be reached (fetch failed).',
    });
  });

  it('reports the API as unreachable when the answer breaks the contract', async () => {
    const fetch = fakeApi({ status: 200, body: { status: 'fine' } });

    const health = await getApiHealth({ fetch });

    expect(health).toEqual({
      reachable: false,
      reason: 'The API answered in a shape the contract does not allow.',
    });
  });
});
