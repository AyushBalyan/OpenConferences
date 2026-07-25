import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { getConfig } from '@openconferences/config/env';
import { prisma, generateId } from '@openconferences/db';
import { AppModule } from '../../src/app.module.ts';
import {
  lastTestNotification,
  resetLastTestNotification,
} from '../../src/messaging/notification.service.ts';
import { ensureNotificationTemplates } from '../helpers/notifications.ts';

function extractCookies(setCookie: string | string[] | undefined): string {
  if (!setCookie) return '';
  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
  return cookies.map((cookie) => cookie.split(';')[0]).join('; ');
}

function extractOtpFromEmail(html: string): string | null {
  const match = html.match(/>\s*(\d{6})\s*</) ?? html.match(/Code:\s*(\d{6})/);
  return match?.[1] ?? null;
}

describe('MFA enable (email OTP)', () => {
  let app: INestApplication;
  const email = `mfa-smoke-${Date.now()}@example.com`;
  const password = 'TestPassword123!';
  let userId = '';
  let cookie = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [LoggerModule.forRoot({ pinoHttp: { level: 'silent' } }), AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix(getConfig().api.basePath.replace(/^\//, ''));
    await app.init();
    await ensureNotificationTemplates();

    const { hashPassword } = await import('better-auth/crypto');
    userId = generateId();
    await prisma.user.create({
      data: {
        id: userId,
        email,
        name: 'MFA Smoke',
        emailVerified: true,
        accounts: {
          create: {
            id: generateId(),
            accountId: email,
            providerId: 'credential',
            password: await hashPassword(password),
          },
        },
      },
    });

    const signIn = await request(app.getHttpServer())
      .post('/api/v1/auth/sign-in/email')
      .set('Origin', getConfig().api.corsOrigins[0] ?? 'http://localhost:3000')
      .send({ email, password });

    cookie = extractCookies(signIn.headers['set-cookie']);
  }, 60000);

  afterAll(async () => {
    await prisma.twoFactor.deleteMany({ where: { userId } }).catch(() => undefined);
    await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
    await app?.close();
  });

  it('enables MFA via enable → send-otp → verify-otp', async () => {
    const origin = getConfig().api.corsOrigins[0] ?? 'http://localhost:3000';

    const enable = await request(app.getHttpServer())
      .post('/api/v1/auth/two-factor/enable')
      .set('Origin', origin)
      .set('Cookie', cookie)
      .send({ password });

    expect(enable.status).toBe(200);
    expect(enable.body.totpURI).toBeTruthy();
    expect(enable.body.backupCodes?.length).toBeGreaterThan(0);
    cookie = [cookie, extractCookies(enable.headers['set-cookie'])].filter(Boolean).join('; ');

    resetLastTestNotification();
    const sendOtp = await request(app.getHttpServer())
      .post('/api/v1/auth/two-factor/send-otp')
      .set('Origin', origin)
      .set('Cookie', cookie)
      .send({});

    expect(sendOtp.status).toBe(200);
    expect(lastTestNotification?.templateKey).toBe('auth.mfa_otp');
    expect(lastTestNotification?.to).toBe(email);
    const otp = extractOtpFromEmail(lastTestNotification!.html);
    expect(otp).toMatch(/^\d{6}$/);

    const verify = await request(app.getHttpServer())
      .post('/api/v1/auth/two-factor/verify-otp')
      .set('Origin', origin)
      .set('Cookie', cookie)
      .send({ code: otp });

    expect(verify.status).toBe(200);
    cookie = [cookie, extractCookies(verify.headers['set-cookie'])].filter(Boolean).join('; ');

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.twoFactorEnabled).toBe(true);
  });
});
