import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  PrismaClient,
  withTenantContext,
  type Prisma,
  type PaperStatus,
} from '@openconferences/db';
import { conferenceAnalyticsOverviewSchema } from '@openconferences/schemas';
import { AnalyticsService } from './analytics.service';
const runtime = vi.hoisted(() => ({ db: null as PrismaClient | null }));
vi.mock('@openconferences/db', async (original) => ({
  ...(await original<typeof import('@openconferences/db')>()),
  withTenantContext: async (
    ctx: { userId: string; conferenceId: string; organizationId: string },
    fn: (tx: Prisma.TransactionClient) => Promise<unknown>,
    options: object = {},
  ) =>
    runtime.db!.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe('SET LOCAL ROLE openconferences_api');
        await tx.$queryRaw`SELECT set_config('app.current_user_id',${ctx.userId},true),set_config('app.current_conference_id',${ctx.conferenceId},true),set_config('app.current_org_id',${ctx.organizationId},true)`;
        return fn(tx);
      },
      { timeout: 15000, ...options },
    ),
}));
const url = process.env.ANALYTICS_TEST_DATABASE_URL;
if (url) {
  const parsed = new URL(url);
  if (
    !['127.0.0.1', 'localhost'].includes(parsed.hostname) ||
    parsed.pathname !== '/analytics_test'
  )
    throw new Error('Analytics integration tests require owned local analytics_test database');
}
describe.skipIf(!url)('analytics with real local PostgreSQL and API RLS', () => {
  const db = new PrismaClient({
    datasourceUrl: url ?? 'postgresql://unused@127.0.0.1:1/analytics_test',
  });
  const org = randomUUID(),
    conf = randomUUID(),
    track = randomUUID(),
    chair = randomUUID(),
    reviewer = randomUUID(),
    otherReviewer = randomUUID();
  const ids = new Map<string, string>();
  const service = new AnalyticsService({
    loadConference: () => db.conference.findUniqueOrThrow({ where: { id: conf } }),
  } as never);
  const overview = () => service.getOverview(chair, conf, ['CHAIR']);
  beforeAll(async () => {
    runtime.db = db;
    await db.organization.create({ data: { id: org, name: 'Analytics local fixture', slug: org } });
    await db.conference.create({
      data: {
        id: conf,
        organizationId: org,
        name: 'Analytics local fixture',
        slug: conf,
        status: 'REVIEWING',
        authorJoinToken: randomUUID(),
        feeSchedule: { currency: 'INR' },
      },
    });
    for (const [id, role] of [
      [chair, 'CHAIR'],
      [reviewer, 'REVIEWER'],
      [otherReviewer, 'REVIEWER'],
    ] as const) {
      await db.user.create({
        data: {
          id,
          name: id === chair ? 'Chair' : 'Same reviewer name',
          email: `${id}@example.test`,
        },
      });
      await db.membership.create({
        data: {
          id: randomUUID(),
          organizationId: org,
          conferenceId: conf,
          scope: 'CONFERENCE',
          userId: id,
          roles: { create: { id: randomUUID(), role } },
        },
      });
    }
    await db.track.create({
      data: { id: track, organizationId: org, conferenceId: conf, name: 'Systems', slug: track },
    });
    for (const status of [
      'DRAFT',
      'WITHDRAWN',
      'WITHDRAWN_NONPAYMENT',
      'UNDER_REVIEW',
      'DECISION_MADE',
      'CAMERA_READY',
      'SUBMITTED',
    ] as PaperStatus[]) {
      const paper = randomUUID(),
        round = randomUUID(),
        registration = randomUUID();
      ids.set(status, paper);
      await db.paper.create({
        data: {
          id: paper,
          organizationId: org,
          conferenceId: conf,
          trackId: track,
          submittedById: chair,
          title: 'Same title, distinct paper',
          abstract: 'Synthetic local fixture',
          keywords: [],
          status,
          authorships: {
            create: {
              id: randomUUID(),
              fullName: 'Corresponding Author',
              email: 'author@example.test',
              affiliation: 'Institute',
              isCorresponding: true,
              order: 0,
            },
          },
        },
      });
      await db.reviewRound.create({
        data: {
          id: round,
          organizationId: org,
          conferenceId: conf,
          paperId: paper,
          roundNumber: 2,
        },
      });
      const a = randomUUID();
      await db.reviewerAssignment.create({
        data: {
          id: a,
          organizationId: org,
          conferenceId: conf,
          paperId: paper,
          roundId: round,
          reviewerUserId: reviewer,
          dueAt: new Date('2000-01-01'),
        },
      });
      if (
        status === 'DECISION_MADE' ||
        status === 'CAMERA_READY' ||
        status.startsWith('WITHDRAWN') ||
        status === 'DRAFT'
      )
        await db.decision.create({
          data: {
            id: randomUUID(),
            organizationId: org,
            conferenceId: conf,
            paperId: paper,
            roundId: round,
            decidedById: chair,
            outcome: status === 'DECISION_MADE' ? 'REJECT' : 'ACCEPT',
          },
        });
      if (status === 'UNDER_REVIEW') {
        const old = randomUUID();
        await db.reviewRound.create({
          data: {
            id: old,
            organizationId: org,
            conferenceId: conf,
            paperId: paper,
            roundNumber: 1,
          },
        });
        await db.decision.create({
          data: {
            id: randomUUID(),
            organizationId: org,
            conferenceId: conf,
            paperId: paper,
            roundId: old,
            decidedById: chair,
            outcome: 'ACCEPT',
          },
        });
        await db.reviewerAssignment.create({
          data: {
            id: randomUUID(),
            organizationId: org,
            conferenceId: conf,
            paperId: paper,
            roundId: old,
            reviewerUserId: reviewer,
            status: 'COMPLETED',
          },
        });
        await db.reviewerAssignment.create({
          data: {
            id: randomUUID(),
            organizationId: org,
            conferenceId: conf,
            paperId: paper,
            roundId: round,
            reviewerUserId: otherReviewer,
            dueAt: new Date('2000-01-01'),
          },
        });
        await db.review.create({
          data: {
            id: randomUUID(),
            organizationId: org,
            conferenceId: conf,
            paperId: paper,
            roundId: round,
            assignmentId: a,
            reviewerUserId: reviewer,
            submittedAt: new Date(),
            scores: {},
            pendingEdit: { private: 'not read by analytics' },
          },
        });
      }
      await db.registration.create({
        data: {
          id: registration,
          organizationId: org,
          conferenceId: conf,
          paperId: paper,
          audience: 'REGULAR',
          currency: 'INR',
          status:
            status === 'CAMERA_READY'
              ? 'PAID'
              : status === 'DECISION_MADE'
                ? 'CANCELLED'
                : 'PENDING',
          deadlineAt: new Date('2000-01-01'),
        },
      });
      if (status === 'WITHDRAWN')
        await db.payment.createMany({
          data: [
            {
              id: randomUUID(),
              organizationId: org,
              registrationId: registration,
              provider: 'local-fixture',
              status: 'CAPTURED',
              kind: 'INITIAL',
              amountMinor: 10000,
              currency: 'INR',
            },
            {
              id: randomUUID(),
              organizationId: org,
              registrationId: registration,
              provider: 'local-fixture',
              status: 'REFUNDED',
              kind: 'REFUND',
              amountMinor: 2000,
              currency: 'INR',
            },
            {
              id: randomUUID(),
              organizationId: org,
              registrationId: registration,
              provider: 'local-fixture',
              status: 'CAPTURED',
              kind: 'INITIAL',
              amountMinor: 4000,
              currency: 'USD',
            },
          ],
        });
    }
  });
  afterAll(async () => {
    await db.payment.deleteMany({ where: { organizationId: org } });
    await db.registration.deleteMany({ where: { conferenceId: conf } });
    await db.review.deleteMany({ where: { conferenceId: conf } });
    await db.decision.deleteMany({ where: { conferenceId: conf } });
    await db.reviewerAssignment.deleteMany({ where: { conferenceId: conf } });
    await db.reviewRound.deleteMany({ where: { conferenceId: conf } });
    await db.paper.deleteMany({ where: { conferenceId: conf } });
    await db.track.deleteMany({ where: { conferenceId: conf } });
    await db.membership.deleteMany({ where: { conferenceId: conf } });
    await db.conference.deleteMany({ where: { id: conf } });
    await db.user.deleteMany({ where: { id: { in: [chair, reviewer, otherReviewer] } } });
    await db.organization.deleteMany({ where: { id: org } });
    await db.$disconnect();
    runtime.db = null;
  });
  it('excludes drafts and both withdrawals consistently and counts distinct identical-title papers', async () => {
    const data = await overview();
    expect(conferenceAnalyticsOverviewSchema.safeParse(data).success).toBe(true);
    expect(data.submissions).toMatchObject({ total: 4, excluded: { draft: 1, withdrawn: 2 } });
    expect(data.submissions.byDay.reduce((n, d) => n + d.count, 0)).toBe(4);
    expect(data.authors).toEqual([{ name: 'Corresponding Author', count: 4 }]);
    expect(data.institutions).toEqual([{ name: 'Institute', count: 4 }]);
  });
  it('uses only the latest cycle, submittedAt and reviewer identities', async () => {
    const data = await overview();
    expect(data.reviews).toMatchObject({
      assigned: 5,
      submitted: 1,
      completed: 1,
      notStarted: 2,
      overdue: 2,
      closedIncomplete: 2,
    });
    expect(data.reviews.reviewerLoad).toHaveLength(2);
    expect(data.decisions).toMatchObject({ total: 2, acceptRate: 0.5 });
    expect(data.unpaidAccepted).toBe(0);
  });
  it('excludes hidden-paper registrations and cancelled unpaid work, but retains real money', async () => {
    const data = await overview();
    expect(data.registrations).toMatchObject({
      total: 4,
      paid: 1,
      unpaid: 2,
      overdue: 2,
      atRisk: 0,
    });
    expect(data.revenueMinor).toBe(8000);
    expect(data.excludedCurrencyPayments).toBe(1);
    expect(data.revenueByTiming).toEqual([{ name: 'UNSPECIFIED', amountMinor: 8000 }]);
  });
  it('denies participant roles and isolates another conference through RLS', async () => {
    await expect(service.getOverview(reviewer, conf, ['REVIEWER'])).rejects.toThrow(
      'Insufficient permissions',
    );
    const rows = await withTenantContext(
      { userId: reviewer, conferenceId: randomUUID(), organizationId: org },
      (tx) => tx.paper.findMany({ where: { conferenceId: conf } }),
    );
    expect(rows).toEqual([]);
  });
});
