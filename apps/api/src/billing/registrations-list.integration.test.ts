import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { PrismaClient, type Prisma } from '@openconferences/db';
import { assertLocalDatabaseUrl } from '../../../../infra/testing/local-test-target.mjs';
import { RegistrationsService } from './registrations.service';
import { StudentVerificationService } from './student-verification.service';

const runtime = vi.hoisted(() => ({ client: null as PrismaClient | null }));
vi.mock('@openconferences/db', async (original) => {
  const actual = await original<typeof import('@openconferences/db')>();
  return {
    ...actual,
    // Same tenant context as production: restricted API role with RLS settings.
    withTenantContext: async (
      ctx: { userId: string; conferenceId: string; organizationId?: string },
      callback: (tx: Prisma.TransactionClient) => Promise<unknown>,
    ) => {
      if (!runtime.client) throw new Error('Test database not initialized');
      return runtime.client.$transaction(
        async (tx) => {
          await tx.$executeRawUnsafe('SET LOCAL ROLE openconferences_api');
          await tx.$queryRaw`SELECT set_config('app.current_user_id', ${ctx.userId}, true), set_config('app.current_conference_id', ${ctx.conferenceId}, true), set_config('app.current_org_id', ${ctx.organizationId ?? ''}, true)`;
          return callback(tx);
        },
        { timeout: 10000 },
      );
    },
  };
});

// Explicit opt-in only, and only a loopback *_test database. Never the app DATABASE_URL.
const url = process.env.REGISTRATIONS_TEST_DATABASE_URL;
if (url) assertLocalDatabaseUrl(url);

const DAY = 86_400_000;

