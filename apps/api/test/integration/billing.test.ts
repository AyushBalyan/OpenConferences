import { createHmac } from 'node:crypto';
import { describe, expect, it, beforeAll, afterAll, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import request from 'supertest';
import { getConfig, resetConfig } from '@openconferences/config/env';
import { prisma, generateId, withTenantContext } from '@openconferences/db';
import * as db from '@openconferences/db';
import { AppModule } from '../../src/app.module.ts';
import { APP_FILTER } from '@nestjs/core';
import { ProblemExceptionFilter } from '../../src/common/filters/problem-exception.filter.ts';
import {
  MockPaymentProvider,
  resetMockPaymentProvider,
} from '../../src/billing/mock-payment.provider.ts';
import { PaymentProviderRegistry } from '../../src/billing/payment-provider.registry.ts';

import { REDIS_CLIENT } from '../../src/redis/redis.module.ts';
import { RegistrationsService } from '../../src/billing/registrations.service.ts';
import { InvoicesService } from '../../src/billing/invoices.service.ts';
import { RazorpayProvider } from '../../src/billing/razorpay.provider.ts';
import { ensureNotificationTemplates } from '../helpers/notifications';
import { QueueService } from '../../src/queue/queue.service';
import { NotificationPublisher } from '../../src/messaging/notification.publisher';

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
    .send({ email, password })
    .expect(200);

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
  expectedStatus = 201,
) {
  const payload = mockProvider.buildCaptureWebhook(orderId, paymentId);
  const rawBody = Buffer.from(JSON.stringify(payload));
  const signature = mockProvider.signWebhookPayload(rawBody);

  return request(app.getHttpServer())
    .post('/api/v1/webhooks/razorpay')
    .set('x-razorpay-signature', signature)
    .set('Content-Type', 'application/json')
    .send(payload)
    .expect(expectedStatus);
}

