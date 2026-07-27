import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import request from 'supertest';
import { getConfig } from '@openconferences/config/env';
import { prisma } from '@openconferences/db';
import { AppModule } from '../../src/app.module.ts';
import { APP_FILTER } from '@nestjs/core';
import { ProblemExceptionFilter } from '../../src/common/filters/problem-exception.filter.ts';
import { lastTestNotification } from '../../src/messaging/notification.service.ts';
import { ensureNotificationTemplates } from '../helpers/notifications.ts';

const testEmail = `auth-test-${Date.now()}@example.com`;
const testPassword = 'TestPassword123!';
const testName = 'Auth Test User';

function extractCookies(setCookie: string | string[] | undefined): string {
  if (!setCookie) return '';
  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
  return cookies.map((cookie) => cookie.split(';')[0]).join('; ');
}

function extractOtpFromEmail(html: string): string | null {
  const match = html.match(/>\s*(\d{6})\s*</) ?? html.match(/Code:\s*(\d{6})/);
  return match?.[1] ?? null;
}

function extractResetTokenFromEmail(html: string): string | null {
  const match = html.match(/token=([^"&]+)/);
  return match?.[1] ?? null;
}

describe('Auth integration', () => {
  let app: INestApplication;
  const config = getConfig();
  let sessionCookie = '';
  let verificationOtp: string | null = null;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        LoggerModule.forRoot({
          pinoHttp: { level: 'silent' },
        }),
        AppModule,
      ],
      providers: [
        {
          provide: APP_FILTER,
          useClass: ProblemExceptionFilter,
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix(config.api.basePath.replace(/^\//, ''));
    await app.init();
    await ensureNotificationTemplates();
  }, 60000);

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: testEmail } });
    await app.close();
  });

  it('signs up a new user (enumeration-safe response)', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/sign-up/email')
      .set('Origin', config.api.corsOrigins[0] ?? 'http://localhost:3000')
      .send({
        email: testEmail,
        password: testPassword,
        name: testName,
      })
      .expect(200);

    expect(response.body.user ?? response.body).toBeTruthy();
    expect(lastTestNotification?.to).toBe(testEmail);
    expect(lastTestNotification?.templateKey).toBe('auth.email_verify');
    verificationOtp = extractOtpFromEmail(lastTestNotification!.html);

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'auth.signup' },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit).toBeTruthy();
  });

  it('rejects sign-in before email verification', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/sign-in/email')
      .set('Origin', config.api.corsOrigins[0] ?? 'http://localhost:3000')
      .send({
        email: testEmail,
        password: testPassword,
      })
      .expect(403);
  });

  it('verifies email via OTP from mailer queue', async () => {
    expect(verificationOtp).toMatch(/^\d{6}$/);

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/email-otp/verify-email')
      .set('Origin', config.api.corsOrigins[0] ?? 'http://localhost:3000')
      .send({
        email: testEmail,
        otp: verificationOtp,
      })
      .expect(200);

    expect(response.body.status).toBe(true);

    const user = await prisma.user.findFirst({ where: { email: testEmail } });
    expect(user?.emailVerified).toBe(true);
  });

  it('signs in after verification and returns session cookie', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/sign-in/email')
      .set('Origin', config.api.corsOrigins[0] ?? 'http://localhost:3000')
      .send({
        email: testEmail,
        password: testPassword,
      })
      .expect(200);

    sessionCookie = extractCookies(response.headers['set-cookie']);
    expect(sessionCookie.length).toBeGreaterThan(0);
    expect(response.body.user?.email ?? response.body.email).toBe(testEmail);
  });

  it('GET /auth/me returns authenticated profile', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', sessionCookie)
      .expect(200);

    expect(response.body.email).toBe(testEmail);
    expect(response.body.emailVerified).toBe(true);
  });

  it('returns generic response for forgot-password (enumeration-safe)', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/request-password-reset')
      .set('Origin', config.api.corsOrigins[0] ?? 'http://localhost:3000')
      .send({
        email: 'nonexistent@example.com',
        redirectTo: 'http://localhost:3000/reset-password',
      })
      .expect(200);

    expect(response.body.status ?? response.body).toBeTruthy();
  });

  it('resets password with a valid token and writes audit log', async () => {
    const newPassword = 'ResetPassword456!';

    await request(app.getHttpServer())
      .post('/api/v1/auth/request-password-reset')
      .set('Origin', config.api.corsOrigins[0] ?? 'http://localhost:3000')
      .send({ email: testEmail, redirectTo: 'http://localhost:3000/reset-password' })
      .expect(200);

    const resetToken = extractResetTokenFromEmail(lastTestNotification!.html);
    expect(resetToken).toBeTruthy();

    await request(app.getHttpServer())
      .post('/api/v1/auth/reset-password')
      .set('Origin', config.api.corsOrigins[0] ?? 'http://localhost:3000')
      .send({ token: resetToken, newPassword })
      .expect(200);

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'auth.password_reset' },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit).toBeTruthy();

    const signInResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/sign-in/email')
      .set('Origin', config.api.corsOrigins[0] ?? 'http://localhost:3000')
      .send({ email: testEmail, password: newPassword })
      .expect(200);

    sessionCookie = extractCookies(signInResponse.headers['set-cookie']);
    expect(sessionCookie.length).toBeGreaterThan(0);
  });

  it('rejects expired password reset token', async () => {
    const resetEmail = `reset-expired-${Date.now()}@example.com`;

    await request(app.getHttpServer())
      .post('/api/v1/auth/sign-up/email')
      .set('Origin', config.api.corsOrigins[0] ?? 'http://localhost:3000')
      .send({
        email: resetEmail,
        password: testPassword,
        name: 'Reset Expired User',
      })
      .expect(200);

    await prisma.user.updateMany({
      where: { email: resetEmail },
      data: { emailVerified: true },
    });

    await request(app.getHttpServer())
      .post('/api/v1/auth/request-password-reset')
      .set('Origin', config.api.corsOrigins[0] ?? 'http://localhost:3000')
      .send({ email: resetEmail, redirectTo: 'http://localhost:3000/reset-password' })
      .expect(200);

    const resetToken = extractResetTokenFromEmail(lastTestNotification!.html);
    expect(resetToken).toBeTruthy();

    await prisma.verification.updateMany({
      where: { identifier: `reset-password:${resetToken}` },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });

    await request(app.getHttpServer())
      .post('/api/v1/auth/reset-password')
      .set('Origin', config.api.corsOrigins[0] ?? 'http://localhost:3000')
      .send({ token: resetToken, newPassword: 'AnotherPassword789!' })
      .expect(400);

    await prisma.user.deleteMany({ where: { email: resetEmail } });
  });

  it('locks out account after repeated failed sign-in attempts', async () => {
    const lockoutEmail = `lockout-${Date.now()}@example.com`;
    await request(app.getHttpServer())
      .post('/api/v1/auth/sign-up/email')
      .set('Origin', config.api.corsOrigins[0] ?? 'http://localhost:3000')
      .send({
        email: lockoutEmail,
        password: testPassword,
        name: 'Lockout User',
      })
      .expect(200);

    await prisma.user.updateMany({
      where: { email: lockoutEmail },
      data: { emailVerified: true },
    });

    const maxAttempts = config.auth.lockoutMaxAttempts;
    for (let i = 0; i < maxAttempts; i++) {
      await request(app.getHttpServer())
        .post('/api/v1/auth/sign-in/email')
        .set('Origin', config.api.corsOrigins[0] ?? 'http://localhost:3000')
        .send({ email: lockoutEmail, password: 'WrongPassword123!' });
    }

    await request(app.getHttpServer())
      .post('/api/v1/auth/sign-in/email')
      .set('Origin', config.api.corsOrigins[0] ?? 'http://localhost:3000')
      .send({ email: lockoutEmail, password: 'WrongPassword123!' })
      .expect(429);

    await prisma.user.deleteMany({ where: { email: lockoutEmail } });
  });

  it('rejects auth requests without trusted Origin (CSRF protection)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/sign-up/email')
      .set('Origin', 'https://evil.example.com')
      .send({
        email: `csrf-${Date.now()}@example.com`,
        password: testPassword,
        name: 'CSRF Test',
      })
      .expect(403);
  });

  it('rejects public magic link sign-in requests', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/sign-in/magic-link')
      .set('Origin', config.api.corsOrigins[0] ?? 'http://localhost:3000')
      .send({ email: testEmail })
      .expect(403);
  });

  it('signs out and revokes session', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/sign-out')
      .set('Origin', config.api.corsOrigins[0] ?? 'http://localhost:3000')
      .set('Cookie', sessionCookie)
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', sessionCookie)
      .expect(401);
  });
});
