import {
  Body,
  Controller,
  Post,
  Req,
  Res,
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpCode,
  ServiceUnavailableException,
  Inject,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type Redis from 'ioredis';
import { createHash } from 'node:crypto';
import { publicDeclineSchema, publicInvitationSchema } from '@openconferences/schemas';
import { getConfig } from '@openconferences/config/env';
import { REDIS_CLIENT } from '../redis/redis.module';
import { InvitationsService } from './invitations.service';

@Controller('reviewer-invitations/public')
export class InvitationPublicController {
  constructor(
    private readonly invitations: InvitationsService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}
  private async limited<T>(operation: Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        operation,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('unavailable')), 750);
        }),
      ]);
    } catch {
      throw new ServiceUnavailableException(
        'Invitation checks are temporarily unavailable. Please try again.',
      );
    } finally {
      clearTimeout(timer);
    }
  }
  private async protect(req: Request, res: Response, token: string) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    const origin = req.headers.origin;
    if (origin && origin !== new URL(getConfig().webUrl).origin)
      throw new ForbiddenException('Request origin is not allowed');
    // Only digests go into limiter keys. Request bodies and secret-bearing URLs are never logged.
    for (const [kind, value, limit] of [
      ['ip', req.ip ?? 'unknown', 30],
      ['token', token, 10],
    ] as const) {
      const digest = createHash('sha256').update(value).digest('hex');
      const n = await this.limited(
        this.redis.eval(
          "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],60) end; return n",
          1,
          `invitation-public:${kind}:${digest}`,
        ),
      );
      if (Number(n) > limit) {
        res.setHeader('Retry-After', '60');
        throw new HttpException('Too many requests. Please try again shortly.', 429);
      }
    }
  }
  @Post('status')
  @HttpCode(200)
  async status(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const input = publicInvitationSchema.safeParse(body);
    if (!input.success) throw new BadRequestException('Invalid invitation link');
    await this.protect(req, res, input.data.token);
    return this.invitations.publicDecline(input.data.token, false);
  }
  @Post('decline')
  @HttpCode(200)
  async decline(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const input = publicDeclineSchema.safeParse(body);
    if (!input.success) throw new BadRequestException('Invalid decline confirmation');
    await this.protect(req, res, input.data.token);
    return this.invitations.publicDecline(input.data.token, true, input.data.reason);
  }
}
