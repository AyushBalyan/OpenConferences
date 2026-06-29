import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { getConfig } from '@openconferences/config/env';
import { prisma, generateId } from '@openconferences/db';
import { AppModule } from '../../src/app.module.ts';

describe('MFA enable', () => {
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

    const setCookie = signIn.headers['set-cookie'];
    cookie = (Array.isArray(setCookie) ? setCookie : [setCookie])
      .map((entry) => entry?.split(';')[0])
      .filter(Boolean)
      .join('; ');
  }, 60000);

  afterAll(async () => {
    await prisma.twoFactor.deleteMany({ where: { userId } }).catch(() => undefined);
    await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
    await app?.close();
  });

  it('POST /auth/two-factor/enable returns totpURI and backup codes', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/two-factor/enable')
      .set('Origin', getConfig().api.corsOrigins[0] ?? 'http://localhost:3000')
      .set('Cookie', cookie)
      .send({ password });

    expect(response.status).toBe(200);
    expect(response.body.totpURI).toBeTruthy();
    expect(response.body.backupCodes?.length).toBeGreaterThan(0);
  });
});
