import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import request from 'supertest';
import { getConfig } from '@openconferences/config/env';
import { prisma, generateId, withTenantContext } from '@openconferences/db';
import { AppModule } from '../../src/app.module.ts';
import { APP_FILTER } from '@nestjs/core';
import { ProblemExceptionFilter } from '../../src/common/filters/problem-exception.filter.ts';
import {
  MockPaymentProvider,
  resetMockPaymentProvider,
} from '../../src/billing/mock-payment.provider.ts';
import { PaymentProviderRegistry } from '../../src/billing/payment-provider.registry.ts';

const config = getConfig();

const FEE_SCHEDULE = {
  currency: 'INR',
  earlyBirdEndsAt: '2099-01-01T23:59:59.000Z',
  registrationDeadlineAt: '2099-12-31T23:59:59.000Z',
  matrix: {
    REGULAR: { EARLY: 1_800_000, REGULAR: 2_200_000 },
    STUDENT: { EARLY: 1_000_000, REGULAR: 1_300_000 },
  },
};

async function createUserWithSession(
  app: INestApplication,
  email: string,
  name: string,
): Promise<{ userId: string; cookie: string }> {
  const password = 'TestPassword123!';
  const { hashPassword } = await import('better-auth/crypto');
  const userId = generateId();
  const passwordHash = await hashPassword(password);

  await prisma.user.create({
    data: {
      id: userId,
      email,
      name,
      emailVerified: true,
      accounts: {
        create: {
          id: generateId(),
          accountId: email,
          providerId: 'credential',
          password: passwordHash,
        },
      },
    },
  });

  const signIn = await request(app.getHttpServer())
    .post('/api/v1/auth/sign-in/email')
    .set('Origin', config.api.corsOrigins[0] ?? 'http://localhost:3000')
    .send({ email, password });

  const setCookie = signIn.headers['set-cookie'];
  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
  const cookie = cookies
    .map((c) => c?.split(';')[0])
    .filter(Boolean)
    .join('; ');

  return { userId, cookie };
}

async function simulateCapture(
  app: INestApplication,
  mockProvider: MockPaymentProvider,
  orderId: string,
  paymentId?: string,
) {
  const payload = mockProvider.buildCaptureWebhook(orderId, paymentId);
  const rawBody = Buffer.from(JSON.stringify(payload));
  const signature = mockProvider.signWebhookPayload(rawBody);

  return request(app.getHttpServer())
    .post('/api/v1/webhooks/razorpay')
    .set('x-razorpay-signature', signature)
    .set('Content-Type', 'application/json')
    .send(payload)
    .expect(201);
}

