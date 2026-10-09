import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { generateId, withTenantContext, Prisma, type RoleKind } from '@openconferences/db';
import type { InboxKind } from '@openconferences/schemas';
import { canCoordinateReview } from '../tenancy/role-hierarchy';

type Kind = InboxKind;
type Scope = { userId: string; conferenceId: string; organizationId: string };

export function inboxAuthorWhere(userId: string) {
  return { OR: [{ submittedById: userId }, { authorships: { some: { userId } } }] };
}

@Injectable()
export class InboxService {
  private async sources(
    scope: Scope,
    kind: Kind,
    options: { cursor?: string; sourceId?: string; unread?: boolean } = {},
  ) {
    return withTenantContext(scope, async (tx) => {
      if (kind === 'CONFERENCE') {
        const cursor = options.cursor
          ? await tx.conferenceUpdate.findFirst({
              where: { id: options.cursor, conferenceId: scope.conferenceId },
            })
          : null;
        if (options.cursor && !cursor) throw new NotFoundException('Update not found');
        const rows = await tx.$queryRaw<Prisma.ConferenceUpdateGetPayload<Record<string, never>>[]>`
          SELECT u.* FROM public.conference_updates u WHERE u."conferenceId"=${scope.conferenceId}::uuid
          ${options.sourceId ? Prisma.sql`AND u.id=${options.sourceId}::uuid` : Prisma.empty}
          ${cursor ? Prisma.sql`AND (u."createdAt",u.id)<((${cursor.createdAt}::timestamptz AT TIME ZONE 'UTC'),${cursor.id}::uuid)` : Prisma.empty}
          ${
            options.unread
              ? Prisma.sql`AND NOT EXISTS (SELECT 1 FROM public.inbox_read_states r
            WHERE r."sourceId"=u.id AND r."userId"=${scope.userId}::uuid
            AND r."conferenceId"=u."conferenceId" AND r.kind='CONFERENCE')`
              : Prisma.empty
          }
          ORDER BY u."createdAt" DESC,u.id DESC LIMIT 51`;
        return rows.map((row) => ({
          id: row.id,
          paperId: row.paperId,
          roundId: row.roundId,
          version: 0,
          updatedAt: row.createdAt,
          paper: { title: row.message },
          subject: row.subject,
          eventType: row.kind,
          href: row.paperId
            ? `/dashboard/conferences/${scope.conferenceId}/submissions/${row.paperId}${row.roundId ? `?section=reviews&round=${row.roundId}` : ''}`
            : `/dashboard/conferences/${scope.conferenceId}/reviews/reviewers`,
        }));
      }
      const page = {
        take: 51,
        orderBy: [{ updatedAt: 'desc' as const }, { id: 'desc' as const }],
        ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
      };
      if (kind === 'REVIEW') {
        const where: Prisma.ReviewWhereInput = {
          conferenceId: scope.conferenceId,
          ...(options.sourceId ? { id: options.sourceId } : {}),
          visibility: 'AUTHOR_VISIBLE',
          submittedAt: { not: null },
          paper: inboxAuthorWhere(scope.userId),
        };
        const rows = await tx.review.findMany({
          where,
          ...page,
          select: {
            id: true,
            paperId: true,
            roundId: true,
            version: true,
            updatedAt: true,
            paper: { select: { title: true } },
          },
        });
        return rows.map((row) => ({
          ...row,
          href: `/dashboard/conferences/${scope.conferenceId}/submissions/${row.paperId}?section=reviews&round=${row.roundId}`,
        }));
      }
      // Resolve eligible assignments by round as well as paper; another round must not grant access.
      const assignments = await tx.reviewerAssignment.findMany({
        where: {
          conferenceId: scope.conferenceId,
          reviewerUserId: scope.userId,
          status: { notIn: ['DECLINED', 'REPLACED'] },
          review: { submittedAt: { not: null } },
          paper: { NOT: inboxAuthorWhere(scope.userId) },
        },
        select: { id: true, paperId: true, roundId: true },
      });
      if (!assignments.length) return [];
      const rows = await tx.rebuttal.findMany({
        where: {
          conferenceId: scope.conferenceId,
          submittedAt: { not: null },
          ...(options.sourceId ? { id: options.sourceId } : {}),
          OR: assignments.map(({ paperId, roundId }) => ({ paperId, roundId })),
        },
        ...page,
        select: {
          id: true,
          paperId: true,
          roundId: true,
          version: true,
          updatedAt: true,
          paper: { select: { title: true } },
        },
      });
      return rows.map((row) => ({
        ...row,
        href: `/dashboard/conferences/${scope.conferenceId}/reviews/assignments/${assignments.find((assignment) => assignment.paperId === row.paperId && assignment.roundId === row.roundId)!.id}?section=response`,
      }));
    });
  }

