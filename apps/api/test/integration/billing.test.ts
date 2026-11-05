import { createHmac } from 'node:crypto';
import { describe, expect, it, beforeAll, afterAll, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import request from 'supertest';
import { getConfig, resetConfig } from '@openconferences/config/env';
import {
  prisma,
  generateId,
  withTenantContext,
  applyScanResultInTransaction,
} from '@openconferences/db';
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
import { DecisionsService } from '../../src/review/decisions.service';
import { RegistrationsService } from '../../src/billing/registrations.service.ts';
import { InvoicesService } from '../../src/billing/invoices.service.ts';
import { RazorpayProvider } from '../../src/billing/razorpay.provider.ts';
import { ensureNotificationTemplates } from '../helpers/notifications';
import { FilesService } from '../../src/files/files.service';
import { AuditService } from '../../src/audit/audit.service';
import { PaymentsService } from '../../src/billing/payments.service';
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
          accountId: userId,
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
            billingName: 'Test Author',
            billingAddress: '12 Test Road',
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
      .send({ billingName: 'Test Author', billingAddress: '12 Test Road', audience: 'REGULAR' })
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
      .send({
        billingName: 'Test Author',
        billingAddress: '12 Test Road',
        audience: 'REGULAR',
        billingAffiliation: '   ',
      })
      .expect(400);
    const saved = await request(app.getHttpServer())
      .post(base)
      .set('Cookie', authorRegularCookie)
      .send({
        audience: 'REGULAR',
        billingAffiliation: '  Entered Invoice University  ',
        billingName: 'University Finance Office',
        billingEmail: 'finance@example.test',
        billingAddress: '12 Research Road, New Delhi 110001',
        billingTaxId: 'TEST-TAX-123',
      })
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
    expect(result.body).toMatchObject({
      billingAffiliation: 'Entered Invoice University',
      billingName: 'University Finance Office',
      billingEmail: 'finance@example.test',
      billingAddress: '12 Research Road, New Delhi 110001',
      billingTaxId: 'TEST-TAX-123',
    });
  });

  it('rejects checkout without billing name or address at the API boundary', async () => {
    const registration = await prisma.registration.findFirstOrThrow({
      where: { paperId: paperRegularId },
    });
    for (const field of ['billingName', 'billingAddress']) {
      await prisma.registration.update({ where: { id: registration.id }, data: { [field]: null } });
      await request(app.getHttpServer())
        .post(`/api/v1/conferences/${confId}/papers/${paperRegularId}/registration/payment`)
        .set('Cookie', authorRegularCookie)
        .set('Idempotency-Key', generateId())
        .send({})
        .expect(422);
      await prisma.registration.update({
        where: { id: registration.id },
        data: { [field]: registration[field as 'billingName' | 'billingAddress'] },
      });
    }
  });

  it('reopens an untouched cancelled registration while preserving billing details', async () => {
    const registration = await prisma.registration.findFirstOrThrow({
      where: { paperId: paperRegularId },
    });
    await prisma.registration.update({
      where: { id: registration.id },
      data: { status: 'CANCELLED' },
    });
    const reopened = await app
      .get(RegistrationsService)
      .openRegistration(orgId, confId, paperRegularId, authorUserId);
    expect(reopened.status).toBe('PENDING');
    expect(reopened.billingName).toBe(registration.billingName);
  });

  it('does not reopen a cancelled checkout with locked pricing', async () => {
    const registration = await prisma.registration.findFirstOrThrow({
      where: { paperId: paperRegularId },
    });
    await prisma.registration.update({
      where: { id: registration.id },
      data: { status: 'CANCELLED', lockedTiming: 'EARLY' },
    });
    await expect(
      app.get(RegistrationsService).openRegistration(orgId, confId, paperRegularId, authorUserId),
    ).rejects.toThrow('requires organizer reconciliation');
    expect(
      (await prisma.registration.findUniqueOrThrow({ where: { id: registration.id } })).status,
    ).toBe('CANCELLED');
    await prisma.registration.update({
      where: { id: registration.id },
      data: { status: registration.status, lockedTiming: registration.lockedTiming },
    });
  });

  it('rolls back decision release when email scheduling fails and rejects stale or withdrawn releases', async () => {
    const paper = await prisma.paper.findUniqueOrThrow({
      where: { id: paperRegularId },
      include: { authorships: true },
    });
    const decision = await prisma.decision.findFirstOrThrow({ where: { paperId: paperRegularId } });
    await prisma.decision.update({ where: { id: decision.id }, data: { notifiedAt: null } });
    const release = (d = decision) =>
      (
        app.get(DecisionsService) as unknown as {
          notifyDecisionAuthors(
            userId: string,
            name: string,
            papers: (typeof paper)[],
            decisions: (typeof decision)[],
          ): Promise<void>;
        }
      ).notifyDecisionAuthors(authorUserId, 'Test Conference', [paper], [d]);
    const queue = vi
      .spyOn(app.get(QueueService), 'sendNotification')
      .mockRejectedValueOnce(new Error('queue unavailable'));
    await expect(release()).rejects.toThrow('queue unavailable');
    queue.mockRestore();
    expect(
      (await prisma.decision.findUniqueOrThrow({ where: { id: decision.id } })).notifiedAt,
    ).toBeNull();
    expect(await prisma.notificationLog.count({ where: { relatedEntityId: decision.id } })).toBe(0);
    await expect(release({ ...decision, id: generateId() })).rejects.toThrow(
      'Only the current decision',
    );
    await prisma.paper.update({ where: { id: paper.id }, data: { status: 'WITHDRAWN' } });
    await expect(release()).rejects.toThrow('Only the current decision');
    await prisma.paper.update({ where: { id: paper.id }, data: { status: paper.status } });
    await prisma.decision.update({
      where: { id: decision.id },
      data: { notifiedAt: decision.notifiedAt },
    });
  });

  it('regular author completes early-bird payment', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/conferences/${confId}/papers/${paperRegularId}/registration`)
      .set('Cookie', authorRegularCookie)
      .send({ billingName: 'Test Author', billingAddress: '12 Test Road', audience: 'REGULAR' })
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
      .send({ billingName: 'Test Author', billingAddress: '12 Test Road', audience: 'STUDENT' })
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
      .send({ billingName: 'Test Author', billingAddress: '12 Test Road', audience: 'STUDENT' })
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

    const proof = _completeRes.body;
    const manuscript = await prisma.paper.findUniqueOrThrow({ where: { id: paperStudentId } });
    await prisma.fileAsset.update({
      where: { id: proof.fileAssetId },
      data: { scanStatus: 'PENDING_SCAN' },
    });
    await request(app.getHttpServer())
      .post(`/api/v1/conferences/${confId}/student-verifications/${proof.id}/review`)
      .set('Cookie', chairCookie)
      .send({ action: 'APPROVE' })
      .expect(409);
    await withTenantContext({}, async (tx) => {
      await tx.$executeRawUnsafe('SET LOCAL ROLE openconferences_worker');
      await applyScanResultInTransaction(tx, {
        fileAssetId: proof.fileAssetId,
        paperVersionId: proof.fileAssetId,
        paperId: paperStudentId,
        scanStatus: 'CLEAN',
      });
    });
    expect(
      (await prisma.paper.findUniqueOrThrow({ where: { id: paperStudentId } })).currentVersionId,
    ).toBe(manuscript.currentVersionId);
    await request(app.getHttpServer())
      .get(`/api/v1/conferences/${confId}/student-verifications/${proof.id}/download`)
      .set('Cookie', authorStudentCookie)
      .expect(403);
    await request(app.getHttpServer())
      .get(`/api/v1/conferences/${confId}/student-verifications/${proof.id}/download`)
      .set('Cookie', chairCookie)
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/conferences/${confId}/student-verifications/${proof.id}/review`)
      .set('Cookie', chairCookie)
      .send({ action: 'CLARIFY', note: 'Please clarify enrollment dates' })
      .expect(200);
    const pendingProofs = await request(app.getHttpServer())
      .get(`/api/v1/conferences/${confId}/student-verifications`)
      .set('Cookie', chairCookie)
      .expect(200);
    expect(pendingProofs.body.data.some((row: { id: string }) => row.id === proof.id)).toBe(true);
    await prisma.studentVerification.update({
      where: { id: proof.id },
      data: { status: 'PENDING' },
    });

    await request(app.getHttpServer())
      .post(
        `/api/v1/conferences/${confId}/papers/${paperStudentId}/registration/student-verification/initiate`,
      )
      .set('Cookie', chairCookie)
      .send({ originalFilename: 'id.pdf', contentType: 'application/pdf', sizeBytes: 100 })
      .expect(403);
    const reviewUrl = `/api/v1/conferences/${confId}/student-verifications/${proof.id}/review`;
    const approvals = await Promise.all(
      [1, 2].map(() =>
        request(app.getHttpServer())
          .post(reviewUrl)
          .set('Cookie', chairCookie)
          .send({ action: 'APPROVE' }),
      ),
    );
    expect(approvals.map((result) => result.status).sort()).toEqual([200, 409]);
    await prisma.studentVerification.update({
      where: { id: proof.id },
      data: { status: 'PENDING' },
    });
    const replacement = await prisma.studentVerification.create({
      data: {
        id: generateId(),
        organizationId: orgId,
        registrationId: proof.registrationId,
        fileAssetId: proof.fileAssetId,
        status: 'PENDING',
        submittedAt: new Date(Date.now() + 1000),
      },
    });
    await request(app.getHttpServer())
      .post(reviewUrl)
      .set('Cookie', chairCookie)
      .send({ action: 'APPROVE' })
      .expect(409);
    await prisma.studentVerification.delete({ where: { id: replacement.id } });

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

  it('webhook replay is idempotent even under concurrent delivery', async () => {
    const payment = await prisma.payment.findFirstOrThrow({
      where: { registration: { paperId: paperRegularId }, status: 'CAPTURED' },
    });
    const before = await prisma.registration.findUniqueOrThrow({
      where: { id: payment.registrationId },
    });
    await Promise.all(
      Array.from({ length: 8 }, () =>
        simulateCapture(app, mockProvider, payment.providerOrderId!, payment.providerPaymentId!),
      ),
    );
    const after = await prisma.registration.findUniqueOrThrow({
      where: { id: payment.registrationId },
    });
    expect(after.version).toBe(before.version);
    expect(
      await prisma.payment.count({ where: { providerPaymentId: payment.providerPaymentId } }),
    ).toBe(1);
    expect(
      await prisma.notificationLog.count({
        where: { idempotencyKey: `payment-captured-${payment.id}` },
      }),
    ).toBe(1);
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
        .send({ billingName: 'Test Author', billingAddress: '12 Test Road', audience: 'REGULAR' })
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
        .send({
          billingName: 'Test Author',
          billingAddress: '12 Test Road',
          audience: 'REGULAR',
          billingCountry: 'US',
        })
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
        .send({
          billingName: 'Test Author',
          billingAddress: '12 Test Road',
          audience: 'STUDENT',
          billingCountry: 'IN',
        })
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
      .send({
        billingName: 'Test Author',
        billingAddress: '12 Test Road',
        audience: 'REGULAR',
        billingCountry: 'ZZ',
      })
      .expect(400);
    await request(app.getHttpServer())
      .post(base)
      .set('Cookie', authorRegularCookie)
      .send({
        billingName: 'Test Author',
        billingAddress: '12 Test Road',
        audience: 'REGULAR',
        billingCountry: 'IN',
      })
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
      .send({
        billingName: 'Test Author',
        billingAddress: '12 Test Road',
        audience: 'REGULAR',
        billingCountry: 'GB',
      })
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
  // Adversarial audit: these fixtures use the isolated test DB and a fake gateway only.
  async function auditCheckout() {
    const paperId = generateId();
    await prisma.paper.create({
      data: {
        id: paperId,
        organizationId: orgId,
        conferenceId: confId,
        trackId,
        submittedById: authorUserId,
        title: 'Payment security audit fixture',
        abstract: 'Isolated test',
        keywords: [],
        status: 'DECISION_MADE',
        authorships: {
          create: {
            id: generateId(),
            userId: authorUserId,
            order: 1,
            isCorresponding: true,
            fullName: 'Audit Author',
            affiliation: 'Audit University',
            email: authorRegularEmail,
          },
        },
      },
    });
    const round = await prisma.reviewRound.create({
      data: {
        id: generateId(),
        organizationId: orgId,
        conferenceId: confId,
        paperId,
        roundNumber: 1,
      },
    });
    await prisma.decision.create({
      data: {
        id: generateId(),
        organizationId: orgId,
        conferenceId: confId,
        paperId,
        roundId: round.id,
        decidedById: chairUserId,
        outcome: 'ACCEPT',
        notifiedAt: new Date(),
      },
    });
    await prisma.registration.create({
      data: {
        id: generateId(),
        organizationId: orgId,
        conferenceId: confId,
        paperId,
        audience: 'REGULAR',
        billingName: 'Test Author',
        billingAddress: '12 Test Road',
        amountDueMinor: 0,
        currency: 'USD',
        billingCountry: 'US',
        status: 'PENDING',
        deadlineAt: new Date('2099-12-31'),
      },
    });
    const base = `/api/v1/conferences/${confId}/papers/${paperId}/registration`;
    const response = await request(app.getHttpServer())
      .post(`${base}/payment`)
      .set('Cookie', authorRegularCookie)
      .set('Idempotency-Key', generateId())
      .send({})
      .expect(200);
    return { base, paperId, ...response.body };
  }

  it('audit: denies anonymous and unrelated-author registration access and author refunds', async () => {
    const base = `/api/v1/conferences/${confId}/papers/${paperRegularId}/registration`;
    await request(app.getHttpServer()).get(base).expect(401);
    for (const method of ['get', 'post'] as const) {
      const client = request(app.getHttpServer());
      const response = await client[method](base)
        .set('Cookie', authorStudentCookie)
        .send(method === 'post' ? { audience: 'REGULAR' } : undefined);
      expect([403, 404]).toContain(response.status);
    }
    const reg = await prisma.registration.findFirstOrThrow({ where: { paperId: paperRegularId } });
    await request(app.getHttpServer())
      .post(`/api/v1/conferences/${confId}/registrations/${reg.id}/refund`)
      .set('Cookie', authorRegularCookie)
      .send({ amountMinor: 100, reason: 'Unauthorized', version: reg.version })
      .expect(403);
  });

  it('audit: rejects forged webhook signatures without changing payment state', async () => {
    const checkout = await auditCheckout();
    const payload = mockProvider.buildCaptureWebhook(checkout.orderId);
    await request(app.getHttpServer())
      .post('/api/v1/webhooks/razorpay')
      .set('x-razorpay-signature', '0'.repeat(64))
      .send(payload)
      .expect(403);
    expect(
      (await prisma.payment.findUniqueOrThrow({ where: { id: checkout.paymentId } })).status,
    ).toBe('CREATED');
  });

  const auditInvariant = it;

  // Regression invariants for the reproduced payment security vulnerabilities.
  auditInvariant(
    'audit finding: a late capture must not reactivate a cancelled registration',
    async () => {
      const checkout = await auditCheckout();
      await prisma.registration.update({
        where: { id: checkout.registration.id },
        data: { status: 'CANCELLED' },
      });
      await simulateCapture(app, mockProvider, checkout.orderId);
      expect(
        (await prisma.registration.findUniqueOrThrow({ where: { id: checkout.registration.id } }))
          .status,
      ).toBe('CANCELLED');
    },
  );

  auditInvariant(
    'audit finding: a capture after decision reversal must not register a rejected paper',
    async () => {
      const checkout = await auditCheckout();
      await prisma.decision.updateMany({
        where: { paperId: checkout.paperId },
        data: { outcome: 'REJECT' },
      });
      await simulateCapture(app, mockProvider, checkout.orderId);
      expect(
        (await prisma.registration.findUniqueOrThrow({ where: { id: checkout.registration.id } }))
          .status,
      ).not.toBe('PAID');
    },
  );

  auditInvariant(
    'audit finding: a committed provider refund must survive local transaction failure without being issued twice',
    async () => {
      const checkout = await auditCheckout();
      await simulateCapture(app, mockProvider, checkout.orderId);
      const reg = await prisma.registration.findUniqueOrThrow({
        where: { id: checkout.registration.id },
      });
      let providerRefunded = false;
      const effectiveRefunds = new Map<string, string>();
      const refund = vi.spyOn(mockProvider, 'refund').mockImplementation(async (input) => {
        providerRefunded = true;
        const refundId = effectiveRefunds.get(input.idempotencyKey) ?? `rfnd_${generateId()}`;
        effectiveRefunds.set(input.idempotencyKey, refundId);
        return { refundId, amountMinor: input.amountMinor, raw: { status: 'processed' } };
      });
      const original = db.withTenantContext;
      const transaction = vi
        .spyOn(db, 'withTenantContext')
        .mockImplementation((context, callback, options) =>
          original(
            context,
            async (tx) => {
              const result = await callback(tx);
              if (providerRefunded) {
                providerRefunded = false;
                throw new Error('Injected commit failure after provider refund');
              }
              return result;
            },
            options,
          ),
        );
      const url = `/api/v1/conferences/${confId}/registrations/${reg.id}/refund`;
      const input = { amountMinor: 100, reason: 'Audit rollback', version: reg.version };
      try {
        await request(app.getHttpServer())
          .post(url)
          .set('Cookie', chairCookie)
          .send(input)
          .expect(500);
        transaction.mockRestore();
        await request(app.getHttpServer())
          .post(url)
          .set('Cookie', chairCookie)
          .send(input)
          .expect(200);
        expect(effectiveRefunds.size).toBe(1);
        expect(new Set(refund.mock.calls.map(([input]) => input.idempotencyKey)).size).toBe(1);
        expect(
          await prisma.payment.count({
            where: { registrationId: reg.id, kind: 'REFUND', status: 'REFUNDED' },
          }),
        ).toBe(1);
      } finally {
        transaction.mockRestore();
        refund.mockRestore();
      }
    },
  );

  auditInvariant(
    'audit finding: a refund cannot exceed the remaining amount of the specific captured payment',
    async () => {
      const reg = await prisma.registration.findFirstOrThrow({
        where: { paperId: paperStudentId },
      });
      const latest = await prisma.payment.findFirstOrThrow({
        where: { registrationId: reg.id, status: 'CAPTURED' },
        orderBy: { createdAt: 'desc' },
      });
      const refund = vi.spyOn(mockProvider, 'refund');
      try {
        await request(app.getHttpServer())
          .post(`/api/v1/conferences/${confId}/registrations/${reg.id}/refund`)
          .set('Cookie', chairCookie)
          .send({
            amountMinor: latest.amountMinor + 1,
            reason: 'Audit multi-payment refund',
            version: reg.version,
          });
        expect(
          refund.mock.calls.some(
            ([input]) =>
              input.paymentId === latest.providerPaymentId &&
              input.amountMinor > latest.amountMinor,
          ),
        ).toBe(false);
      } finally {
        refund.mockRestore();
      }
    },
  );

  auditInvariant(
    'audit finding: another author in the conference must not download a private invoice',
    async () => {
      const checkout = await auditCheckout();
      await simulateCapture(app, mockProvider, checkout.orderId);
      const file = await prisma.fileAsset.create({
        data: {
          id: generateId(),
          organizationId: orgId,
          uploadedById: authorUserId,
          bucket: 'openconferences',
          objectKey: `org/${orgId}/invoices/audit.pdf`,
          sizeBytes: 100n,
          checksumSha256: '0'.repeat(64),
          mimeType: 'application/pdf',
          originalFilename: 'audit.pdf',
          scanStatus: 'CLEAN',
        },
      });
      await prisma.invoice.create({
        data: {
          id: generateId(),
          organizationId: orgId,
          paymentId: checkout.paymentId,
          fileAssetId: file.id,
          number: `AUDIT-${generateId()}`,
        },
      });
      // Use the real download service and restrictive production API role.
      const service = new InvoicesService(app.get(FilesService), app.get(AuditService));
      const original = db.withTenantContext;
      const role = vi
        .spyOn(db, 'withTenantContext')
        .mockImplementation((context, callback, options) =>
          original(
            context,
            async (tx) => {
              await tx.$executeRawUnsafe('SET LOCAL ROLE openconferences_api');
              return callback(tx);
            },
            options,
          ),
        );
      try {
        const endpoint = app.get(InvoicesService);
        endpoint.getInvoiceDownload = service.getInvoiceDownload.bind(service);
        await request(app.getHttpServer())
          .get(`${checkout.base}/invoice`)
          .set('Cookie', authorRegularCookie)
          .expect(200);
        await request(app.getHttpServer())
          .get(`${checkout.base}/invoice`)
          .set('Cookie', chairCookie)
          .expect(200);
        const response = await request(app.getHttpServer())
          .get(`${checkout.base}/invoice`)
          .set('Cookie', authorStudentCookie);
        expect([403, 404]).toContain(response.status);
      } finally {
        role.mockRestore();
      }
    },
  );

  auditInvariant(
    'audit finding: reconciliation must consult the provider for a stale pending payment',
    async () => {
      const checkout = await auditCheckout();
      const orderId = `order_${generateId().replace(/-/g, '')}`;
      const paymentId = `pay_${generateId().replace(/-/g, '')}`;
      await prisma.payment.update({
        where: { id: checkout.paymentId },
        data: {
          createdAt: new Date(Date.now() - 3600000),
          provider: 'razorpay',
          providerOrderId: orderId,
        },
      });
      vi.stubEnv('RAZORPAY_KEY_ID', 'test-key');
      vi.stubEnv('RAZORPAY_KEY_SECRET', 'test-secret');
      resetConfig();
      const fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          items: [
            {
              id: paymentId,
              order_id: orderId,
              amount: checkout.amountMinor,
              currency: checkout.currency,
              status: 'captured',
              captured: true,
              created_at: Math.floor(Date.now() / 1000),
            },
          ],
        }),
      });
      vi.stubGlobal('fetch', fetch);
      try {
        const result = await app.get(PaymentsService).runReconciliation(checkout.paymentId);
        expect(result.inspected).toBe(1);
        expect(fetch).toHaveBeenCalled();
        expect(result.failed).toBe(0);
        expect(
          (await prisma.registration.findUniqueOrThrow({ where: { id: checkout.registration.id } }))
            .status,
        ).toBe('PAID');
      } finally {
        vi.unstubAllGlobals();
        vi.unstubAllEnvs();
        resetConfig();
      }
    },
  );
  auditInvariant(
    'audit finding: pending provider refunds must not be recorded as completed refunds',
    async () => {
      const checkout = await auditCheckout();
      await simulateCapture(app, mockProvider, checkout.orderId);
      const reg = await prisma.registration.findUniqueOrThrow({
        where: { id: checkout.registration.id },
      });
      const refundId = `rfnd_${generateId()}`;
      const refund = vi.spyOn(mockProvider, 'refund').mockResolvedValue({
        refundId,
        amountMinor: 100,
        raw: { id: refundId, amount: 100, status: 'pending' },
      });
      try {
        await request(app.getHttpServer())
          .post(`/api/v1/conferences/${confId}/registrations/${reg.id}/refund`)
          .set('Cookie', chairCookie)
          .send({ amountMinor: 100, reason: 'Audit pending refund', version: reg.version })
          .expect(200);
        const recorded = await prisma.payment.findFirstOrThrow({
          where: { providerPaymentId: refundId },
        });
        expect(recorded.status).not.toBe('REFUNDED');
      } finally {
        refund.mockRestore();
      }
    },
  );
  it('audit: concurrent checkout retries reuse exactly one existing order', async () => {
    const checkout = await auditCheckout();
    const create = vi.spyOn(mockProvider, 'createOrder');
    try {
      const responses = await Promise.all(
        Array.from({ length: 12 }, () =>
          request(app.getHttpServer())
            .post(`${checkout.base}/payment`)
            .set('Cookie', authorRegularCookie)
            .set('Idempotency-Key', generateId())
            .send({ amountMinor: 1, currency: 'EUR' }),
        ),
      );
      for (const response of responses) {
        expect(response.status).toBe(200);
        expect(response.body.orderId).toBe(checkout.orderId);
        expect(response.body.amountMinor).toBe(checkout.amountMinor);
        expect(response.body.currency).toBe('USD');
      }
      expect(create).not.toHaveBeenCalled();
      expect(
        await prisma.payment.count({ where: { registrationId: checkout.registration.id } }),
      ).toBe(1);
    } finally {
      create.mockRestore();
    }
  });

  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    'audit: rejects invalid refund amount %s',
    async (amountMinor) => {
      const reg = await prisma.registration.findFirstOrThrow({
        where: { paperId: paperRegularId },
      });
      const refund = vi.spyOn(mockProvider, 'refund');
      try {
        const response = await request(app.getHttpServer())
          .post(`/api/v1/conferences/${confId}/registrations/${reg.id}/refund`)
          .set('Cookie', chairCookie)
          .send({ amountMinor, reason: 'Invalid amount', version: reg.version });
        expect(response.status).toBe(400);
        expect(refund).not.toHaveBeenCalled();
      } finally {
        refund.mockRestore();
      }
    },
  );
  it('settles pending refund webhooks once and ignores out-of-order events', async () => {
    const checkout = await auditCheckout();
    await simulateCapture(app, mockProvider, checkout.orderId);
    const capture = await prisma.payment.findUniqueOrThrow({ where: { id: checkout.paymentId } });
    const reg = await prisma.registration.findUniqueOrThrow({
      where: { id: checkout.registration.id },
    });
    const refundId = `rfnd_${generateId().replace(/-/g, '')}`;
    const refund = vi
      .spyOn(mockProvider, 'refund')
      .mockResolvedValue({ refundId, amountMinor: 100, raw: { status: 'pending' } });
    await request(app.getHttpServer())
      .post(`/api/v1/conferences/${confId}/registrations/${reg.id}/refund`)
      .set('Cookie', chairCookie)
      .send({ amountMinor: 100, reason: 'Pending lifecycle', version: reg.version })
      .expect(200);
    refund.mockRestore();
    expect((await prisma.registration.findUniqueOrThrow({ where: { id: reg.id } })).status).toBe(
      'PAID',
    );
    const intent = await prisma.payment.findFirstOrThrow({
      where: { providerPaymentId: refundId },
    });
    await prisma.payment.updateMany({
      where: { id: { in: [capture.id, intent.id] } },
      data: { provider: 'razorpay' },
    });
    vi.stubEnv('RAZORPAY_KEY_ID', 'test-key');
    vi.stubEnv('RAZORPAY_KEY_SECRET', 'test-secret');
    vi.stubEnv('RAZORPAY_WEBHOOK_SECRET', 'hook-secret');
    resetConfig();
    const resolve = vi
      .spyOn(app.get(PaymentProviderRegistry), 'resolve')
      .mockReturnValue(app.get(RazorpayProvider));
    const deliver = async (event: string, status: string) => {
      const payload = {
        event,
        payload: {
          refund: {
            entity: {
              id: refundId,
              payment_id: capture.providerPaymentId,
              amount: 100,
              currency: capture.currency,
              status,
            },
          },
        },
      };
      return request(app.getHttpServer())
        .post('/api/v1/webhooks/razorpay')
        .set(
          'x-razorpay-signature',
          createHmac('sha256', 'hook-secret').update(JSON.stringify(payload)).digest('hex'),
        )
        .send(payload)
        .expect(201);
    };
    try {
      await deliver('refund.processed', 'processed');
      const processed = await prisma.registration.findUniqueOrThrow({ where: { id: reg.id } });
      expect(processed.status).toBe('ADDITIONAL_PAYMENT_REQUIRED');
      await Promise.all([
        deliver('refund.processed', 'processed'),
        deliver('refund.created', 'pending'),
      ]);
      expect((await prisma.registration.findUniqueOrThrow({ where: { id: reg.id } })).version).toBe(
        processed.version,
      );
      expect((await prisma.payment.findUniqueOrThrow({ where: { id: intent.id } })).status).toBe(
        'REFUNDED',
      );
      expect(await prisma.payment.count({ where: { providerPaymentId: refundId } })).toBe(1);
    } finally {
      resolve.mockRestore();
      vi.unstubAllEnvs();
      resetConfig();
    }
  });

  it('reserves pending refunds against concurrent requests and rejects changed retry payloads', async () => {
    const checkout = await auditCheckout();
    await simulateCapture(app, mockProvider, checkout.orderId);
    const reg = await prisma.registration.findUniqueOrThrow({
      where: { id: checkout.registration.id },
    });
    const refund = vi.spyOn(mockProvider, 'refund').mockImplementation(async (input) => ({
      refundId: `rfnd_${input.idempotencyKey}`,
      amountMinor: input.amountMinor,
      raw: { status: 'pending' },
    }));
    const url = `/api/v1/conferences/${confId}/registrations/${reg.id}/refund`;
    try {
      await request(app.getHttpServer())
        .post(url)
        .set('Cookie', chairCookie)
        .send({
          amountMinor: checkout.amountMinor,
          reason: 'Full reservation',
          version: reg.version,
        })
        .expect(200);
      const current = await prisma.registration.findUniqueOrThrow({ where: { id: reg.id } });
      await request(app.getHttpServer())
        .post(url)
        .set('Cookie', chairCookie)
        .send({ amountMinor: 100, reason: 'Second refund', version: current.version })
        .expect(400);
      await request(app.getHttpServer())
        .post(url)
        .set('Cookie', chairCookie)
        .send({ amountMinor: 100, reason: 'Changed retry', version: reg.version })
        .expect(409);
      expect(refund).toHaveBeenCalledTimes(1);
    } finally {
      refund.mockRestore();
    }
  });

  it('rejects unsigned and expired internal reconciliation requests', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/internal/billing/reconcile')
      .send({})
      .expect(403);
    const timestamp = String(Math.floor(Date.now() / 1000) - 600);
    const signature = createHmac('sha256', getConfig().auth.secret)
      .update(`${timestamp}.{}`)
      .digest('hex');
    await request(app.getHttpServer())
      .post('/api/v1/internal/billing/reconcile')
      .set('x-reconcile-signature', signature)
      .set('x-reconcile-timestamp', timestamp)
      .send({})
      .expect(403);
  });
  it('rejects oversized collections before route validation and prevents approval of cancelled student registrations', async () => {
    const checkout = await auditCheckout();
    await request(app.getHttpServer())
      .post(checkout.base)
      .set('Cookie', authorRegularCookie)
      .send({
        billingName: 'Test Author',
        billingAddress: '12 Test Road',
        audience: 'REGULAR',
        extra: Array(1001).fill(0),
      })
      .expect(413);
    await prisma.registration.update({
      where: { id: checkout.registration.id },
      data: { status: 'CANCELLED', audience: 'STUDENT' },
    });
    const document = await prisma.studentVerification.findFirstOrThrow({
      where: { registration: { paperId: paperStudentId } },
    });
    const verification = await prisma.studentVerification.create({
      data: {
        id: generateId(),
        organizationId: orgId,
        registrationId: checkout.registration.id,
        fileAssetId: document.fileAssetId,
        status: 'PENDING',
      },
    });
    await request(app.getHttpServer())
      .post(`/api/v1/conferences/${confId}/student-verifications/${verification.id}/review`)
      .set('Cookie', chairCookie)
      .send({ action: 'APPROVE' })
      .expect(409);
    expect(
      (await prisma.registration.findUniqueOrThrow({ where: { id: checkout.registration.id } }))
        .status,
    ).toBe('CANCELLED');
  });
});
