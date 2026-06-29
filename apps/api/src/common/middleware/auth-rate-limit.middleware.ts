import { Injectable, NestMiddleware, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { Inject } from '@nestjs/common';
import type Redis from 'ioredis';
import { getConfig } from '@openconferences/config/env';
import { REDIS_CLIENT } from '../../redis/redis.module';

@Injectable()
export class AuthRateLimitMiddleware implements NestMiddleware {
  private readonly logger = new Logger(AuthRateLimitMiddleware.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    const config = getConfig();

    if (config.isTest) {
      next();
      return;
    }

    const authPrefix = config.auth.basePath;

    if (!req.path.startsWith(authPrefix)) {
      next();
      return;
    }

    const ip = this.resolveClientIp(req);
    const key = `ratelimit:auth:${ip}:${req.method}:${req.path}`;
    const windowSeconds = 60;
    const maxRequests = 30;

    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, windowSeconds);
    }

    if (count > maxRequests) {
      const retryAfter = await this.redis.ttl(key);
      res.setHeader('Retry-After', String(retryAfter > 0 ? retryAfter : windowSeconds));
      this.logger.warn({ ip, path: req.path, count }, 'Auth rate limit exceeded');
      throw new HttpException(
        {
          type: 'https://errors.openconf.dev/too-many-requests',
          title: 'Too Many Requests',
          status: HttpStatus.TOO_MANY_REQUESTS,
          detail: 'Too many requests. Please try again later.',
          instance: req.url,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    next();
  }

  private resolveClientIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0) {
      return forwarded.split(',')[0]?.trim() ?? req.ip ?? 'unknown';
    }
    return req.ip ?? 'unknown';
  }
}
