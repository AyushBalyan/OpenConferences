import { Inject, Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import type { IncomingHttpHeaders } from 'node:http';
import type Redis from 'ioredis';
import { fromNodeHeaders } from 'better-auth/node';
import { getConfig } from '@openconferences/config/env';
import { REDIS_CLIENT } from '../redis/redis.module';
import { AuditService } from '../audit/audit.service';
import { NotificationPublisher } from '../messaging/notification.publisher';
import {
  createAuthInstance,
  type AuthInstance,
  type ReviewerInvitationMagicLinkMetadata,
} from './auth.config';
import type { AuthSession, AuthUser } from './auth.types';
import { needsProfileSetup, userHasCredentialPassword } from './account-profile.util';

export type SignInMagicLinkInput = {
  email: string;
  name?: string;
  callbackURL?: string;
  errorCallbackURL?: string;
  metadata?: ReviewerInvitationMagicLinkMetadata;
};

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

  private internalAuthHeaders(): Headers {
    const config = getConfig();
    const authHost = new URL(config.auth.url).host;

    return fromNodeHeaders({
      host: authHost,
      origin: config.webUrl,
      'user-agent': 'OpenConferences/Internal',
    });
  }

  async signInMagicLink(input: SignInMagicLinkInput): Promise<void> {
    await this.auth.api.signInMagicLink({
      body: input,
      headers: this.internalAuthHeaders(),
    });
  }

  sessionHeaders(headers: IncomingHttpHeaders): Headers {
    return fromNodeHeaders(headers);
  }

  async getAccountProfile(user: AuthUser) {
    const hasPassword = await userHasCredentialPassword(user.id);

    return {
      hasPassword,
      needsProfileSetup: needsProfileSetup({
        name: user.name,
        email: user.email,
        hasPassword,
      }),
    };
  }

  async setupAccount(
    headers: IncomingHttpHeaders,
    input: { name: string; newPassword: string },
  ): Promise<void> {
    const session = await this.getSession(headers);
    if (!session) {
      throw new UnauthorizedException('Authentication required');
    }

    const hasPassword = await userHasCredentialPassword(session.user.id);
    if (hasPassword) {
      throw new ConflictException('Account already has a password');
    }

    const requestHeaders = this.sessionHeaders(headers);

    await this.auth.api.updateUser({
      body: { name: input.name.trim() },
      headers: requestHeaders,
    });

    await this.auth.api.setPassword({
      body: { newPassword: input.newPassword },
      headers: requestHeaders,
    });
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
