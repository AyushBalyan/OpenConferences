import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { twoFactor } from 'better-auth/plugins';
import type Redis from 'ioredis';
import { getConfig } from '@openconferences/config/env';
import { prisma, generateId } from '@openconferences/db';
import type { AuditService } from '../audit/audit.service';
import type { MailerService } from '../mailer/mailer.service';

export type AuthDependencies = {
  redis: Redis;
  mailer: MailerService;
  audit: AuditService;
};

function buildVerificationEmailHtml(url: string): string {
  return `<p>Please verify your email address by clicking the link below:</p><p><a href="${url}">Verify email</a></p>`;
}

function buildResetEmailHtml(url: string): string {
  return `<p>Reset your password by clicking the link below:</p><p><a href="${url}">Reset password</a></p><p>If you did not request this, you can ignore this email.</p>`;
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
        await deps.mailer.send({
          to: user.email,
          subject: 'Reset your OpenConferences password',
          html: buildResetEmailHtml(url),
          idempotencyKey: `reset:${user.id}:${Date.now()}`,
        });
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
      sendVerificationEmail: async ({ user, url }) => {
        await deps.mailer.send({
          to: user.email,
          subject: 'Verify your OpenConferences email',
          html: buildVerificationEmailHtml(url),
          idempotencyKey: `verify:${user.id}:${Date.now()}`,
        });
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
        twoFactorTable: 'two_factors',
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
