import { afterEach, describe, expect, it, vi } from 'vitest';
import type Redis from 'ioredis';
import { HealthController } from './health.controller';

vi.mock('@openconferences/db', () => ({ prisma: { $queryRaw: vi.fn() } }));

describe('API release identity', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('reports the image commit so deployment checks cannot accept the old API', async () => {
    const revision = 'a'.repeat(40);
    vi.stubEnv('RELEASE_SHA', revision);
    const controller = new HealthController({} as Redis);
    const response = await controller.healthz()({ headers: {} });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'ok', revision });
  });

  it.each([undefined, '', 'main', 'not-a-commit'])(
    'does not invent a revision for %s',
    async (value) => {
      vi.stubEnv('RELEASE_SHA', value);
      const controller = new HealthController({} as Redis);
      const response = await controller.healthz()({ headers: {} });
      expect(response.body.revision).toBeNull();
    },
  );
});
