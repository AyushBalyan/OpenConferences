import { Controller, Inject } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { healthContract } from '@openconferences/contracts';
import type Redis from 'ioredis';
import { prisma } from '@openconferences/db';
import { REDIS_CLIENT } from '../redis/redis.module';

const VERSION = '0.0.0';

@Controller()
export class HealthController {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  @TsRestHandler(healthContract.healthz)
  healthz() {
    return tsRestHandler(healthContract.healthz, async () => {
      return {
        status: 200 as const,
        body: {
          status: 'ok' as const,
          timestamp: new Date().toISOString(),
          version: VERSION,
        },
      };
    });
  }

  @TsRestHandler(healthContract.readyz)
  readyz() {
    return tsRestHandler(healthContract.readyz, async () => {
      const checks: Array<{ name: string; status: 'ok' | 'degraded' | 'error'; message?: string }> =
        [];

      // Postgres check
      try {
        await prisma.$queryRaw`SELECT 1`;
        checks.push({ name: 'postgres', status: 'ok' });
      } catch (err) {
        checks.push({
          name: 'postgres',
          status: 'error',
          message: err instanceof Error ? err.message : 'Unknown error',
        });
      }

      // Redis check
      try {
        if (this.redis.status !== 'ready') {
          await this.redis.connect();
        }
        const pong = await this.redis.ping();
        checks.push({
          name: 'redis',
          status: pong === 'PONG' ? 'ok' : 'error',
          message: pong !== 'PONG' ? `Unexpected response: ${pong}` : undefined,
        });
      } catch (err) {
        checks.push({
          name: 'redis',
          status: 'error',
          message: err instanceof Error ? err.message : 'Unknown error',
        });
      }

      const allOk = checks.every((c) => c.status === 'ok');
      const body = {
        status: allOk ? ('ok' as const) : ('error' as const),
        timestamp: new Date().toISOString(),
        checks,
      };

      return {
        status: allOk ? (200 as const) : (503 as const),
        body,
      };
    });
  }
}