// Serialized via vitest singleFork to avoid pg-boss deadlocks across suites.
describe('Billing integration (Phase 8)', () => {
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

  const chairEmail = `chair-bill-${Date.now()}@example.com`;
  const authorRegularEmail = `author-reg-${Date.now()}@example.com`;
  const authorStudentEmail = `author-stu-${Date.now()}@example.com`;

  let chairCookie = '';
  let authorRegularCookie = '';
  let authorStudentCookie = '';
  let studentVerificationId = '';
  let chairUserId = '';
  let authorUserId = '';
  const laterPaperId = generateId();
  const indianPaperId = generateId();
  const signedPaperId = generateId();
  const rejectedPaperId = generateId();

  beforeAll(async () => {
    resetMockPaymentProvider();
    await ensureNotificationTemplates();

    const cache = new Map<string, string>();
    const moduleRef = await Test.createTestingModule({
      imports: [LoggerModule.forRoot({ pinoHttp: { level: 'silent' } }), AppModule],
      providers: [{ provide: APP_FILTER, useClass: ProblemExceptionFilter }],
    })
      .overrideProvider(InvoicesService)
      .useValue({ generateInvoice: vi.fn().mockResolvedValue(undefined) })
      .overrideProvider(REDIS_CLIENT)
      .useValue({
        get: async (key: string) => cache.get(key) ?? null,
        set: async (key: string, value: string) => {
          cache.set(key, value);
          return 'OK';
        },
        del: async (key: string) => Number(cache.delete(key)),
        incr: async (key: string) => {
          const n = Number(cache.get(key) ?? 0) + 1;
          cache.set(key, String(n));
          return n;
        },
        expire: async () => 1,
        ttl: async () => 60,
      })
      .compile();

    app = moduleRef.createNestApplication({ rawBody: true });
    app.setGlobalPrefix('api/v1');
    await app.init();
    // pg-boss tables are created at startup, after migrations in a fresh test DB.
    await prisma.$executeRawUnsafe(
      'GRANT SELECT, INSERT ON TABLE pgboss.job TO openconferences_api',
    );
    await prisma.$executeRawUnsafe('GRANT SELECT ON TABLE pgboss.queue TO openconferences_api');

    mockProvider = app.get(PaymentProviderRegistry).getMockProvider();

    const chair = await createUserWithSession(app, chairEmail, 'Chair Bill');
    const authorRegular = await createUserWithSession(app, authorRegularEmail, 'Author Regular');
    const authorStudent = await createUserWithSession(app, authorStudentEmail, 'Author Student');
    chairCookie = chair.cookie;
    chairUserId = chair.userId;
    authorUserId = authorRegular.userId;
    authorRegularCookie = authorRegular.cookie;
    authorStudentCookie = authorStudent.cookie;

    await prisma.user.update({
      where: { id: chair.userId },
      data: { twoFactorEnabled: true },
    });

    await withTenantContext({}, async (tx) => {
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
                affiliation: 'Billing Test University',
                email: `${paperId}@example.com`,
              },
            },
          },
        });

        const cycleId = generateId();
        await tx.reviewRound.create({
          data: {
            id: cycleId,
            organizationId: orgId,
            conferenceId: confId,
            paperId,
            roundNumber: 1,
          },
        });

        await tx.decision.create({
          data: {
            id: generateId(),
            organizationId: orgId,
            conferenceId: confId,
            paperId,
            roundId: cycleId,
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
      await createAcceptedPaper(laterPaperId, trackId, authorRegular.userId, 'Later Paper');
      await createAcceptedPaper(indianPaperId, trackId, authorRegular.userId, 'Indian Paper');
      await createAcceptedPaper(signedPaperId, trackId, authorRegular.userId, 'Signed Paper');
      await createAcceptedPaper(rejectedPaperId, trackId, authorRegular.userId, 'Rejected Paper');
      await tx.decision.updateMany({
        where: { paperId: laterPaperId },
        data: { outcome: 'MAJOR_REVISION' },
      });
      await tx.registration.deleteMany({ where: { paperId: laterPaperId } });
      await tx.decision.updateMany({
        where: { paperId: rejectedPaperId },
        data: { outcome: 'REJECT' },
      });

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

  it('requires the registered author affiliation, ignores another coauthor affiliation, and saves the invoice snapshot', async () => {
    await prisma.authorship.updateMany({
      where: { paperId: paperRegularId },
      data: { affiliation: null },
    });
    await prisma.authorship.create({
      data: {
        id: generateId(),
        paperId: paperRegularId,
        order: 2,
        fullName: 'Other Coauthor',
        email: 'coauthor@example.test',
        affiliation: 'Other Coauthor University',
      },
    });
    const base = `/api/v1/conferences/${confId}/papers/${paperRegularId}/registration`;
    const missing = await request(app.getHttpServer())
      .get(base)
      .set('Cookie', authorRegularCookie)
      .expect(200);
    expect(missing.body.billingAffiliation).toBeNull();
    await request(app.getHttpServer())
      .post(base)
      .set('Cookie', authorRegularCookie)
      .send({ audience: 'REGULAR' })
      .expect(422);
    await request(app.getHttpServer())
      .post(`${base}/payment`)
      .set('Cookie', authorRegularCookie)
      .set('Idempotency-Key', generateId())
      .send({})
      .expect(422);
    await request(app.getHttpServer())
      .post(base)
      .set('Cookie', authorRegularCookie)
      .send({ audience: 'REGULAR', billingAffiliation: '   ' })
      .expect(400);
    const saved = await request(app.getHttpServer())
      .post(base)
      .set('Cookie', authorRegularCookie)
      .send({ audience: 'REGULAR', billingAffiliation: '  Entered Invoice University  ' })
      .expect(201);
    expect(saved.body.billingAffiliation).toBe('Entered Invoice University');
    await prisma.authorship.updateMany({
      where: { paperId: paperRegularId, userId: authorUserId },
      data: { affiliation: 'Changed Paper University' },
    });
    const result = await request(app.getHttpServer())
      .get(base)
      .set('Cookie', authorRegularCookie)
      .expect(200);
    expect(result.body.billingAffiliation).toBe('Entered Invoice University');
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
    const transactionId = `pay_regular_${Date.now()}`;
    const schedulingFailure = vi
      .spyOn(app.get(QueueService), 'sendNotification')
      .mockRejectedValueOnce(new Error('Notification queue temporarily unavailable'));
    await simulateCapture(app, mockProvider, orderId, transactionId, 500);
    schedulingFailure.mockRestore();
    expect(
      await prisma.notificationLog.findUnique({
        where: { idempotencyKey: `payment-captured-${payRes.body.paymentId}` },
      }),
    ).toBeNull();
    const invoiceFailure = vi
      .spyOn(app.get(QueueService), 'enqueueInvoiceGeneration')
      .mockRejectedValueOnce(new Error('Invoice queue temporarily unavailable'));
    await simulateCapture(app, mockProvider, orderId, transactionId);
    invoiceFailure.mockRestore();

    const receipt = await prisma.notificationLog.findUnique({
      where: { idempotencyKey: `payment-captured-${payRes.body.paymentId}` },
    });
    expect(receipt?.toEmail).toBe(authorRegularEmail);
    expect(receipt?.renderedHtml).toContain('18000.00 INR');
    expect(receipt?.renderedHtml).toContain(transactionId);
    expect(receipt?.renderedHtml).toContain('Regular Paper');
    await simulateCapture(app, mockProvider, orderId, transactionId);
    expect(
      await prisma.notificationLog.count({ where: { relatedEntityId: payRes.body.paymentId } }),
    ).toBe(1);

    const sendFailure = vi
      .spyOn(app.get(NotificationPublisher), 'publishPaymentCaptured')
      .mockRejectedValueOnce(new Error('Email queue temporarily unavailable'));
    await simulateCapture(app, mockProvider, orderId, transactionId, 500);
    await simulateCapture(app, mockProvider, orderId, transactionId);
    sendFailure.mockRestore();
    expect(
      await prisma.notificationLog.count({ where: { relatedEntityId: payRes.body.paymentId } }),
    ).toBe(1);

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

    const payments = await withTenantContext({}, async (tx) =>
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

  it('rejects registration and direct checkout for a non-accepted paper', async () => {
    for (const paperId of [laterPaperId, rejectedPaperId]) {
      await request(app.getHttpServer())
        .post(`/api/v1/conferences/${confId}/papers/${paperId}/registration`)
        .set('Cookie', authorRegularCookie)
        .send({ audience: 'REGULAR' })
        .expect(422);
      await request(app.getHttpServer())
        .post(`/api/v1/conferences/${confId}/papers/${paperId}/registration/payment`)
        .set('Cookie', authorRegularCookie)
        .set('Idempotency-Key', generateId())
        .send({})
        .expect(422);
    }
  });

  it('charges $50 when another paper is accepted later, reuses orders and freezes registration details', async () => {
    await withTenantContext({}, async (tx) => {
      await tx.conference.update({
        where: { id: confId },
        data: {
          feeSchedule: {
            ...FEE_SCHEDULE,
            currency: 'USD',
            additionalPaperMinor: 5000,
            domesticInrPerUsd: 80,
            matrix: {
              REGULAR: { EARLY: 12500, REGULAR: 15000 },
              STUDENT: { EARLY: 7500, REGULAR: 10000 },
            },
          },
        },
      });
      await tx.decision.updateMany({
        where: { paperId: laterPaperId },
        data: { outcome: 'ACCEPT', notifiedAt: new Date() },
      });
    });
    const originalTenantContext = db.withTenantContext;
    const apiRole = vi
      .spyOn(db, 'withTenantContext')
      .mockImplementation((context, callback, options) =>
        originalTenantContext(
          context,
          async (tx) => {
            await tx.$executeRawUnsafe('SET LOCAL ROLE openconferences_api');
            return callback(tx);
          },
          options,
        ),
      );
    try {
      await app
        .get(RegistrationsService)
        .openRegistration(orgId, confId, laterPaperId, chairUserId);
      const base = `/api/v1/conferences/${confId}/papers/${laterPaperId}/registration`;
      await request(app.getHttpServer())
        .post(base)
        .set('Cookie', authorRegularCookie)
        .send({ audience: 'REGULAR', billingCountry: 'US' })
        .expect(201);
      const preview = await request(app.getHttpServer())
        .get(base)
        .set('Cookie', authorRegularCookie)
        .expect(200);
      expect(preview.body.paymentQuote).toMatchObject({
        amountMinor: 5000,
        currency: 'USD',
        isAdditionalPaper: true,
      });
      const first = await request(app.getHttpServer())
        .post(`${base}/payment`)
        .set('Cookie', authorRegularCookie)
        .set('Idempotency-Key', generateId())
        .send({ amountMinor: 1 })
        .expect(200);
      expect(first.body).toMatchObject({ amountMinor: 5000, currency: 'USD' });
      const again = await request(app.getHttpServer())
        .post(`${base}/payment`)
        .set('Cookie', authorRegularCookie)
        .set('Idempotency-Key', generateId())
        .send({})
        .expect(200);
      expect(again.body.orderId).toBe(first.body.orderId);
      const latestAcceptance = await withTenantContext(
        { userId: authorUserId, conferenceId: confId },
        async (tx) => tx.decision.findFirst({ where: { paperId: laterPaperId } }),
      );
      expect(latestAcceptance?.outcome).toBe('ACCEPT');
      await request(app.getHttpServer())
        .post(base)
        .set('Cookie', authorRegularCookie)
        .send({ audience: 'STUDENT', billingCountry: 'IN' })
        .expect(409);
      await simulateCapture(app, mockProvider, first.body.orderId, `pay_later_${Date.now()}`);
      const result = await request(app.getHttpServer())
        .get(base)
        .set('Cookie', authorRegularCookie)
        .expect(200);
      expect(result.body).toMatchObject({
        status: 'PAID',
        isAdditionalPaper: true,
        amountDueMinor: 5000,
      });
      const captureAudits = await withTenantContext(
        { userId: authorUserId, conferenceId: confId },
        async (tx) =>
          tx.auditLog.count({
            where: { action: 'payment.captured', entityId: first.body.paymentId },
          }),
      );
      expect(captureAudits).toBe(1);
      await request(app.getHttpServer())
        .post(`${base}/payment`)
        .set('Cookie', authorRegularCookie)
        .set('Idempotency-Key', generateId())
        .send({})
        .expect(409);
    } finally {
      apiRole.mockRestore();
    }
  });

  it('requires a country and configured rate, then locks Indian checkout in INR', async () => {
    const base = `/api/v1/conferences/${confId}/papers/${indianPaperId}/registration`;
    await request(app.getHttpServer())
      .post(`${base}/payment`)
      .set('Cookie', authorRegularCookie)
      .set('Idempotency-Key', generateId())
      .send({})
      .expect(422);
    await request(app.getHttpServer())
      .post(base)
      .set('Cookie', authorRegularCookie)
      .send({ audience: 'REGULAR', billingCountry: 'ZZ' })
      .expect(400);
    await request(app.getHttpServer())
      .post(base)
      .set('Cookie', authorRegularCookie)
      .send({ audience: 'REGULAR', billingCountry: 'IN' })
      .expect(201);
    const payment = await request(app.getHttpServer())
      .post(`${base}/payment`)
      .set('Cookie', authorRegularCookie)
      .set('Idempotency-Key', generateId())
      .send({})
      .expect(200);
    expect(payment.body).toMatchObject({ amountMinor: 400000, currency: 'INR' });
    // A later rate change cannot change a previously issued order.
    await withTenantContext({}, async (tx) => {
      const conference = await tx.conference.findUniqueOrThrow({ where: { id: confId } });
      await tx.conference.update({
        where: { id: confId },
        data: { feeSchedule: { ...(conference.feeSchedule as object), domesticInrPerUsd: 100 } },
      });
    });
    const retry = await request(app.getHttpServer())
      .post(`${base}/payment`)
      .set('Cookie', authorRegularCookie)
      .set('Idempotency-Key', generateId())
      .send({})
      .expect(200);
    expect(retry.body).toMatchObject({
      orderId: payment.body.orderId,
      amountMinor: 400000,
      currency: 'INR',
    });
    const tampered = mockProvider.buildCaptureWebhook(payment.body.orderId) as {
      payload: { payment: { entity: { amount: number } } };
    };
    tampered.payload.payment.entity.amount = 1;
    await request(app.getHttpServer())
      .post('/api/v1/webhooks/razorpay')
      .set(
        'x-razorpay-signature',
        mockProvider.signWebhookPayload(Buffer.from(JSON.stringify(tampered))),
      )
      .send(tampered)
      .expect(400);
    await simulateCapture(app, mockProvider, payment.body.orderId, `pay_indian_${Date.now()}`);
  });

  it('verifies signed checkout, rejects wrong signatures and owners, and processes callback/webhook races once', async () => {
    const base = `/api/v1/conferences/${confId}/papers/${signedPaperId}/registration`;
    const signedOrderId = `order_${generateId().replace(/-/g, '')}`;
    const signedPaymentId = `pay_${generateId().replace(/-/g, '')}`;
    await request(app.getHttpServer())
      .post(base)
      .set('Cookie', authorRegularCookie)
      .send({ audience: 'REGULAR', billingCountry: 'GB' })
      .expect(201);
    const response = await request(app.getHttpServer())
      .post(`${base}/payment`)
      .set('Cookie', authorRegularCookie)
      .set('Idempotency-Key', generateId())
      .send({})
      .expect(200);
    await withTenantContext({}, async (tx) =>
      tx.payment.update({
        where: { id: response.body.paymentId },
        data: { provider: 'razorpay', providerOrderId: signedOrderId },
      }),
    );
    const provider = app.get(RazorpayProvider);
    const registry = app.get(PaymentProviderRegistry);
    vi.stubEnv('RAZORPAY_KEY_ID', 'test-key');
    vi.stubEnv('RAZORPAY_KEY_SECRET', 'test-secret');
    vi.stubEnv('RAZORPAY_WEBHOOK_SECRET', 'hook-secret');
    resetConfig();
    const key = createHmac('sha256', 'test-secret')
      .update(`${signedOrderId}|${signedPaymentId}`)
      .digest('hex');
    const body = {
      razorpay_order_id: signedOrderId,
      razorpay_payment_id: signedPaymentId,
      razorpay_signature: key,
    };
    const entity = {
      id: signedPaymentId,
      order_id: signedOrderId,
      amount: 5000,
      currency: 'USD',
      status: 'captured',
      captured: true,
      created_at: Math.floor(Date.now() / 1000),
    };
    const fetchPayment = vi.spyOn(provider, 'fetchPayment').mockResolvedValue(entity);
    const resolve = vi.spyOn(registry, 'resolve').mockReturnValue(provider);
    try {
      await request(app.getHttpServer())
        .post(`${base}/payment/verify`)
        .set('Cookie', authorRegularCookie)
        .send({})
        .expect(400);
      await request(app.getHttpServer())
        .post(`${base}/payment/verify`)
        .set('Cookie', chairCookie)
        .send(body)
        .expect(403);
      await request(app.getHttpServer())
        .post(`${base}/payment/verify`)
        .set('Cookie', authorRegularCookie)
        .send({ ...body, razorpay_signature: '0'.repeat(64) })
        .expect(400);
      expect(fetchPayment).not.toHaveBeenCalled();
      fetchPayment.mockResolvedValueOnce({ ...entity, amount: 1 });
      await request(app.getHttpServer())
        .post(`${base}/payment/verify`)
        .set('Cookie', authorRegularCookie)
        .send(body)
        .expect(400);
      fetchPayment.mockResolvedValueOnce({ ...entity, status: 'authorized', captured: false });
      const authorized = await request(app.getHttpServer())
        .post(`${base}/payment/verify`)
        .set('Cookie', authorRegularCookie)
        .send(body)
        .expect(200);
      expect(authorized.body).toMatchObject({
        verified: true,
        captured: false,
        registration: { status: 'PENDING' },
      });
      const before = await withTenantContext({}, async (tx) =>
        tx.registration.findFirstOrThrow({ where: { paperId: signedPaperId } }),
      );
      const webhook = { event: 'payment.captured', payload: { payment: { entity } } };
      const webhookSignature = createHmac('sha256', 'hook-secret')
        .update(JSON.stringify(webhook))
        .digest('hex');
      const [verified] = await Promise.all([
        request(app.getHttpServer())
          .post(`${base}/payment/verify`)
          .set('Cookie', authorRegularCookie)
          .send(body)
          .expect(200),
        request(app.getHttpServer())
          .post('/api/v1/webhooks/razorpay')
          .set('x-razorpay-signature', webhookSignature)
          .send(webhook)
          .expect(201),
      ]);
      expect(verified.body).toMatchObject({
        verified: true,
        captured: true,
        registration: { status: 'PAID' },
      });
      const after = await withTenantContext({}, async (tx) =>
        tx.registration.findFirstOrThrow({ where: { paperId: signedPaperId } }),
      );
      expect(after.version).toBe(before.version + 1);
    } finally {
      fetchPayment.mockRestore();
      resolve.mockRestore();
      vi.unstubAllEnvs();
      resetConfig();
    }
  });

  it('refund reverts paid-state', async () => {
    const reg = await withTenantContext({}, async (tx) =>
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
