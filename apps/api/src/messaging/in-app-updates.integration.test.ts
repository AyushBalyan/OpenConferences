import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { PrismaClient, type Prisma, withTenantContext } from '@openconferences/db';
import { InboxService } from './inbox.service';
const runtime = vi.hoisted(() => ({ db: null as PrismaClient | null }));
vi.mock('@openconferences/db', async (original) => ({
  ...(await original<typeof import('@openconferences/db')>()),
  withTenantContext: (
    ctx: { userId: string; conferenceId: string; organizationId: string },
    fn: (tx: Prisma.TransactionClient) => Promise<unknown>,
  ) =>
    runtime.db!.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET LOCAL ROLE openconferences_api');
      await tx.$queryRaw`SELECT set_config('app.current_user_id',${ctx.userId},true),set_config('app.current_conference_id',${ctx.conferenceId},true),set_config('app.current_org_id',${ctx.organizationId},true)`;
      return fn(tx);
    }),
}));
const url = process.env.IN_APP_UPDATES_TEST_DATABASE_URL;
if (url) {
  const parsed = new URL(url);
  if (
    !['127.0.0.1', 'localhost'].includes(parsed.hostname) ||
    parsed.pathname !== '/in_app_updates_test'
  )
    throw new Error('In-app update tests require owned local in_app_updates_test database');
}
describe.skipIf(!url)('in-app updates with real local PostgreSQL and API RLS', () => {
  const db = new PrismaClient({
    datasourceUrl: url ?? 'postgresql://unused@127.0.0.1:1/in_app_updates_test',
  });
  const org = randomUUID(),
    conf = randomUUID(),
    otherConf = randomUUID(),
    track = randomUUID(),
    paper = randomUUID(),
    round = randomUUID(),
    assignment = randomUUID(),
    review = randomUUID(),
    invitation = randomUUID(),
    declined = randomUUID(),
    rebuttal = randomUUID();
  const chair = randomUUID(),
    organizer = randomUUID(),
    author = randomUUID(),
    reviewer = randomUUID(),
    admin = randomUUID(),
    platform = randomUUID();
  const service = new InboxService();
  const scope = (userId = chair, conferenceId = conf) => ({
    userId,
    conferenceId,
    organizationId: org,
  });
  const list = () => service.list(scope(), 'CONFERENCE', undefined, ['CHAIR']);
  const scoped = (userId: string, fn: (tx: Prisma.TransactionClient) => Promise<unknown>) =>
    withTenantContext(scope(userId), fn);
  beforeAll(async () => {
    runtime.db = db;
    await db.organization.create({
      data: { id: org, name: 'Synthetic updates fixture', slug: org },
    });
    for (const id of [conf, otherConf])
      await db.conference.create({
        data: {
          id,
          organizationId: org,
          name: 'Synthetic conference',
          slug: id,
          status: 'REVIEWING',
          authorJoinToken: randomUUID(),
        },
      });
    for (const [id, role, scopeKind] of [
      [chair, 'CHAIR', 'CONFERENCE'],
      [organizer, 'ORGANIZER', 'CONFERENCE'],
      [author, 'AUTHOR', 'CONFERENCE'],
      [reviewer, 'REVIEWER', 'CONFERENCE'],
      [admin, 'ORG_ADMIN', 'ORGANIZATION'],
      [platform, 'PLATFORM_ADMIN', 'ORGANIZATION'],
    ] as const) {
      await db.user.create({ data: { id, name: role, email: `${id}@example.test` } });
      await db.membership.create({
        data: {
          id: randomUUID(),
          userId: id,
          organizationId: org,
          conferenceId: scopeKind === 'CONFERENCE' ? conf : null,
          scope: scopeKind,
          roles: { create: { id: randomUUID(), role } },
        },
      });
    }
    await db.track.create({
      data: { id: track, organizationId: org, conferenceId: conf, name: 'Systems', slug: track },
    });
    await db.paper.create({
      data: {
        id: paper,
        organizationId: org,
        conferenceId: conf,
        trackId: track,
        submittedById: author,
        title: 'A synthetic manuscript',
        abstract: 'Synthetic local test data',
        keywords: [],
        status: 'DRAFT',
      },
    });
    await db.reviewRound.create({
      data: { id: round, organizationId: org, conferenceId: conf, paperId: paper, roundNumber: 1 },
    });
    await db.reviewerAssignment.create({
      data: {
        id: assignment,
        organizationId: org,
        conferenceId: conf,
        paperId: paper,
        roundId: round,
        reviewerUserId: reviewer,
      },
    });
    await db.review.create({
      data: {
        id: review,
        organizationId: org,
        conferenceId: conf,
        paperId: paper,
        roundId: round,
        assignmentId: assignment,
        reviewerUserId: reviewer,
        commentsToChairs: 'PRIVATE REVIEW TEXT',
      },
    });
    await db.rebuttal.create({
      data: {
        id: rebuttal,
        organizationId: org,
        conferenceId: conf,
        paperId: paper,
        roundId: round,
        authoredByUserId: author,
        body: 'PRIVATE RESPONSE TEXT',
      },
    });
    for (const id of [invitation, declined])
      await db.reviewerInvitation.create({
        data: {
          id,
          organizationId: org,
          conferenceId: conf,
          email: `${reviewer}@example.test`,
          invitedUserId: reviewer,
          token: randomUUID(),
          expiresAt: new Date('2030-01-01'),
        },
      });
  });
  afterAll(async () => {
    if (runtime.db) {
      await db.inboxReadState.deleteMany({ where: { organizationId: org } });
      await db.conferenceUpdate.deleteMany({ where: { organizationId: org } });
      await db.rebuttal.deleteMany({ where: { conferenceId: conf } });
      await db.review.deleteMany({ where: { conferenceId: conf } });
      await db.reviewerAssignment.deleteMany({ where: { conferenceId: conf } });
      await db.reviewRound.deleteMany({ where: { conferenceId: conf } });
      await db.paper.deleteMany({ where: { conferenceId: conf } });
      await db.reviewerInvitation.deleteMany({ where: { conferenceId: conf } });
      await db.track.deleteMany({ where: { conferenceId: conf } });
      await db.roleGrant.deleteMany({ where: { membership: { organizationId: org } } });
      await db.membership.deleteMany({ where: { organizationId: org } });
      await db.conference.deleteMany({ where: { organizationId: org } });
      await db.user.deleteMany({
        where: { id: { in: [chair, organizer, author, reviewer, admin, platform] } },
      });
      await db.organization.delete({ where: { id: org } });
    }
    await db.$disconnect();
  });
  it('ignores drafts and atomically records successful submission without mail jobs', async () => {
    expect((await list()).data).toHaveLength(0);
    const mailBefore = await db.notificationLog.count();
    await scoped(author, (tx) =>
      tx.paper.update({
        where: { id: paper },
        data: { status: 'SUBMITTED', submissionNumber: 'SYS-001', version: { increment: 1 } },
      }),
    );
    const result = await list();
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      title: 'Paper submitted.',
      subject: 'SYS-001 · A synthetic manuscript',
      unread: true,
    });
    expect(await db.notificationLog.count()).toBe(mailBefore);
    await expect(
      scoped(author, async (tx) => {
        await tx.paper.update({
          where: { id: paper },
          data: { status: 'WITHDRAWN', version: { increment: 1 } },
        });
        throw new Error('rollback');
      }),
    ).rejects.toThrow('rollback');
    expect((await list()).data).toHaveLength(1);
    expect((await db.paper.findUniqueOrThrow({ where: { id: paper } })).status).toBe('SUBMITTED');
  });
  it('records invitation responses once, including repeat accept updates', async () => {
    await scoped(organizer, (tx) =>
      tx.reviewerInvitation.update({ where: { id: invitation }, data: { status: 'ACCEPTED' } }),
    );
    await scoped(organizer, (tx) =>
      tx.reviewerInvitation.update({ where: { id: invitation }, data: { status: 'ACCEPTED' } }),
    );
    await scoped(organizer, (tx) =>
      tx.reviewerInvitation.update({ where: { id: declined }, data: { status: 'DECLINED' } }),
    );
    const rows = (await list()).data;
    expect(rows.filter((r) => r.eventType === 'INVITATION_ACCEPTED')).toHaveLength(1);
    expect(rows.some((r) => r.title === 'Reviewer invitation declined.')).toBe(true);
  });
  it('records submitted and republished reviews, never draft edits or private text', async () => {
    await scoped(reviewer, (tx) =>
      tx.review.update({
        where: { id: review },
        data: { commentsToChairs: 'NEW PRIVATE DRAFT', version: { increment: 1 } },
      }),
    );
    expect((await list()).data.filter((r) => r.eventType?.startsWith('REVIEW_'))).toHaveLength(0);
    await scoped(reviewer, (tx) =>
      tx.review.update({
        where: { id: review },
        data: { submittedAt: new Date('2026-10-09T15:00:00Z'), version: { increment: 1 } },
      }),
    );
    await scoped(reviewer, (tx) =>
      tx.review.update({
        where: { id: review },
        data: { pendingEdit: { commentsToChairs: 'PRIVATE PENDING' }, version: { increment: 1 } },
      }),
    );
    expect((await list()).data.filter((r) => r.eventType === 'REVIEW_UPDATED')).toHaveLength(0);
    await scoped(reviewer, (tx) =>
      tx.review.update({
        where: { id: review },
        data: { submittedAt: new Date('2026-10-09T16:00:00Z'), version: { increment: 1 } },
      }),
    );
    const result = await list();
    expect(result.data.filter((r) => r.eventType === 'REVIEW_SUBMITTED')).toHaveLength(1);
    expect(result.data.filter((r) => r.eventType === 'REVIEW_UPDATED')).toHaveLength(1);
    expect(JSON.stringify(result)).not.toContain('PRIVATE');
  });
  it('records author response publication and withdrawal, including automated nonpayment', async () => {
    await scoped(author, (tx) =>
      tx.rebuttal.update({
        where: { id: rebuttal },
        data: { submittedAt: new Date('2026-10-09T15:00:00Z'), version: { increment: 1 } },
      }),
    );
    await scoped(author, (tx) =>
      tx.rebuttal.update({
        where: { id: rebuttal },
        data: { submittedAt: new Date('2026-10-09T16:00:00Z'), version: { increment: 1 } },
      }),
    );
    await scoped(organizer, (tx) =>
      tx.paper.update({
        where: { id: paper },
        data: { status: 'WITHDRAWN_NONPAYMENT', version: { increment: 1 } },
      }),
    );
    const rows = (await list()).data;
    expect(rows.some((r) => r.eventType === 'PAPER_WITHDRAWN')).toBe(true);
    expect(rows.some((r) => r.eventType === 'REBUTTAL_SUBMITTED')).toBe(true);
    expect(rows.some((r) => r.eventType === 'REBUTTAL_UPDATED')).toBe(true);
  });
  it('isolates read state per person and uses global unread filters/counts', async () => {
    const row = (await list()).data[0]!;
    const initial = (await service.countConferenceUpdates(scope(), ['CHAIR'])).unreadCount;
    await service.acknowledge(scope(), { kind: 'CONFERENCE', sourceId: row.id, version: 0 }, [
      'CHAIR',
    ]);
    expect((await service.countConferenceUpdates(scope(), ['CHAIR'])).unreadCount).toBe(
      initial - 1,
    );
    expect(
      (await service.countConferenceUpdates(scope(organizer), ['ORGANIZER'])).unreadCount,
    ).toBe(initial);
    const unread = await service.list(scope(), 'CONFERENCE', undefined, ['CHAIR'], true);
    expect(unread.data.every((r) => r.unread)).toBe(true);
    expect(unread.data.some((r) => r.id === row.id)).toBe(false);
    await expect(
      service.acknowledge(scope(), { kind: 'CONFERENCE', sourceId: row.id, version: 1 }, ['CHAIR']),
    ).rejects.toMatchObject({ status: 409 });
  });
  it('mark-all preserves activity newer than the supplied snapshot', async () => {
    const rows = (await list()).data;
    const cutoff = new Date(rows[0]!.updatedAt);
    await db.conferenceUpdate.create({
      data: {
        organizationId: org,
        conferenceId: conf,
        sourceId: randomUUID(),
        sourceVersion: 0,
        kind: 'PAPER_SUBMITTED',
        message: 'Paper submitted.',
        subject: 'New after snapshot',
        createdAt: new Date(cutoff.getTime() + 60000),
      },
    });
    await service.readAllConferenceUpdates(scope(), cutoff.toISOString(), ['CHAIR']);
    expect((await service.countConferenceUpdates(scope(), ['CHAIR'])).unreadCount).toBe(1);
    expect(
      (await service.list(scope(), 'CONFERENCE', undefined, ['CHAIR'], true)).data[0]?.subject,
    ).toBe('New after snapshot');
  });
  it('enforces coordinator permissions, conference RLS and immutable records', async () => {
    await expect(
      service.list(scope(author), 'CONFERENCE', undefined, ['AUTHOR']),
    ).rejects.toMatchObject({ status: 403 });
    for (const userId of [author, reviewer]) {
      const result = await withTenantContext(scope(userId), (tx) => tx.conferenceUpdate.findMany());
      expect(result).toEqual([]);
    }
    expect(
      await withTenantContext(scope(chair, otherConf), (tx) => tx.conferenceUpdate.findMany()),
    ).toEqual([]);
    for (const [userId, role] of [
      [admin, 'ORG_ADMIN'],
      [platform, 'PLATFORM_ADMIN'],
    ] as const)
      expect(
        (await service.list(scope(userId), 'CONFERENCE', undefined, [role])).data.length,
      ).toBeGreaterThan(0);
    await expect(
      scoped(chair, (tx) =>
        tx.conferenceUpdate.create({
          data: {
            organizationId: org,
            conferenceId: conf,
            sourceId: randomUUID(),
            sourceVersion: 0,
            kind: 'PAPER_SUBMITTED',
            message: 'Fake',
            subject: 'Fake',
          },
        }),
      ),
    ).rejects.toThrow();
    await expect(scoped(chair, (tx) => tx.conferenceUpdate.deleteMany())).rejects.toThrow();
    await expect(
      service.acknowledge(scope(), { kind: 'CONFERENCE', sourceId: randomUUID(), version: 0 }, [
        'CHAIR',
      ]),
    ).rejects.toMatchObject({ status: 404 });
  });
  it('paginates equal timestamps without gaps and rejects a foreign cursor', async () => {
    await db.conferenceUpdate.createMany({
      data: Array.from({ length: 60 }, () => ({
        organizationId: org,
        conferenceId: conf,
        sourceId: randomUUID(),
        sourceVersion: 0,
        kind: 'PAPER_SUBMITTED',
        message: 'Paper submitted.',
        subject: 'Pagination fixture',
        createdAt: new Date('2020-01-01'),
      })),
    });
    const first = await list();
    expect(first.data).toHaveLength(50);
    expect(first.nextCursor).not.toBeNull();
    const second = await service.list(scope(), 'CONFERENCE', first.nextCursor!, ['CHAIR']);
    expect(new Set([...first.data, ...second.data].map((r) => r.id)).size).toBe(
      first.data.length + second.data.length,
    );
    expect(second.nextCursor).toBeNull();
    const foreign = await db.conferenceUpdate.create({
      data: {
        organizationId: org,
        conferenceId: otherConf,
        sourceId: randomUUID(),
        sourceVersion: 0,
        kind: 'PAPER_SUBMITTED',
        message: 'Paper submitted.',
        subject: 'Foreign cursor',
      },
    });
    await expect(service.list(scope(), 'CONFERENCE', foreign.id, ['CHAIR'])).rejects.toMatchObject({
      status: 404,
    });
  });
});