  async list(scope: Scope, kind: Kind, cursor?: string, roles: RoleKind[] = [], unread = false) {
    if (kind === 'CONFERENCE') this.assertCoordinator(roles);
    const observedAt = new Date().toISOString();
    const rows = await this.sources(scope, kind, { cursor, unread });
    const page = rows.slice(0, 50);
    const receipts = await withTenantContext(scope, (tx) =>
      tx.inboxReadState.findMany({
        where: {
          userId: scope.userId,
          conferenceId: scope.conferenceId,
          kind,
          sourceId: { in: page.map((row) => row.id) },
        },
      }),
    );
    const versions = new Map(receipts.map((receipt) => [receipt.sourceId, receipt.readVersion]));
    return {
      data: page.map(({ paper, ...row }) => ({
        ...row,
        kind,
        title: paper.title,
        updatedAt: row.updatedAt.toISOString(),
        unread: (versions.get(row.id) ?? -1) < row.version,
      })),
      nextCursor: rows.length > 50 ? page[49]!.id : null,
      observedAt,
    };
  }

  async acknowledge(
    scope: Scope,
    input: { kind: Kind; sourceId: string; version: number },
    roles: RoleKind[] = [],
  ) {
    if (input.kind === 'CONFERENCE') this.assertCoordinator(roles);
    const [source] = await this.sources(scope, input.kind, { sourceId: input.sourceId });
    if (!source) throw new NotFoundException('Update not found');
    if (input.version > source.version)
      throw new ConflictException('Refresh the update before marking it read');
    await withTenantContext(scope, async (tx) => {
      const key = {
        userId: scope.userId,
        conferenceId: scope.conferenceId,
        kind: input.kind,
        sourceId: input.sourceId,
      };
      await tx.inboxReadState.createMany({
        data: [
          {
            id: generateId(),
            organizationId: scope.organizationId,
            ...key,
            readVersion: input.version,
          },
        ],
        skipDuplicates: true,
      });
      await tx.inboxReadState.updateMany({
        where: { ...key, readVersion: { lt: input.version } },
        data: { readVersion: input.version },
      });
    });
    return { read: true as const };
  }

  async countConferenceUpdates(scope: Scope, roles: RoleKind[]) {
    this.assertCoordinator(roles);
    const [result] = await withTenantContext(
      scope,
      (tx) => tx.$queryRaw<{ count: bigint }[]>`
      SELECT count(*) AS count FROM public.conference_updates u
      WHERE u."conferenceId"=${scope.conferenceId}::uuid AND NOT EXISTS (
        SELECT 1 FROM public.inbox_read_states r WHERE r."sourceId"=u.id
        AND r."userId"=${scope.userId}::uuid AND r."conferenceId"=u."conferenceId" AND r.kind='CONFERENCE'
      )`,
    );
    return { unreadCount: Number(result?.count ?? 0) };
  }

  async readAllConferenceUpdates(scope: Scope, before: string, roles: RoleKind[]) {
    this.assertCoordinator(roles);
    const cutoff = new Date(Math.min(new Date(before).getTime(), Date.now()));
    await withTenantContext(
      scope,
      (tx) => tx.$executeRaw`
      INSERT INTO public.inbox_read_states(id,"organizationId","conferenceId","userId",kind,"sourceId","readVersion","updatedAt")
      SELECT gen_random_uuid(),u."organizationId",u."conferenceId",${scope.userId}::uuid,'CONFERENCE',u.id,0,now()
      FROM public.conference_updates u WHERE u."conferenceId"=${scope.conferenceId}::uuid AND u."createdAt"<=(${cutoff}::timestamptz AT TIME ZONE 'UTC')
      ON CONFLICT ("userId","conferenceId",kind,"sourceId") DO NOTHING`,
    );
    return { read: true as const };
  }

  private assertCoordinator(roles: RoleKind[]) {
    if (!canCoordinateReview(roles))
      throw new ForbiddenException('Conference coordination permission required');
  }
}
