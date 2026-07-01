import { Inject, Injectable } from '@nestjs/common';
import type { IncomingHttpHeaders } from 'node:http';
import type Redis from 'ioredis';
import { fromNodeHeaders } from 'better-auth/node';
import { REDIS_CLIENT } from '../redis/redis.module';
import { AuditService } from '../audit/audit.service';
import { NotificationPublisher } from '../messaging/notification.publisher';
import { createAuthInstance, type AuthInstance } from './auth.config';
import type { AuthSession, AuthUser } from './auth.types';

@Injectable()
export class AuthService {
  readonly auth: AuthInstance;

  constructor(
    @Inject(REDIS_CLIENT) redis: Redis,
    notifications: NotificationPublisher,
    audit: AuditService,
  ) {
    this.auth = createAuthInstance({ redis, notifications, audit });
  }

  async getSession(headers: IncomingHttpHeaders): Promise<AuthSession | null> {
    const session = await this.auth.api.getSession({
      headers: fromNodeHeaders(headers),
    });

    if (!session) {
      return null;
    }

    return {
      user: this.toAuthUser(session.user),
      session: {
        id: session.session.id,
        token: session.session.token,
        expiresAt: session.session.expiresAt,
      },
    };
  }

  toAuthUser(user: {
    id: string;
    email: string;
    name: string;
    emailVerified: boolean;
    image?: string | null;
    twoFactorEnabled?: boolean | null;
    createdAt: Date;
  }): AuthUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerified: user.emailVerified,
      image: user.image ?? null,
      twoFactorEnabled: user.twoFactorEnabled ?? null,
      createdAt: user.createdAt,
    };
  }
}
