import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import type Redis from 'ioredis';
import { getConfig } from '@openconferences/config/env';
import { REDIS_CLIENT } from '../redis/redis.module';

@Injectable()
export class LockoutService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  private key(email: string): string {
    return `auth:lockout:${email.toLowerCase()}`;
  }

  async isLocked(email: string): Promise<boolean> {
    const config = getConfig();
    const attempts = await this.redis.get(this.key(email));
    if (!attempts) return false;
    return Number.parseInt(attempts, 10) >= config.auth.lockoutMaxAttempts;
  }

  async recordFailure(email: string): Promise<void> {
    const config = getConfig();
    const key = this.key(email);
    const attempts = await this.redis.incr(key);
    if (attempts === 1) {
      await this.redis.expire(key, config.auth.lockoutWindowSeconds);
    }
  }

  async reset(email: string): Promise<void> {
    await this.redis.del(this.key(email));
  }

  async remainingSeconds(email: string): Promise<number> {
    return this.redis.ttl(this.key(email));
  }
}