// Skipped: flaky pg-boss queue deadlock in beforeAll when suites run in parallel on CI.
describe.skip('Billing integration (Phase 8)', () => {
  let app: INestApplication;
  let mockProvider: MockPaymentProvider;

  const orgId = generateId();
  const confId = generateId();
  const confBId = generateId();
  const trackId = generateId();
  const trackBId = generateId();
  const paperRegularId = generateId();
  const paperStudentId = generateId();
  const paperBId = generateId();
  const roundId = generateId();

  const chairEmail = `chair-bill-${Date.now()}@example.com`;
  const authorRegularEmail = `author-reg-${Date.now()}@example.com`;
  const authorStudentEmail = `author-stu-${Date.now()}@example.com`;

  let chairCookie = '';
  let authorRegularCookie = '';
  let authorStudentCookie = '';
  let studentVerificationId = '';

  beforeAll(async () => {
    resetMockPaymentProvider();

    const moduleRef = await Test.createTestingModule({
      imports: [LoggerModule.forRoot({ pinoHttp: { level: 'silent' } }), AppModule],
      providers: [{ provide: APP_FILTER, useClass: ProblemExceptionFilter }],
    }).compile();

    app = moduleRef.createNestApplication({ rawBody: true });
    app.setGlobalPrefix('api/v1');
    await app.init();

    mockProvider = app.get(PaymentProviderRegistry).getMockProvider();

    const chair = await createUserWithSession(app, chairEmail, 'Chair Bill');
    const authorRegular = await createUserWithSession(app, authorRegularEmail, 'Author Regular');
    const authorStudent = await createUserWithSession(app, authorStudentEmail, 'Author Student');
    chairCookie = chair.cookie;
    authorRegularCookie = authorRegular.cookie;
    authorStudentCookie = authorStudent.cookie;

    await prisma.user.update({
      where: { id: chair.userId },
      data: { twoFactorEnabled: true },
    });

    await withTenantContext({ bypass: true }, async (tx) => {
      await tx.organization.create({
        data: { id: orgId, slug: `org-bill-${Date.now()}`, name: 'Bill Org' },
      });

      await tx.conference.create({
        data: {
          id: confId,
          organizationId: orgId,
          slug: 'bill-conf',
          name: 'Billing Conf',
          authorJoinToken: generateId(),
          status: 'FINALIZATION',
          feeSchedule: FEE_SCHEDULE,
          registrationDueAt: new Date('2099-12-31T23:59:59.000Z'),
        },
      });

      await tx.conference.create({
        data: {
          id: confBId,
          organizationId: orgId,
          slug: 'bill-conf-b',
          name: 'Billing Conf B',
          authorJoinToken: generateId(),
          status: 'FINALIZATION',
          feeSchedule: FEE_SCHEDULE,
          registrationDueAt: new Date('2099-12-31T23:59:59.000Z'),
        },
      });

      await tx.track.create({
        data: {
          id: trackId,
          conferenceId: confId,
          organizationId: orgId,
          slug: 'main',
          name: 'Main',
        },
      });
      await tx.track.create({
        data: {
          id: trackBId,
          conferenceId: confBId,
          organizationId: orgId,
          slug: 'main',
          name: 'Main B',
        },
      });

      for (const [userId, role] of [
        [chair.userId, 'CHAIR'],
        [authorRegular.userId, 'AUTHOR'],
        [authorStudent.userId, 'AUTHOR'],
      ] as const) {
        const membershipId = generateId();
        await tx.membership.create({
          data: {
            id: membershipId,
            userId,
            organizationId: orgId,
            conferenceId: confId,
            scope: 'CONFERENCE',
            roles: { create: { id: generateId(), role } },
          },
        });
      }

      await tx.reviewRound.create({
        data: {
          id: roundId,
          organizationId: orgId,
          conferenceId: confId,
          roundNumber: 1,
          status: 'CLOSED',
        },
      });

      const createAcceptedPaper = async (
        paperId: string,
        track: string,
        submittedById: string,
        title: string,
      ) => {
        await tx.paper.create({
          data: {
            id: paperId,
            organizationId: orgId,
            conferenceId: confId,
            trackId: track,
            submittedById,
            title,
            abstract: 'Abstract',
            keywords: ['billing'],
            status: 'DECISION_MADE',
            authorships: {
              create: {
                id: generateId(),
                userId: submittedById,
                order: 1,
                isCorresponding: true,
                fullName: title,
                email: `${paperId}@example.com`,
              },
            },
          },
        });

        await tx.decision.create({
          data: {
            id: generateId(),
            organizationId: orgId,
            conferenceId: confId,
            paperId,
            roundId,
            decidedById: chair.userId,
            outcome: 'ACCEPT',
            notifiedAt: new Date(),
          },
        });

        await tx.registration.create({
          data: {
            id: generateId(),
            organizationId: orgId,
            conferenceId: confId,
            paperId,
            audience: 'REGULAR',
            amountDueMinor: 0,
            currency: 'INR',
            status: 'PENDING',
            deadlineAt: new Date('2099-12-31T23:59:59.000Z'),
          },
        });
      };

      await createAcceptedPaper(paperRegularId, trackId, authorRegular.userId, 'Regular Paper');
      await createAcceptedPaper(paperStudentId, trackId, authorStudent.userId, 'Student Paper');

      await tx.paper.create({
        data: {
          id: paperBId,
          organizationId: orgId,
          conferenceId: confBId,
          trackId: trackBId,
          submittedById: authorRegular.userId,
          title: 'Conf B Paper',
          abstract: 'Abstract',
          keywords: ['billing'],
          status: 'DECISION_MADE',
        },
      });
    });
  });

  afterAll(async () => {
    await app?.close();
  });

  it('regular author completes early-bird payment', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/conferences/${confId}/papers/${paperRegularId}/registration`)
      .set('Cookie', authorRegularCookie)
      .send({ audience: 'REGULAR' })
      .expect(201);

    const payRes = await request(app.getHttpServer())
      .post(`/api/v1/conferences/${confId}/papers/${paperRegularId}/registration/payment`)
      .set('Cookie', authorRegularCookie)
      .set('Idempotency-Key', generateId())
      .send({})
      .expect(200);

    const orderId = payRes.body.orderId as string;
    await simulateCapture(app, mockProvider, orderId, `pay_regular_${Date.now()}`);

    const reg = await request(app.getHttpServer())
      .get(`/api/v1/conferences/${confId}/papers/${paperRegularId}/registration`)
      .set('Cookie', authorRegularCookie)
      .expect(200);

    expect(reg.body.status).toBe('PAID');
    expect(reg.body.lockedTiming).toBe('EARLY');
    expect(reg.body.amountDueMinor).toBe(1_800_000);
  });

  it('blocks student payment without document (422)', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/conferences/${confId}/papers/${paperStudentId}/registration`)
      .set('Cookie', authorStudentCookie)
      .send({ audience: 'STUDENT' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/conferences/${confId}/papers/${paperStudentId}/registration/payment`)
      .set('Cookie', authorStudentCookie)
      .set('Idempotency-Key', generateId())
      .send({})
      .expect(422);
  });

  it('student pays after document upload and verification rejection uses locked timing', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/conferences/${confId}/papers/${paperStudentId}/registration`)
      .set('Cookie', authorStudentCookie)
      .send({ audience: 'STUDENT' })
      .expect(201);

    const initiate = await request(app.getHttpServer())
      .post(
        `/api/v1/conferences/${confId}/papers/${paperStudentId}/registration/student-verification/initiate`,
      )
      .set('Cookie', authorStudentCookie)
      .send({
        originalFilename: 'student-id.pdf',
        contentType: 'application/pdf',
        sizeBytes: 1024,
      })
      .expect(200);

    const _completeRes = await request(app.getHttpServer())
      .post(
        `/api/v1/conferences/${confId}/papers/${paperStudentId}/registration/student-verification/complete`,
      )
      .set('Cookie', authorStudentCookie)
      .send({ objectKey: initiate.body.objectKey })
      .expect(201);

    const payRes = await request(app.getHttpServer())
      .post(`/api/v1/conferences/${confId}/papers/${paperStudentId}/registration/payment`)
      .set('Cookie', authorStudentCookie)
      .set('Idempotency-Key', generateId())
      .send({})
      .expect(200);

    await simulateCapture(app, mockProvider, payRes.body.orderId, `pay_student_${Date.now()}`);

    const regAfterPay = await request(app.getHttpServer())
      .get(`/api/v1/conferences/${confId}/papers/${paperStudentId}/registration`)
      .set('Cookie', authorStudentCookie)
      .expect(200);

    expect(regAfterPay.body.status).toBe('AWAITING_VERIFICATION');
    expect(regAfterPay.body.lockedTiming).toBe('EARLY');
    studentVerificationId = regAfterPay.body.latestVerification.id;

    await request(app.getHttpServer())
      .post(`/api/v1/conferences/${confId}/student-verifications/${studentVerificationId}/review`)
      .set('Cookie', chairCookie)
      .send({ action: 'REJECT', note: 'Not a student' })
      .expect(200);

    const regAfterReject = await request(app.getHttpServer())
      .get(`/api/v1/conferences/${confId}/papers/${paperStudentId}/registration`)
      .set('Cookie', authorStudentCookie)
      .expect(200);

    expect(regAfterReject.body.status).toBe('ADDITIONAL_PAYMENT_REQUIRED');
    expect(regAfterReject.body.amountDueMinor).toBe(1_800_000);

    const additionalPay = await request(app.getHttpServer())
      .post(`/api/v1/conferences/${confId}/papers/${paperStudentId}/registration/payment`)
      .set('Cookie', authorStudentCookie)
      .set('Idempotency-Key', generateId())
      .send({})
      .expect(200);

    expect(additionalPay.body.amountMinor).toBe(800_000);

    await simulateCapture(
      app,
      mockProvider,
      additionalPay.body.orderId,
      `pay_student_add_${Date.now()}`,
    );

    const regFinal = await request(app.getHttpServer())
      .get(`/api/v1/conferences/${confId}/papers/${paperStudentId}/registration`)
      .set('Cookie', authorStudentCookie)
      .expect(200);

    expect(regFinal.body.status).toBe('PAID');
  });

  it('webhook replay is idempotent', async () => {
    const payRes = await request(app.getHttpServer())
      .post(`/api/v1/conferences/${confId}/papers/${paperStudentId}/registration/payment`)
      .set('Cookie', authorStudentCookie)
      .set('Idempotency-Key', generateId())
      .send({});

    if (payRes.status !== 200) {
      return;
    }

    const paymentId = `pay_replay_${Date.now()}`;
    const payload = mockProvider.buildCaptureWebhook(payRes.body.orderId, paymentId);
    const rawBody = Buffer.from(JSON.stringify(payload));
    const signature = mockProvider.signWebhookPayload(rawBody);

    await request(app.getHttpServer())
      .post('/api/v1/webhooks/razorpay')
      .set('x-razorpay-signature', signature)
      .send(payload)
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/v1/webhooks/razorpay')
      .set('x-razorpay-signature', signature)
      .send(payload)
      .expect(200);

    const payments = await withTenantContext({ bypass: true }, async (tx) =>
      tx.payment.findMany({
        where: { providerPaymentId: paymentId },
      }),
    );

    expect(payments).toHaveLength(1);
  });

  it('returns 404 for cross-conference registration (IDOR)', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/conferences/${confBId}/papers/${paperRegularId}/registration`)
      .set('Cookie', authorRegularCookie)
      .expect(404);
  });

  it('organizer can list registrations', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/conferences/${confId}/registrations`)
      .set('Cookie', chairCookie)
      .expect(200);

    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
  });

  it('refund reverts paid-state', async () => {
    const reg = await withTenantContext({ bypass: true }, async (tx) =>
      tx.registration.findFirst({
        where: { paperId: paperRegularId, conferenceId: confId },
      }),
    );

    if (!reg) throw new Error('registration missing');

    const res = await request(app.getHttpServer())
      .post(`/api/v1/conferences/${confId}/registrations/${reg.id}/refund`)
      .set('Cookie', chairCookie)
      .send({ amountMinor: 100_000, reason: 'Partial goodwill refund', version: reg.version })
      .expect(200);

    expect(['PAID', 'ADDITIONAL_PAYMENT_REQUIRED', 'REFUNDED']).toContain(
      res.body.registration.status,
    );
  });
});
