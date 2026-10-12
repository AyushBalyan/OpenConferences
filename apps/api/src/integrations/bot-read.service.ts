import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, withTenantContext } from '@openconferences/db';
import type { BotQuery, IntegrationScope, BotPaperDto } from '@openconferences/schemas';
import { minimumReviewsFromConfig } from '../review/review-stage';
import { IntegrationStore } from './integration.store';
import { decodeCursor, encodeCursor, type IntegrationPrincipal } from './integration.security';
type Tx = Prisma.TransactionClient;
type Work = {
  id: string;
  paperId: string;
  submissionNumber: string | null;
  reviewerUserId: string;
  cycleId: string;
  cycleNumber: number;
  isCurrentCycle: boolean;
  status: string;
  progress: 'RETIRED' | 'SUBMITTED' | 'INCONSISTENT' | 'CLOSED' | 'DRAFT' | 'NOT_STARTED';
  submittedAt: Date | null;
  dueAt: Date;
  deadlineSource: 'INDIVIDUAL' | 'CYCLE' | 'CONFERENCE' | 'LEGACY';
  overdue: boolean;
};
const active = ['SUBMITTED', 'UNDER_REVIEW', 'DECISION_MADE', 'CAMERA_READY'] as const;
const zero = () => ({
  assigned: 0,
  submitted: 0,
  remaining: 0,
  notStarted: 0,
  drafts: 0,
  closedIncomplete: 0,
  inconsistent: 0,
  overdue: 0,
  dueSoon: 0,
  earliestDeadline: null as string | null,
});
@Injectable()
export class BotReadService {
  constructor(private readonly store: IntegrationStore) {}
  require(p: IntegrationPrincipal, ...scopes: IntegrationScope[]) {
    if (scopes.some((s) => !p.scopes.includes(s)))
      throw new ForbiddenException('Missing required read scope');
  }
  async read<T>(
    p: IntegrationPrincipal,
    fn: (tx: Tx, snapshot: IntegrationPrincipal) => Promise<T>,
  ) {
    return withTenantContext(
      p,
      async (tx) => {
        const conference = await tx.conference.findFirst({
          where: { id: p.conferenceId, deletedAt: null, organization: { deletedAt: null } },
          select: { reviewDueAt: true },
        });
        if (!conference) throw new NotFoundException('Resource not found');
        return fn(tx, { ...p, conferenceReviewDueAt: conference.reviewDueAt });
      },
      {
        readOnly: true,
        isolationLevel: 'RepeatableRead',
        timeout: 5000,
      },
    );
  }
  meta(q: BotQuery, now: Date, count: number) {
    const { cursor: _c, ...filters } = q;
    return { observedAt: now.toISOString(), history: q.history, filters, returnedCount: count };
  }
  page<T extends { id: string }>(
    p: IntegrationPrincipal,
    resource: string,
    q: BotQuery,
    rows: T[],
    now: Date,
  ) {
    return {
      data: rows.slice(0, q.limit),
      nextCursor:
        rows.length > q.limit ? encodeCursor(p, resource, q, rows[q.limit - 1]!.id) : null,
      meta: this.meta(q, now, Math.min(rows.length, q.limit)),
    };
  }
  validate(q: BotQuery, allowed: string[]) {
    const defaults = { limit: 25, history: 'CURRENT', includeWithdrawn: false };
    for (const [k, v] of Object.entries(q)) {
      if (
        v !== undefined &&
        !['limit', 'cursor', ...allowed].includes(k) &&
        v !== defaults[k as keyof typeof defaults]
      )
        throw new BadRequestException(`Unsupported filter: ${k}`);
    }
  }
  async foreignIds(tx: Tx, p: IntegrationPrincipal, q: BotQuery) {
    if (
      q.trackId &&
      !(await tx.track.findFirst({
        where: { id: q.trackId, conferenceId: p.conferenceId },
        select: { id: true },
      }))
    )
      throw new NotFoundException('Resource not found');
    if (
      q.paperId &&
      !(await tx.paper.findFirst({
        where: { id: q.paperId, conferenceId: p.conferenceId, status: { not: 'DRAFT' } },
        select: { id: true },
      }))
    )
      throw new NotFoundException('Resource not found');
    if (
      q.cycleId &&
      !(await tx.reviewRound.findFirst({
        where: {
          id: q.cycleId,
          conferenceId: p.conferenceId,
          ...(q.paperId ? { paperId: q.paperId } : {}),
        },
        select: { id: true },
      }))
    )
      throw new NotFoundException('Resource not found');
  }
  paperWhere(p: IntegrationPrincipal, q: BotQuery): Prisma.PaperWhereInput {
    return {
      conferenceId: p.conferenceId,
      status: q.status ?? {
        in: q.includeWithdrawn ? [...active, 'WITHDRAWN', 'WITHDRAWN_NONPAYMENT'] : [...active],
      },
      ...(q.trackId ? { trackId: q.trackId } : {}),
      ...(q.paperId ? { id: q.paperId } : {}),
      ...(q.q
        ? {
            OR: [
              { title: { contains: q.q, mode: 'insensitive' } },
              { submissionNumber: { contains: q.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
  }
  async papers(
    p: IntegrationPrincipal,
    q: BotQuery,
    id?: string,
  ): Promise<{
    data: BotPaperDto | BotPaperDto[];
    nextCursor?: string | null;
    meta: ReturnType<BotReadService['meta']>;
  }> {
    this.require(p, 'papers:read');
    this.validate(q, ['trackId', 'status', 'includeWithdrawn', 'q']);
    const now = new Date(),
      cursor = decodeCursor(p, 'papers', q);
    return this.read(p, async (tx) => {
      await this.foreignIds(tx, p, q);
      const where = this.paperWhere(p, q);
      if (id) where.id = id;
      else if (cursor) where.id = { gt: cursor };
      const rows = await tx.paper.findMany({
        where,
        select: {
          id: true,
          submissionNumber: true,
          title: true,
          abstract: true,
          keywords: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          track: { select: { id: true, name: true } },
          reviewRounds: {
            orderBy: { roundNumber: 'desc' },
            take: 1,
            select: { id: true, roundNumber: true },
          },
        },
        orderBy: { id: 'asc' },
        take: id ? 1 : q.limit + 1,
      });
      const mapped = rows.map(({ reviewRounds, ...r }) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        submittedAt: null,
        currentCycle: reviewRounds[0]
          ? { id: reviewRounds[0].id, number: reviewRounds[0].roundNumber }
          : null,
      }));
      if (id) {
        if (!mapped[0]) throw new NotFoundException('Resource not found');
        return { data: mapped[0], meta: this.meta(q, now, 1) };
      }
      return this.page(p, 'papers', q, mapped, now);
    });
  }
  async authors(p: IntegrationPrincipal, q: BotQuery, paperId?: string) {
    this.require(p, 'authors:read', 'papers:read');
    this.validate(q, ['paperId', 'trackId', 'includeWithdrawn', 'status', 'q', 'email']);
    if (q.email) this.require(p, 'authors:contacts:read');
    const now = new Date(),
      cursor = decodeCursor(p, 'authors', q);
    return this.read(p, async (tx) => {
      const scope = { ...q, paperId: paperId ?? q.paperId };
      await this.foreignIds(tx, p, scope);
      const where = this.paperWhere(p, { ...scope, q: undefined });
      if (paperId && !(await tx.paper.findFirst({ where, select: { id: true } })))
        throw new NotFoundException('Resource not found');
      const rows = await tx.authorship.findMany({
        where: {
          paper: where,
          ...(cursor ? { id: { gt: cursor } } : {}),
          ...(q.q ? { fullName: { contains: q.q, mode: 'insensitive' } } : {}),
          ...(q.email ? { email: { contains: q.email, mode: 'insensitive' } } : {}),
        },
        select: {
          id: true,
          paperId: true,
          fullName: true,
          affiliation: true,
          order: true,
          isCorresponding: true,
          email: p.scopes.includes('authors:contacts:read'),
          paper: { select: { submissionNumber: true } },
        },
        orderBy: { id: 'asc' },
        take: q.limit + 1,
      });
      return this.page(
        p,
        'authors',
        q,
        rows.map(({ paper, fullName, ...r }) => ({
          ...r,
          name: fullName,
          submissionNumber: paper.submissionNumber,
        })),
        now,
      );
    });
  }
  async reviewerUser(tx: Tx, p: IntegrationPrincipal, id?: string) {
    if (!id) return undefined;
    const ref = await tx.apiIntegrationReviewerReference.findFirst({
      where: { id, integrationId: p.integrationId, conferenceId: p.conferenceId },
      select: { reviewerUserId: true },
    });
    if (!ref) throw new NotFoundException('Resource not found');
    return ref.reviewerUserId;
  }
  scopeSql(p: IntegrationPrincipal, q: BotQuery, now: Date, reviewerUserId?: string) {
    const conditions = [
      Prisma.sql`a."conferenceId"=${p.conferenceId}::uuid`,
      Prisma.sql`p.status<>'DRAFT'`,
    ];
    if (q.history === 'CURRENT')
      conditions.push(
        Prisma.sql`r.id=latest.id`,
        Prisma.sql`p.status NOT IN ('WITHDRAWN','WITHDRAWN_NONPAYMENT')`,
      );
    if (q.history === 'HISTORICAL') conditions.push(Prisma.sql`r.id<>latest.id`);
    if (q.trackId) conditions.push(Prisma.sql`p."trackId"=${q.trackId}::uuid`);
    if (q.paperId) conditions.push(Prisma.sql`p.id=${q.paperId}::uuid`);
    if (q.cycleId) conditions.push(Prisma.sql`r.id=${q.cycleId}::uuid`);
    if (q.cycleNumber) conditions.push(Prisma.sql`r."roundNumber"=${q.cycleNumber}`);
    if (reviewerUserId) conditions.push(Prisma.sql`a."reviewerUserId"=${reviewerUserId}::uuid`);
    return Prisma.sql`WITH work_base AS (SELECT a.id,a."paperId",p."submissionNumber",a."reviewerUserId",r.id AS "cycleId",r."roundNumber" AS "cycleNumber",r.id=latest.id AS "isCurrentCycle",a.status::text,
 v."submittedAt",COALESCE(a."dueAt",r."reviewDueAt",${p.conferenceReviewDueAt}::timestamp,a."createdAt"+interval '7 days') AS "dueAt",
 CASE WHEN a."dueAt" IS NOT NULL THEN 'INDIVIDUAL' WHEN r."reviewDueAt" IS NOT NULL THEN 'CYCLE' WHEN ${p.conferenceReviewDueAt}::timestamp IS NOT NULL THEN 'CONFERENCE' ELSE 'LEGACY' END AS "deadlineSource",
 CASE WHEN a.status IN ('DECLINED','REPLACED') OR p.status IN ('WITHDRAWN','WITHDRAWN_NONPAYMENT') THEN 'RETIRED'
 WHEN v."submittedAt" IS NOT NULL THEN 'SUBMITTED' WHEN a.status='COMPLETED' THEN 'INCONSISTENT'
 WHEN r.id<>latest.id OR p.status NOT IN ('SUBMITTED','UNDER_REVIEW') OR r."reviewsReleasedAt" IS NOT NULL OR EXISTS(SELECT 1 FROM decisions d WHERE d."roundId"=r.id) THEN 'CLOSED'
 WHEN v.id IS NOT NULL THEN 'DRAFT' ELSE 'NOT_STARTED' END AS progress
 FROM reviewer_assignments a JOIN papers p ON p.id=a."paperId" JOIN review_rounds r ON r.id=a."roundId"
 JOIN LATERAL (SELECT lr.id FROM review_rounds lr WHERE lr."paperId"=p.id ORDER BY lr."roundNumber" DESC LIMIT 1) latest ON true
 LEFT JOIN reviews v ON v."assignmentId"=a.id WHERE ${Prisma.join(conditions, ' AND ')}),
 work AS (SELECT *,progress IN ('DRAFT','NOT_STARTED') AND "dueAt"<${now}::timestamp AS overdue FROM work_base)`;
  }
  async assignments(p: IntegrationPrincipal, q: BotQuery, id?: string) {
    this.require(p, 'assignments:read', 'papers:read', 'reviewers:read');
    this.validate(q, [
      'trackId',
      'paperId',
      'reviewerId',
      'history',
      'cycleId',
      'cycleNumber',
      'progress',
      'overdue',
    ]);
    const now = new Date(),
      cursor = decodeCursor(p, 'assignments', q);
    const rows = await this.read(p, async (tx, snapshot) => {
      await this.foreignIds(tx, p, q);
      const reviewer = await this.reviewerUser(tx, p, q.reviewerId);
      const filters = [Prisma.sql`true`];
      if (id) filters.push(Prisma.sql`id=${id}::uuid`);
      else if (cursor) filters.push(Prisma.sql`id>${cursor}::uuid`);
      if (q.progress) filters.push(Prisma.sql`progress=${q.progress}`);
      if (q.overdue !== undefined) filters.push(Prisma.sql`overdue=${q.overdue}`);
      return tx.$queryRaw<Work[]>(
        Prisma.sql`${this.scopeSql(snapshot, q, now, reviewer)} SELECT * FROM work WHERE ${Prisma.join(filters, ' AND ')} ORDER BY id LIMIT ${id ? 1 : q.limit + 1}`,
      );
    });
    if (id && !rows[0]) throw new NotFoundException('Resource not found');
    const pageRows = rows.slice(0, id ? 1 : q.limit);
    const refs = await this.store.references(
      p,
      pageRows.map((r) => r.reviewerUserId),
    );
    const mapped = pageRows.map(({ reviewerUserId, ...r }) => ({
      ...r,
      reviewerId: refs.find((x) => x.reviewerUserId === reviewerUserId)!.id,
      submittedAt: r.submittedAt?.toISOString() ?? null,
      dueAt: r.dueAt.toISOString(),
      retired: r.progress === 'RETIRED',
    }));
    if (id) return { data: mapped[0], meta: this.meta(q, now, 1) };
    return {
      data: mapped,
      nextCursor:
        rows.length > q.limit
          ? encodeCursor(p, 'assignments', q, pageRows[pageRows.length - 1]!.id)
          : null,
      meta: this.meta(q, now, mapped.length),
    };
  }
  workloadSql(now: Date) {
    return Prisma.sql`COUNT(*) FILTER(WHERE progress<>'RETIRED')::int AS assigned,COUNT(*) FILTER(WHERE progress='SUBMITTED')::int AS submitted,
 COUNT(*) FILTER(WHERE progress IN ('NOT_STARTED','DRAFT'))::int AS remaining,COUNT(*) FILTER(WHERE progress='NOT_STARTED')::int AS "notStarted",COUNT(*) FILTER(WHERE progress='DRAFT')::int AS drafts,
 COUNT(*) FILTER(WHERE progress='CLOSED')::int AS "closedIncomplete",COUNT(*) FILTER(WHERE progress='INCONSISTENT')::int AS inconsistent,COUNT(*) FILTER(WHERE overdue)::int AS overdue,
 COUNT(*) FILTER(WHERE progress IN ('NOT_STARTED','DRAFT') AND "dueAt">=${now}::timestamp AND "dueAt"<=${new Date(now.getTime() + 72 * 3600000)}::timestamp)::int AS "dueSoon",
 MIN("dueAt") FILTER(WHERE progress IN ('NOT_STARTED','DRAFT')) AS "earliestDeadline"`;
  }
  async reviewers(p: IntegrationPrincipal, q: BotQuery, id?: string) {
    this.require(p, 'reviewers:read');
    this.validate(q, ['trackId', 'paperId', 'history', 'cycleNumber', 'attention', 'q', 'email']);
    if (q.q) this.require(p, 'reviewers:identity:read');
    if (q.email) this.require(p, 'reviewers:contacts:read');
    const now = new Date(),
      cursor = decodeCursor(p, 'reviewers', q);
    type Row = ReturnType<typeof zero> & {
      userId: string;
      hasReviewerRole: boolean;
      name: string | null;
      email: string | null;
      earliestDeadline: string | null;
    };
    const rows = await this.read(p, async (tx, snapshot) => {
      await this.foreignIds(tx, p, q);
      const target = await this.reviewerUser(tx, p, id);
      const filters = [Prisma.sql`true`];
      if (target) filters.push(Prisma.sql`roster.id=${target}::uuid`);
      else if (cursor) filters.push(Prisma.sql`roster.id>${cursor}::uuid`);
      if (q.q) filters.push(Prisma.sql`u.name ILIKE ${'%' + q.q + '%'}`);
      if (q.email) filters.push(Prisma.sql`u.email ILIKE ${'%' + q.email + '%'}`);
      if (q.attention === 'OVERDUE') filters.push(Prisma.sql`COALESCE(w.overdue,0)>0`);
      if (q.attention === 'REMAINING') filters.push(Prisma.sql`COALESCE(w.remaining,0)>0`);
      if (q.attention === 'UNASSIGNED') filters.push(Prisma.sql`COALESCE(w.assigned,0)=0`);
      if (q.attention === 'COMPLETE')
        filters.push(Prisma.sql`w.assigned>0 AND w.submitted=w.assigned`);
      return tx.$queryRaw<Row[]>(
        Prisma.sql`${this.scopeSql(snapshot, q, now)}, roster AS (SELECT m."userId" AS id FROM memberships m JOIN role_grants g ON g."membershipId"=m.id WHERE m."conferenceId"=${p.conferenceId}::uuid AND m.scope='CONFERENCE' AND g.role='REVIEWER' UNION SELECT "reviewerUserId" FROM work), aggregated AS (SELECT "reviewerUserId",${this.workloadSql(now)} FROM work GROUP BY "reviewerUserId") SELECT roster.id AS "userId",EXISTS(SELECT 1 FROM memberships m JOIN role_grants g ON g."membershipId"=m.id WHERE m."userId"=roster.id AND m."conferenceId"=${p.conferenceId}::uuid AND m.scope='CONFERENCE' AND g.role='REVIEWER') AS "hasReviewerRole",CASE WHEN ${p.scopes.includes('reviewers:identity:read')} THEN u.name END AS name,CASE WHEN ${p.scopes.includes('reviewers:contacts:read')} THEN u.email END AS email,w.* FROM roster JOIN users u ON u.id=roster.id LEFT JOIN aggregated w ON w."reviewerUserId"=roster.id WHERE ${Prisma.join(filters, ' AND ')} ORDER BY roster.id LIMIT ${id ? 1 : q.limit + 1}`,
      );
    });
    if (id && !rows[0]) throw new NotFoundException('Resource not found');
    const selected = rows.slice(0, id ? 1 : q.limit),
      refs = await this.store.references(
        p,
        selected.map((r) => r.userId),
      );
    const mapped = selected.map((r) => {
      const ref = refs.find((x) => x.reviewerUserId === r.userId)!;
      const workload = zero();
      for (const key of Object.keys(workload)) {
        if (key === 'earliestDeadline')
          workload.earliestDeadline = r.earliestDeadline
            ? new Date(r.earliestDeadline).toISOString()
            : null;
        else
          workload[key as Exclude<keyof typeof workload, 'earliestDeadline'>] = Number(
            r[key as keyof typeof workload] ?? 0,
          );
      }
      return {
        id: ref.id,
        label: `Reviewer ${ref.id.slice(0, 8)}`,
        hasReviewerRole: r.hasReviewerRole,
        ...(p.scopes.includes('reviewers:identity:read') ? { name: r.name ?? '' } : {}),
        ...(p.scopes.includes('reviewers:contacts:read') ? { email: r.email ?? '' } : {}),
        workload,
      };
    });
    if (id) return { data: mapped[0], meta: this.meta(q, now, 1) };
    return {
      data: mapped,
      nextCursor:
        rows.length > q.limit
          ? encodeCursor(p, 'reviewers', q, selected[selected.length - 1]!.userId)
          : null,
      meta: this.meta(q, now, mapped.length),
    };
  }
  async summary(p: IntegrationPrincipal, q: BotQuery) {
    this.require(p, 'analytics:read');
    this.validate(q, ['trackId']);
    if (q.cursor || q.limit !== 25)
      throw new BadRequestException('Summary does not support pagination');
    const now = new Date();
    return this.read(p, async (tx, snapshot) => {
      await this.foreignIds(tx, p, q);
      const statuses = await tx.paper.groupBy({
        by: ['status'],
        where: {
          conferenceId: p.conferenceId,
          status: { not: 'DRAFT' },
          ...(q.trackId ? { trackId: q.trackId } : {}),
        },
        _count: true,
      });
      const rows = await tx.$queryRaw<
        Array<ReturnType<typeof zero> & { reviewersWithActiveWork: number }>
      >(
        Prisma.sql`${this.scopeSql(snapshot, q, now)} SELECT ${this.workloadSql(now)},COUNT(DISTINCT "reviewerUserId") FILTER(WHERE progress IN ('DRAFT','NOT_STARTED'))::int AS "reviewersWithActiveWork" FROM work`,
      );
      const { reviewersWithActiveWork, ...reviews } = rows[0]!;
      const conference = await tx.conference.findFirstOrThrow({
        where: { id: p.conferenceId },
        select: { reviewConfig: true },
      });
      const minimum = minimumReviewsFromConfig(conference.reviewConfig);
      const under = await tx.$queryRaw<Array<{ count: number }>>(
        Prisma.sql`${this.scopeSql(snapshot, q, now)} SELECT COUNT(*)::int AS count FROM papers p WHERE p."conferenceId"=${p.conferenceId}::uuid AND p.status IN ('SUBMITTED','UNDER_REVIEW') ${q.trackId ? Prisma.sql`AND p."trackId"=${q.trackId}::uuid` : Prisma.empty} AND (SELECT COUNT(*) FROM work w WHERE w."paperId"=p.id AND w.progress<>'RETIRED')<${minimum}`,
      );
      const byStatus = Object.fromEntries(
        statuses
          .filter((s) => active.includes(s.status as (typeof active)[number]))
          .map((s) => [s.status, s._count]),
      );
      return {
        data: {
          submissions: {
            active: Object.values(byStatus).reduce((a, b) => a + b, 0),
            byStatus,
            withdrawn: statuses
              .filter((s) => s.status.startsWith('WITHDRAWN'))
              .reduce((a, b) => a + b._count, 0),
          },
          reviews: {
            ...reviews,
            earliestDeadline: reviews.earliestDeadline
              ? new Date(reviews.earliestDeadline).toISOString()
              : null,
          },
          reviewersWithActiveWork,
          underCoveredPapers: under[0]!.count,
        },
        meta: this.meta(q, now, 1),
      };
    });
  }
  capabilities(p: IntegrationPrincipal) {
    return {
      apiVersion: '1' as const,
      conference: { id: p.conferenceId, name: p.conferenceName, timezone: 'UTC' as const },
      scopes: p.scopes,
      expiresAt: p.expiresAt.toISOString(),
      limits: {
        defaultPageSize: 25,
        maxPageSize: 100,
        requestsPerKeyPerMinute: 60,
        requestsPerConferencePerMinute: 300,
      },
      observedAt: new Date().toISOString(),
    };
  }
}
