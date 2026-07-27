import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { magicLink, twoFactor, emailOTP } from 'better-auth/plugins';
import type Redis from 'ioredis';
import { getConfig } from '@openconferences/config/env';
import { prisma, generateId } from '@openconferences/db';
import type { AuditService } from '../audit/audit.service';
import { NotificationPublisher } from '../messaging/notification.publisher';
import { formatEmailDate } from '../messaging/format-email-date';
import type {
  AuthEmailVerifyPayload,
  AuthMfaOtpPayload,
  AuthPasswordResetPayload,
} from '../messaging/domain-events';

export type ReviewerInvitationMagicLinkMetadata = {
  reviewerInvitationId: string;
  invitationToken: string;
  conferenceId: string;
  organizationId: string;
  conferenceName: string;
  expiresAt: string;
};

export type AuthDependencies = {
  redis: Redis;
  notifications: NotificationPublisher;
  audit: AuditService;
};

function isReviewerInvitationMetadata(
  metadata: Record<string, unknown> | undefined,
): metadata is ReviewerInvitationMagicLinkMetadata {
  return (
    metadata != null &&
    typeof metadata.reviewerInvitationId === 'string' &&
    typeof metadata.invitationToken === 'string' &&
    typeof metadata.conferenceId === 'string' &&
    typeof metadata.organizationId === 'string' &&
    typeof metadata.conferenceName === 'string' &&
    typeof metadata.expiresAt === 'string'
  );
}

function buildWebAuthPageUrl(
  webUrl: string,
  path: string,
  token: string,
  extraParams?: Record<string, string>,
): string {
  const pageUrl = new URL(path, webUrl);
  pageUrl.searchParams.set('token', token);
  for (const [key, value] of Object.entries(extraParams ?? {})) {
    pageUrl.searchParams.set(key, value);
  }
  return pageUrl.toString();
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

export type AuthInstance = {
  api: ReturnType<typeof betterAuth>['api'] & {
    signInMagicLink: (options: {
      body: {
        email: string;
        name?: string;
        callbackURL?: string;
        errorCallbackURL?: string;
        metadata?: ReviewerInvitationMagicLinkMetadata;
      };
      headers: Headers;
    }) => Promise<{ status: boolean }>;
    updateUser: (options: {
      body: { name?: string; image?: string | null };
      headers: Headers;
    }) => Promise<{ status: boolean }>;
    setPassword: (options: {
      body: { newPassword: string };
      headers: Headers;
    }) => Promise<{ status: boolean }>;
  };
  handler: ReturnType<typeof betterAuth>['handler'];
  options: ReturnType<typeof betterAuth>['options'];
};

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
        '/email-otp/send-verification-otp': {
          window: 60,
          max: 3,
        },
        '/two-factor/send-otp': {
          window: 60,
          max: 3,
        },
        '/magic-link/verify': {
          window: 60,
          max: 10,
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
      // Link sender replaced by emailOTP when overrideDefaultEmailVerification is true.
      sendOnSignUp: true,
      autoSignInAfterVerification: false,
    },
    verification: {
      storeInDatabase: true,
    },
    plugins: [
      emailOTP({
        otpLength: 6,
        expiresIn: 600,
        storeOTP: 'hashed',
        overrideDefaultEmailVerification: true,
        // Signup OTP is sent via overridden emailVerification.sendVerificationEmail.
        sendVerificationOnSignUp: false,
        sendVerificationOTP: async ({ email, otp, type }) => {
          if (type !== 'email-verification') {
            return;
          }
          const payload: AuthEmailVerifyPayload = {
            to: email,
            otp,
            expiresMinutes: 10,
            idempotencyKey: `verify-otp:${email}:${Date.now()}`,
          };
          await deps.notifications.publishAuthEmailVerify(payload);
        },
      }),
      magicLink({
        expiresIn: 86400,
        storeToken: 'hashed',
        sendMagicLink: async ({ email, token, metadata }) => {
          if (!isReviewerInvitationMetadata(metadata)) {
            return;
          }

          const signupUrl = buildWebAuthPageUrl(config.webUrl, '/join/reviewer', token, {
            invitationToken: metadata.invitationToken,
          });

          await deps.notifications.publishReviewerInvitation({
            to: email,
            conferenceId: metadata.conferenceId,
            organizationId: metadata.organizationId,
            conferenceName: metadata.conferenceName,
            signupUrl,
            expiresAt: formatEmailDate(new Date(metadata.expiresAt)),
            invitationId: metadata.reviewerInvitationId,
            idempotencyKey: `reviewer-invite-magic-${metadata.reviewerInvitationId}:${Date.now()}`,
          });

          await deps.audit.log({
            action: 'auth.magic_link_sent',
            entity: 'ReviewerInvitation',
            entityId: metadata.reviewerInvitationId,
            diff: { email },
          });
        },
      }),
      twoFactor({
        issuer: 'OpenConferences',
        otpOptions: {
          period: 10,
          digits: 6,
          storeOTP: 'hashed',
          sendOTP: async ({ user, otp }) => {
            const payload: AuthMfaOtpPayload = {
              to: user.email,
              otp,
              expiresMinutes: 10,
              idempotencyKey: `mfa-otp:${user.id}:${Date.now()}`,
            };
            await deps.notifications.publishAuthMfaOtp(payload);
          },
        },
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
