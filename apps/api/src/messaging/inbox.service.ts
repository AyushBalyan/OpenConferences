import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { generateId, withTenantContext, type Prisma } from '@openconferences/db';

type Kind = 'REVIEW' | 'REBUTTAL';
type Scope = { userId: string; conferenceId: string; organizationId: string };

export function inboxAuthorWhere(userId: string) {
  return { OR: [{ submittedById: userId }, { authorships: { some: { userId } } }] };
}

@Injectable()
export class InboxService {
  private async sources(
    scope: Scope,
    kind: Kind,
    options: { cursor?: string; sourceId?: string } = {},
  ) {
    return withTenantContext(scope, async (tx) => {
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
          status: { not: 'DECLINED' },
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

  async list(scope: Scope, kind: Kind, cursor?: string) {
    const rows = await this.sources(scope, kind, { cursor });
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
    };
  }

  async acknowledge(scope: Scope, input: { kind: Kind; sourceId: string; version: number }) {
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
}
