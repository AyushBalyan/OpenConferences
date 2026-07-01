import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { twoFactor } from 'better-auth/plugins';
import type Redis from 'ioredis';
import { getConfig } from '@openconferences/config/env';
import { prisma, generateId } from '@openconferences/db';
import type { AuditService } from '../audit/audit.service';
import { NotificationPublisher } from '../messaging/notification.publisher';
import type { AuthEmailVerifyPayload, AuthPasswordResetPayload } from '../messaging/domain-events';

export type AuthDependencies = {
  redis: Redis;
  notifications: NotificationPublisher;
  audit: AuditService;
};

function buildWebAuthPageUrl(webUrl: string, path: string, token: string): string {
  const pageUrl = new URL(path, webUrl);
  pageUrl.searchParams.set('token', token);
  return pageUrl.toString();
}

function extractVerificationTokenFromAuthUrl(url: string): string {
  const token = new URL(url).searchParams.get('token');
  if (!token) {
    throw new Error('Verification email URL is missing token');
  }
  return token;
}

function extractResetTokenFromAuthUrl(url: string): string {
  const parsed = new URL(url);
  const queryToken = parsed.searchParams.get('token');
  if (queryToken) return queryToken;

  const segments = parsed.pathname.split('/').filter(Boolean);
  const pathToken = segments[segments.length - 1];
  if (pathToken && pathToken !== 'reset-password') {
    return pathToken;
  }

  throw new Error('Reset email URL is missing token');
}

export function createAuthInstance(deps: AuthDependencies): AuthInstance {
  const config = getConfig();

  return betterAuth({
    appName: 'OpenConferences',
    secret: config.auth.secret,
    baseURL: config.auth.url,
    basePath: config.auth.basePath,
    trustedOrigins: config.api.corsOrigins,
    database: prismaAdapter(prisma, {
      provider: 'postgresql',
    }),
    secondaryStorage: {
      get: async (key) => {
        const value = await deps.redis.get(key);
        return value ?? null;
      },
      set: async (key, value, ttl) => {
        if (ttl) {
          await deps.redis.set(key, value, 'EX', ttl);
        } else {
          await deps.redis.set(key, value);
        }
      },
      delete: async (key) => {
        await deps.redis.del(key);
      },
    },
    rateLimit: {
      enabled: !config.isTest,
      storage: 'secondary-storage',
      customRules: {
        '/sign-in/email': {
          window: 60,
          max: config.auth.lockoutMaxAttempts,
        },
        '/sign-up/email': {
          window: 60,
          max: 3,
        },
        '/forget-password': {
          window: 60,
          max: 3,
        },
        '/send-verification-email': {
          window: 60,
          max: 3,
        },
      },
    },
    advanced: {
      // Better Auth skips origin/CSRF checks in NODE_ENV=test unless explicitly disabled.
      disableOriginCheck: false,
      disableCSRFCheck: false,
      useSecureCookies: config.isProd,
      cookiePrefix: 'oc',
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: 'lax',
        secure: config.isProd,
      },
      database: {
        generateId: () => generateId(),
      },
    },
    emailAndPassword: {
      enabled: true,
      autoSignIn: false,
      requireEmailVerification: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        const resetUrl = buildWebAuthPageUrl(
          config.webUrl,
          '/reset-password',
          extractResetTokenFromAuthUrl(url),
        );
        const payload: AuthPasswordResetPayload = {
          to: user.email,
          resetUrl,
          idempotencyKey: `reset:${user.id}:${Date.now()}`,
        };
        await deps.notifications.publishAuthPasswordReset(payload);
      },
      onPasswordReset: async ({ user }) => {
        await deps.audit.log({
          actorUserId: user.id,
          action: 'auth.password_reset',
          entity: 'user',
          entityId: user.id,
        });
      },
    },
    emailVerification: {
      sendVerificationEmail: async ({ user, url, token }) => {
        const verifyUrl = buildWebAuthPageUrl(
          config.webUrl,
          '/verify-email',
          token ?? extractVerificationTokenFromAuthUrl(url),
        );
        const payload: AuthEmailVerifyPayload = {
          to: user.email,
          verifyUrl,
          idempotencyKey: `verify:${user.id}:${Date.now()}`,
        };
        await deps.notifications.publishAuthEmailVerify(payload);
      },
      sendOnSignUp: true,
      autoSignInAfterVerification: false,
    },
    verification: {
      storeInDatabase: true,
    },
    plugins: [
      twoFactor({
        issuer: 'OpenConferences',
      }),
    ],
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            await deps.audit.log({
              actorUserId: user.id,
              action: 'auth.signup',
              entity: 'user',
              entityId: user.id,
              diff: { email: user.email },
            });
          },
        },
      },
      session: {
        create: {
          after: async (session) => {
            await deps.audit.log({
              actorUserId: session.userId,
              action: 'auth.login',
              entity: 'session',
              entityId: session.id,
            });
          },
        },
        delete: {
          after: async (session) => {
            await deps.audit.log({
              actorUserId: session.userId,
              action: 'auth.logout',
              entity: 'session',
              entityId: session.id,
            });
          },
        },
      },
    },
  }) as unknown as AuthInstance;
}

export type AuthInstance = ReturnType<typeof betterAuth>;