describe.skipIf(!url)('registration list and student verification in real PostgreSQL', () => {
  const db = new PrismaClient({
    datasourceUrl: url ?? 'postgresql://unused@127.0.0.1:1/unused_test',
  });
  const orgId = randomUUID();
  const conferenceId = randomUUID();
  const otherConferenceId = randomUUID();
  const chairId = randomUUID();
  const authorId = randomUUID();
  const trackId = randomUUID();
  const otherTrackId = randomUUID();
  const fileAssetId = randomUUID();
  const verificationId = randomUUID();
  const tag = randomUUID().slice(0, 8).toUpperCase();
  const now = Date.now();

  // One row per case the list has to tell apart.
  const fixtures = [
    {
      key: 'paid',
      title: 'Graph neural routing',
      status: 'PAID',
      audience: 'REGULAR',
      deadline: now - 20 * DAY,
      billingName: 'Asha Rao',
      billingEmail: 'asha@example.test',
    },
    {
      key: 'overdue',
      title: 'Overdue consensus protocols',
      status: 'PENDING',
      audience: 'REGULAR',
      deadline: now - 2 * DAY,
      billingName: 'Bola Ade',
      billingEmail: 'bola.ade@example.test',
    },
    {
      key: 'dueSoon',
      title: 'Soon-due storage engines',
      status: 'PENDING',
      audience: 'REGULAR',
      deadline: now + 3 * DAY,
      billingName: null,
      billingEmail: null,
    },
    {
      key: 'student',
      title: 'Student verification pending',
      status: 'AWAITING_VERIFICATION',
      audience: 'STUDENT',
      deadline: now + 30 * DAY,
      billingName: 'Chen Li',
      billingEmail: 'chen@example.test',
    },
    {
      key: 'cancelled',
      title: 'Cancelled graph study',
      status: 'CANCELLED',
      audience: 'REGULAR',
      deadline: now - 10 * DAY,
      billingName: null,
      billingEmail: null,
    },
    {
      key: 'additional',
      title: 'Additional payment needed',
      status: 'ADDITIONAL_PAYMENT_REQUIRED',
      audience: 'REGULAR',
      deadline: now + 5 * DAY,
      billingName: null,
      billingEmail: null,
    },
  ].map((row, index) => ({
    ...row,
    id: randomUUID(),
    paperId: randomUUID(),
    code: `${tag}-${index + 1}`,
  }));
  const byKey = Object.fromEntries(fixtures.map((row) => [row.key, row]));
  const foreign = { id: randomUUID(), paperId: randomUUID() };

  const audit = vi.fn();
  const conferences = {
    loadConference: async () => ({
      organizationId: orgId,
      name: 'Registration test',
      feeSchedule: {
        currency: 'USD',
        matrix: { REGULAR: { EARLY: 100, REGULAR: 200 }, STUDENT: { EARLY: 50, REGULAR: 100 } },
      },
    }),
  };
  const registrations = new RegistrationsService(
    conferences as never,
    {} as never,
    { log: audit } as never,
  );
  // Every publish call is accepted and recorded, so a test can read what would be emailed.
  const published: Array<{ method: string; payload: Record<string, unknown> }> = [];
  const notifications = new Proxy(
    {},
    {
      get: (_target, method) => async (payload: Record<string, unknown>) => {
        published.push({ method: String(method), payload });
      },
    },
  );
  const verifications = new StudentVerificationService(
    conferences as never,
    {} as never,
    registrations,
    {} as never,
    { log: audit } as never,
    notifications as never,
  );

  const list = (options: Parameters<RegistrationsService['listRegistrations']>[3] = {}) =>
    registrations.listRegistrations(chairId, conferenceId, ['CHAIR'], options);
  const keys = (result: { data: Array<{ id: string }> }) =>
    result.data.map((row) => fixtures.find((fixture) => fixture.id === row.id)?.key).sort();

  beforeAll(async () => {
    runtime.client = db;
    await db.$transaction(async (tx) => {
      await tx.organization.create({ data: { id: orgId, name: 'Registration test', slug: orgId } });
      for (const [id, track] of [
        [conferenceId, trackId],
        [otherConferenceId, otherTrackId],
      ] as const) {
        await tx.conference.create({
          data: {
            id,
            organizationId: orgId,
            name: 'Registration test',
            slug: id,
            authorJoinToken: randomUUID(),
          },
        });
        await tx.track.create({
          data: { id: track, organizationId: orgId, conferenceId: id, name: 'Track', slug: track },
        });
      }
      for (const [id, name, role] of [
        [chairId, 'Test Chair', 'CHAIR'],
        [authorId, 'Test Author', 'AUTHOR'],
      ] as const) {
        await tx.user.create({ data: { id, name, email: `${id}@example.test` } });
        const membershipId = randomUUID();
        await tx.membership.create({
          data: {
            id: membershipId,
            userId: id,
            organizationId: orgId,
            conferenceId,
            scope: 'CONFERENCE',
          },
        });
        await tx.roleGrant.create({ data: { id: randomUUID(), membershipId, role } });
      }
      const paper = (id: string, conference: string, track: string, title: string, code: string) =>
        tx.paper.create({
          data: {
            id,
            organizationId: orgId,
            conferenceId: conference,
            trackId: track,
            submittedById: authorId,
            title,
            abstract: 'Abstract',
            keywords: [],
            submissionNumber: code,
            status: 'DECISION_MADE',
          },
        });
      // Distinct creation times make the newest-first order deterministic.
      for (const [index, row] of fixtures.entries()) {
        await paper(row.paperId, conferenceId, trackId, row.title, row.code);
        await tx.registration.create({
          data: {
            id: row.id,
            organizationId: orgId,
            conferenceId,
            paperId: row.paperId,
            userId: authorId,
            audience: row.audience as 'REGULAR' | 'STUDENT',
            status: row.status as 'PENDING',
            amountDueMinor: 20000,
            currency: 'USD',
            deadlineAt: new Date(row.deadline),
            billingName: row.billingName,
            billingEmail: row.billingEmail,
            createdAt: new Date(now - index * 60_000),
          },
        });
      }
      // Same organization, different conference: must never appear in this list.
      await paper(foreign.paperId, otherConferenceId, otherTrackId, 'Graph elsewhere', `${tag}-X`);
      await tx.registration.create({
        data: {
          id: foreign.id,
          organizationId: orgId,
          conferenceId: otherConferenceId,
          paperId: foreign.paperId,
          userId: authorId,
          audience: 'REGULAR',
          status: 'PENDING',
          amountDueMinor: 20000,
          currency: 'USD',
          deadlineAt: new Date(now - DAY),
        },
      });
      await tx.fileAsset.create({
        data: {
          id: fileAssetId,
          organizationId: orgId,
          uploadedById: authorId,
          bucket: 'test',
          objectKey: `student/${fileAssetId}.pdf`,
          sizeBytes: 1024n,
          checksumSha256: 'a'.repeat(64),
          mimeType: 'application/pdf',
          originalFilename: 'student-id.pdf',
          scanStatus: 'CLEAN',
        },
      });
      await tx.studentVerification.create({
        data: {
          id: verificationId,
          organizationId: orgId,
          registrationId: byKey.student!.id,
          fileAssetId,
        },
      });
    });
  });

  afterAll(async () => {
    try {
      const conferenceIds = [conferenceId, otherConferenceId];
      await db.$transaction(async (tx) => {
        await tx.studentVerification.deleteMany({ where: { organizationId: orgId } });
        await tx.fileAsset.deleteMany({ where: { id: fileAssetId } });
        await tx.payment.deleteMany({ where: { organizationId: orgId } });
        await tx.registration.deleteMany({ where: { conferenceId: { in: conferenceIds } } });
        await tx.paper.deleteMany({ where: { conferenceId: { in: conferenceIds } } });
        await tx.track.deleteMany({ where: { conferenceId: { in: conferenceIds } } });
        await tx.membership.deleteMany({ where: { conferenceId } });
        await tx.conference.deleteMany({ where: { id: { in: conferenceIds } } });
        await tx.user.deleteMany({ where: { id: { in: [chairId, authorId] } } });
        await tx.organization.deleteMany({ where: { id: orgId } });
      });
    } finally {
      await db.$disconnect();
    }
  });

  it('lists only this conference, newest first, with paper code and summary counts', async () => {
    const result = await list();
    expect(result.data.map((row) => row.id)).toEqual(fixtures.map((row) => row.id));
    expect(result.data.every((row) => row.conferenceId === conferenceId)).toBe(true);
    expect(result.data[0]).toMatchObject({
      paperTitle: 'Graph neural routing',
      submissionNumber: `${tag}-1`,
      billingName: 'Asha Rao',
    });
    expect(result.summary).toEqual({
      total: 6,
      paid: 1,
      awaitingVerification: 1,
      unpaid: 3,
      overdue: 1,
      atRisk: 2,
    });
  });

  it('groups statuses with the same definitions as conference analytics', async () => {
    expect(keys(await list({ status: 'paid' }))).toEqual(['paid']);
    expect(keys(await list({ status: 'unpaid' }))).toEqual(['additional', 'dueSoon', 'overdue']);
    expect(keys(await list({ status: 'AWAITING_VERIFICATION' }))).toEqual(['student']);
    expect(keys(await list({ status: 'overdue' }))).toEqual(['overdue']);
    expect(keys(await list({ status: 'at-risk' }))).toEqual(['additional', 'dueSoon']);
    expect(keys(await list({ status: 'CANCELLED' }))).toEqual(['cancelled']);
    expect(keys(await list({ audience: 'STUDENT' }))).toEqual(['student']);
  });

  it('keeps the summary conference-wide while the list is filtered', async () => {
    const result = await list({ status: 'paid', search: 'graph' });
    expect(keys(result)).toEqual(['paid']);
    expect(result.summary).toEqual({
      total: 6,
      paid: 1,
      awaitingVerification: 1,
      unpaid: 3,
      overdue: 1,
      atRisk: 2,
    });
  });

  it('searches title, paper code, billing name and billing email without case', async () => {
    expect(keys(await list({ search: 'GRAPH' }))).toEqual(['cancelled', 'paid']);
    expect(keys(await list({ search: `${tag.toLowerCase()}-3` }))).toEqual(['dueSoon']);
    expect(keys(await list({ search: 'bola.ade@' }))).toEqual(['overdue']);
    expect(keys(await list({ search: 'chen li' }))).toEqual(['student']);
    expect(keys(await list({ search: '   ' }))).toHaveLength(6);
    expect((await list({ search: 'no such registration' })).data).toEqual([]);
  });

  it('treats search wildcards as literal text', async () => {
    expect((await list({ search: '%' })).data).toEqual([]);
    expect((await list({ search: '_' })).data).toEqual([]);
  });

  it('pages through every row once and sends the summary with the first page only', async () => {
    const first = await list({ limit: 4 });
    expect(first.data).toHaveLength(4);
    expect(first.nextCursor).not.toBeNull();
    expect(first.summary?.total).toBe(6);
    const second = await list({ limit: 4, cursor: first.nextCursor! });
    expect(second.nextCursor).toBeNull();
    expect(second).not.toHaveProperty('summary');
    expect([...first.data, ...second.data].map((row) => row.id)).toEqual(
      fixtures.map((row) => row.id),
    );
  });

  it('is limited to roles that coordinate review', async () => {
    await expect(
      registrations.listRegistrations(authorId, conferenceId, ['AUTHOR']),
    ).rejects.toMatchObject({ status: 403 });
  });

  describe('early-bird extension for selected papers', () => {
    const extend = (registrationIds: string[], earlyBirdEndsAt: string | null) =>
      registrations.extendEarlyBird(chairId, conferenceId, { registrationIds, earlyBirdEndsAt }, [
        'CHAIR',
      ]);
    const stored = (key: string) =>
      db.registration.findUniqueOrThrow({ where: { id: byKey[key]!.id } });
    const until = new Date(now + 5 * DAY).toISOString();

    it('gives unpaid papers their own cut-off and leaves paid or foreign ones alone', async () => {
      const result = await extend(
        [byKey.overdue!.id, byKey.dueSoon!.id, byKey.paid!.id, foreign.id],
        until,
      );
      expect(result.updated.sort()).toEqual([byKey.overdue!.id, byKey.dueSoon!.id].sort());
      expect(result.skipped).toEqual([
        { registrationId: byKey.paid!.id, reason: 'Already paid or no longer payable' },
        { registrationId: foreign.id, reason: 'Registration not found' },
      ]);
      expect((await stored('overdue')).earlyBirdExtendedUntil?.toISOString()).toBe(until);
      expect((await stored('paid')).earlyBirdExtendedUntil).toBeNull();
      expect(
        (await db.registration.findUniqueOrThrow({ where: { id: foreign.id } }))
          .earlyBirdExtendedUntil,
      ).toBeNull();
      const listed = (await list()).data.find((row) => row.id === byKey.overdue!.id);
      expect(listed?.earlyBirdExtendedUntil).toBe(until);
    });

    it('prices the extended paper at the early rate and the others at the regular rate', async () => {
      // The conference here has no early-bird date of its own, so only the extension can apply.
      await db.registration.updateMany({
        where: { id: { in: [byKey.overdue!.id, byKey.additional!.id] } },
        data: { billingCountry: 'US' },
      });
      const schedule = (await conferences.loadConference()).feeSchedule;
      const quote = async (key: string) =>
        registrations.quoteForPayment(authorId, await stored(key), schedule as never);
      expect(await quote('overdue')).toMatchObject({ timing: 'EARLY', amountMinor: 100 });
      expect(await quote('additional')).toMatchObject({ timing: 'REGULAR', amountMinor: 200 });
    });

    it('drops an unpaid checkout that had fixed the regular fee', async () => {
      const paymentId = randomUUID();
      await db.registration.update({
        where: { id: byKey.dueSoon!.id },
        data: { lockedTiming: 'REGULAR', amountDueMinor: 200, regularAmountDueMinor: 200 },
      });
      await db.payment.create({
        data: {
          id: paymentId,
          organizationId: orgId,
          registrationId: byKey.dueSoon!.id,
          provider: 'mock',
          providerOrderId: `order_${tag}`,
          amountMinor: 200,
          currency: 'USD',
          kind: 'INITIAL',
        },
      });
      expect((await extend([byKey.dueSoon!.id], until)).updated).toEqual([byKey.dueSoon!.id]);
      expect(await stored('dueSoon')).toMatchObject({
        lockedTiming: null,
        amountDueMinor: 0,
        regularAmountDueMinor: null,
      });
      expect((await db.payment.findUniqueOrThrow({ where: { id: paymentId } })).status).toBe(
        'FAILED',
      );
    });

    it('removes the extension again', async () => {
      expect((await extend([byKey.overdue!.id], null)).updated).toEqual([byKey.overdue!.id]);
      expect((await stored('overdue')).earlyBirdExtendedUntil).toBeNull();
    });

    it('refuses a date that has passed and anyone who does not coordinate review', async () => {
      await expect(
        extend([byKey.overdue!.id], new Date(now - DAY).toISOString()),
      ).rejects.toMatchObject({ status: 400 });
      await expect(
        registrations.extendEarlyBird(
          authorId,
          conferenceId,
          { registrationIds: [byKey.overdue!.id], earlyBirdEndsAt: until },
          ['AUTHOR'],
        ),
      ).rejects.toMatchObject({ status: 403 });
      expect((await stored('overdue')).earlyBirdExtendedUntil).toBeNull();
    });
  });

  it('lists the verification with the paper it belongs to', async () => {
    const result = await verifications.listPending(chairId, conferenceId, ['CHAIR']);
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      id: verificationId,
      paperId: byKey.student!.paperId,
      submissionNumber: `${tag}-4`,
      paperTitle: 'Student verification pending',
      originalFilename: 'student-id.pdf',
      scanStatus: 'CLEAN',
      status: 'PENDING',
    });
  });

  it('refuses to reject or request clarification without a note and changes nothing', async () => {
    for (const action of ['REJECT', 'CLARIFY'] as const) {
      for (const note of [undefined, '   ']) {
        await expect(
          verifications.review(chairId, conferenceId, verificationId, { action, note }, ['CHAIR']),
        ).rejects.toMatchObject({ status: 400 });
      }
    }
    const verification = await db.studentVerification.findUniqueOrThrow({
      where: { id: verificationId },
    });
    expect(verification).toMatchObject({ status: 'PENDING', note: null, reviewedById: null });
    const registration = await db.registration.findUniqueOrThrow({
      where: { id: byKey.student!.id },
    });
    expect(registration).toMatchObject({ audience: 'STUDENT', version: 0 });
  });

  it('rejects with a reason, moves the registration to the regular rate and records the note', async () => {
    await verifications.review(
      chairId,
      conferenceId,
      verificationId,
      { action: 'REJECT', note: 'The ID has expired.' },
      ['CHAIR'],
    );
    // The author is emailed the reason, as the confirmation dialog promises.
    expect(published.at(-1)).toEqual({
      method: 'publishStudentRateRejected',
      payload: expect.objectContaining({
        paperId: byKey.student!.paperId,
        paperTitle: 'Student verification pending',
        reason: 'The ID has expired.',
        paidInFull: false,
      }),
    });
    const verification = await db.studentVerification.findUniqueOrThrow({
      where: { id: verificationId },
    });
    expect(verification).toMatchObject({
      status: 'REJECTED',
      note: 'The ID has expired.',
      reviewedById: chairId,
    });
    const registration = await db.registration.findUniqueOrThrow({
      where: { id: byKey.student!.id },
    });
    expect(registration.audience).toBe('REGULAR');
    expect(keys(await list({ audience: 'STUDENT' }))).toEqual([]);
  });
});
