import { Injectable, Inject, HttpException, ServiceUnavailableException } from '@nestjs/common';
import type Redis from 'ioredis';
import { createHash, randomUUID } from 'node:crypto';
import { REDIS_CLIENT } from '../redis/redis.module';
import type { IntegrationPrincipal } from './integration.security';
const RATE = `local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],60) end; return n`;
const LEASE = `local now=tonumber(ARGV[1]); for i=1,2 do redis.call('ZREMRANGEBYSCORE',KEYS[i],'-inf',now) end; if redis.call('ZCARD',KEYS[1])>=2 or redis.call('ZCARD',KEYS[2])>=10 then return 0 end; for i=1,2 do redis.call('ZADD',KEYS[i],now+60000,ARGV[2]); redis.call('PEXPIRE',KEYS[i],61000) end; return 1`;
@Injectable()
export class IntegrationLimiter {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}
  private async command<T>(run: Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        run,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('limiter unavailable')), 750);
        }),
      ]);
    } catch {
      throw new ServiceUnavailableException('Bot access controls are temporarily unavailable');
    } finally {
      clearTimeout(timer);
    }
  }
  async preauth(ip: string) {
    const n = await this.command(
      this.redis.eval(RATE, 1, `bot:auth:${createHash('sha256').update(ip).digest('hex')}`),
    );
    if (Number(n) > 60) throw new HttpException('Too many requests', 429);
  }
  async acquire(p: IntegrationPrincipal) {
    const prefix = `bot:{${p.conferenceId}}`;
    const n = await this.command(this.redis.eval(RATE, 1, `${prefix}:rate:${p.keyId}`));
    const c = await this.command(this.redis.eval(RATE, 1, `${prefix}:rate`));
    if (Number(n) > 60 || Number(c) > 300) throw new HttpException('Too many requests', 429);
    const token = randomUUID(),
      keys = [`${prefix}:active:${p.keyId}`, `${prefix}:active`];
    if (Number(await this.command(this.redis.eval(LEASE, 2, ...keys, Date.now(), token))) !== 1)
      throw new HttpException('Too many concurrent requests', 429);
    return async () => {
      try {
        await this.command(
          this.redis.eval(
            "for i=1,2 do redis.call('ZREM',KEYS[i],ARGV[1]) end; return 1",
            2,
            ...keys,
            token,
          ),
        );
      } catch {
        /* Leases expire; never replace the original response with a cleanup error. */
      }
    };
  }
}
