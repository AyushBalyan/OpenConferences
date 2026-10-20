import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { withTenantContext, type Prisma, type RoleKind } from '@openconferences/db';
import {
  integrationScopesSchema,
  integrationSchema,
  integrationKeySchema,
  type IntegrationScope,
} from '@openconferences/schemas';
import {
  botConfig,
  makeCredential,
  hashMatches,
  type IntegrationPrincipal,
} from './integration.security';
import { ConferenceService } from '../tenancy/conference.service';
import { canCoordinateReview } from '../tenancy/role-hierarchy';
type Tx = Prisma.TransactionClient;
export const keySelect = {
  id: true,
  label: true,
  scopes: true,
  createdAt: true,
  expiresAt: true,
  revokedAt: true,
  lastUsedAt: true,
} satisfies Prisma.ApiIntegrationKeySelect;
export const grantSelect = {
  id: true,
  conferenceId: true,
  organizationId: true,
  name: true,
  purpose: true,
  status: true,
  scopes: true,
  authorizedByUserId: true,
  authorizer: { select: { name: true } },
  version: true,
  createdAt: true,
  updatedAt: true,
  keys: { select: keySelect, orderBy: { createdAt: 'desc' as const }, take: 20 },
} satisfies Prisma.ApiIntegrationSelect;
function dto(row: unknown) {
  const value = row as Record<string, unknown> & { authorizer?: { name: string | null } };
  return integrationSchema.parse(
    JSON.parse(JSON.stringify({ ...value, authorizerName: value.authorizer?.name ?? null })),
  );
}
function keyDto(row: unknown) {
  return integrationKeySchema.parse(JSON.parse(JSON.stringify(row)));
}
@Injectable()
export class IntegrationStore {
  constructor(private readonly conferences: ConferenceService) {}
  async context(userId: string, conferenceId: string, roles: RoleKind[]) {
    botConfig();
    if (!canCoordinateReview(roles))
      throw new ForbiddenException('Review coordination permission required');
    const c = await this.conferences.loadConference(userId, conferenceId, roles);
    return { userId, conferenceId, organizationId: c.organizationId };
  }
  async audit(
    tx: Tx,
    ctx: { userId: string; conferenceId: string; organizationId: string },
    id: string,
    action: string,
  ) {
    await tx.auditLog.create({
      data: {
        id: randomUUID(),
        actorUserId: ctx.userId,
        conferenceId: ctx.conferenceId,
        organizationId: ctx.organizationId,
        action: `integration.${action}`,
        entity: 'ApiIntegration',
        entityId: id,
      },
    });
  }
  async present(tx: Tx, row: Prisma.ApiIntegrationGetPayload<{ select: typeof grantSelect }>) {
    const active = await tx.apiIntegrationKey.findMany({
      where: { integrationId: row.id, revokedAt: null, expiresAt: { gt: new Date() } },
      select: keySelect,
      take: 2,
    });
    return dto({
      ...row,
      keys: [...new Map([...active, ...row.keys].map((k) => [k.id, k])).values()],
    });
  }
  async get(tx: Tx, conferenceId: string, id: string) {
    const row = await tx.apiIntegration.findFirst({
      where: { id, conferenceId },
      select: grantSelect,
    });
    if (!row) throw new NotFoundException('Integration not found');
    return row;
  }
  async list(
    ctx: { userId: string; conferenceId: string; organizationId: string },
    limit: number,
    cursor?: string,
  ) {
    return withTenantContext(ctx, async (tx) => {
      const rows = await tx.apiIntegration.findMany({
        where: { conferenceId: ctx.conferenceId, ...(cursor ? { id: { gt: cursor } } : {}) },
        select: grantSelect,
        orderBy: { id: 'asc' },
        take: limit + 1,
      });
      return {
        data: await Promise.all(rows.slice(0, limit).map((row) => this.present(tx, row))),
        nextCursor: rows.length > limit ? rows[limit - 1]!.id : null,
      };
    });
  }
  async create(
    ctx: { userId: string; conferenceId: string; organizationId: string },
    input: { name: string; purpose?: string; scopes: IntegrationScope[] },
  ) {
    return withTenantContext(ctx, async (tx) => {
      const row = await tx.apiIntegration.create({
        data: {
          id: randomUUID(),
          conferenceId: ctx.conferenceId,
          organizationId: ctx.organizationId,
          ...input,
          authorizedByUserId: ctx.userId,
          createdByUserId: ctx.userId,
        } as Prisma.ApiIntegrationUncheckedCreateInput,
        select: grantSelect,
      });
      await this.audit(tx, ctx, row.id, 'created');
      return this.present(tx, row);
    });
  }
  async detail(ctx: { userId: string; conferenceId: string; organizationId: string }, id: string) {
    return withTenantContext(ctx, async (tx) =>
      this.present(tx, await this.get(tx, ctx.conferenceId, id)),
    );
  }
  async change(
    ctx: { userId: string; conferenceId: string; organizationId: string },
    id: string,
    input: {
      version: number;
      name?: string;
      purpose?: string | null;
      status?: 'ACTIVE' | 'SUSPENDED';
      scopes?: IntegrationScope[];
    },
    action = 'updated',
  ) {
    return withTenantContext(ctx, async (tx) => {
      await tx.$queryRaw`SELECT id FROM api_integrations WHERE id=${id}::uuid AND "conferenceId"=${ctx.conferenceId}::uuid FOR UPDATE`;
      const row = await this.get(tx, ctx.conferenceId, id);
      if (row.status === 'REVOKED') {
        if (action === 'revoked') return this.present(tx, row);
        throw new ConflictException('This integration is revoked');
      }
      if (row.version !== input.version)
        throw new ConflictException('Integration changed. Refresh and retry.');
      const { version: _v, ...patch } = input;
      const data: Prisma.ApiIntegrationUncheckedUpdateInput = {
        ...patch,
        version: { increment: 1 },
      };
      if (action === 'revoked') {
        data.status = 'REVOKED';
        data.revokedAt = new Date();
        data.revokedByUserId = ctx.userId;
      }
      if (action === 'reauthorized') data.authorizedByUserId = ctx.userId;
      if (action === 'revoked' || action === 'reauthorized')
        await tx.apiIntegrationKey.updateMany({
          where: { integrationId: id, conferenceId: ctx.conferenceId, revokedAt: null },
          data: { revokedAt: new Date(), revokedByUserId: ctx.userId },
        });
      const updated = await tx.apiIntegration.update({ where: { id }, data, select: grantSelect });
      await this.audit(tx, ctx, id, action);
      return this.present(tx, updated);
    });
  }
  async issue(
    ctx: { userId: string; conferenceId: string; organizationId: string },
    id: string,
    input: { label: string; scopes: IntegrationScope[]; expiresInDays: number; requestId: string },
  ) {
    return withTenantContext(ctx, async (tx) => {
      await tx.$queryRaw`SELECT id FROM api_integrations WHERE id=${id}::uuid AND "conferenceId"=${ctx.conferenceId}::uuid FOR UPDATE`;
      const grant = await this.get(tx, ctx.conferenceId, id);
      if (grant.status !== 'ACTIVE') throw new ConflictException('Integration must be active');
      if (input.scopes.some((s) => !grant.scopes.includes(s)))
        throw new ForbiddenException('Requested scopes exceed the integration grant');
      if (
        await tx.apiIntegrationKey.findUnique({
          where: { integrationId_requestId: { integrationId: id, requestId: input.requestId } },
        })
      )
        throw new ConflictException(
          'Key already issued. Its secret cannot be displayed again; revoke and issue a new key.',
        );
      const now = new Date();
      if (
        (await tx.apiIntegrationKey.count({
          where: { integrationId: id, revokedAt: null, expiresAt: { gt: now } },
        })) >= 2
      )
        throw new ConflictException('Revoke an existing key before issuing another');
      const credential = makeCredential();
      const row = await tx.apiIntegrationKey.create({
        data: {
          id: credential.id,
          integrationId: id,
          conferenceId: ctx.conferenceId,
          organizationId: ctx.organizationId,
          label: input.label,
          scopes: input.scopes,
          secretHash: credential.hash,
          createdByUserId: ctx.userId,
          requestId: input.requestId,
          expiresAt: new Date(now.getTime() + input.expiresInDays * 86400000),
        },
        select: keySelect,
      });
      await this.audit(tx, ctx, id, 'key_issued');
      return { key: keyDto(row), token: credential.token };
    });
  }
  async revokeKey(
    ctx: { userId: string; conferenceId: string; organizationId: string },
    id: string,
    keyId: string,
  ) {
    return withTenantContext(ctx, async (tx) => {
      await this.get(tx, ctx.conferenceId, id);
      const key = await tx.apiIntegrationKey.findFirst({
        where: { id: keyId, integrationId: id, conferenceId: ctx.conferenceId },
        select: { id: true, revokedAt: true },
      });
      if (!key) throw new NotFoundException('Key not found');
      if (!key.revokedAt) {
        await tx.apiIntegrationKey.update({
          where: { id: keyId },
          data: { revokedAt: new Date(), revokedByUserId: ctx.userId },
        });
        await this.audit(tx, ctx, id, 'key_revoked');
      }
      return this.present(tx, await this.get(tx, ctx.conferenceId, id));
    });
  }
  async access(
    ctx: { userId: string; conferenceId: string; organizationId: string },
    id: string,
    limit: number,
    cursor?: string,
  ) {
    return withTenantContext(ctx, async (tx) => {
      await this.get(tx, ctx.conferenceId, id);
      const since = new Date(Date.now() - 30 * 86400000);
      const position = cursor
        ? await tx.apiIntegrationAccessLog.findFirst({
            where: {
              id: cursor,
              integrationId: id,
              conferenceId: ctx.conferenceId,
              observedAt: { gte: since },
            },
            select: { id: true, observedAt: true },
          })
        : null;
      if (cursor && !position)
        throw new BadRequestException('Access cursor expired. Refresh the log.');
      const rows = await tx.apiIntegrationAccessLog.findMany({
        where: {
          integrationId: id,
          conferenceId: ctx.conferenceId,
          observedAt: { gte: since },
          ...(position
            ? {
                OR: [
                  { observedAt: { lt: position.observedAt } },
                  { observedAt: position.observedAt, id: { lt: position.id } },
                ],
              }
            : {}),
        },
        orderBy: [{ observedAt: 'desc' }, { id: 'desc' }],
        take: limit + 1,
        select: {
          id: true,
          requestId: true,
          route: true,
          method: true,
          status: true,
          resultCount: true,
          durationMs: true,
          observedAt: true,
        },
      });
      return {
        data: rows
          .slice(0, limit)
          .map((row) => ({ ...row, observedAt: row.observedAt.toISOString() })),
        nextCursor: rows.length > limit ? rows[limit - 1]!.id : null,
      };
    });
  }
  async authenticate(candidate: { id: string; hash: string }): Promise<IntegrationPrincipal> {
    botConfig();
    const key = await withTenantContext(
      {},
      async (tx) => {
        await tx.$queryRaw`SELECT set_config('app.integration_key_id',${candidate.id},true),set_config('app.integration_key_hash',${candidate.hash},true)`;
        return tx.apiIntegrationKey.findFirst({
          where: { id: candidate.id, secretHash: candidate.hash },
          select: {
            id: true,
            secretHash: true,
            scopes: true,
            expiresAt: true,
            revokedAt: true,
            integration: {
              select: {
                id: true,
                organizationId: true,
                conferenceId: true,
                authorizedByUserId: true,
                status: true,
                scopes: true,
              },
            },
          },
        });
      },
      { readOnly: true, timeout: 5000 },
    );
    if (
      !key ||
      !hashMatches(key.secretHash, candidate.hash) ||
      key.revokedAt ||
      key.expiresAt <= new Date() ||
      key.integration.status !== 'ACTIVE'
    )
      throw new UnauthorizedException('Invalid API credential');
    const g = key.integration;
    const ctx = {
      userId: g.authorizedByUserId,
      conferenceId: g.conferenceId,
      organizationId: g.organizationId,
    };
    const valid = await withTenantContext(
      ctx,
      async (tx) => {
        const conference = await tx.conference.findFirst({
          where: {
            id: g.conferenceId,
            organizationId: g.organizationId,
            deletedAt: null,
            organization: { deletedAt: null },
          },
          select: { name: true, reviewDueAt: true },
        });
        const user = await tx.user.findFirst({
          where: { id: ctx.userId, deletedAt: null, twoFactorEnabled: true },
          select: { id: true },
        });
        const memberships = await tx.membership.findMany({
          where: {
            userId: ctx.userId,
            OR: [
              { scope: 'CONFERENCE', conferenceId: ctx.conferenceId },
              { scope: 'ORGANIZATION', organizationId: ctx.organizationId },
            ],
          },
          select: { roles: { select: { role: true } } },
        });
        return conference &&
          user &&
          memberships.some((m) =>
            m.roles.some((r) => ['CHAIR', 'ORGANIZER', 'ORG_ADMIN'].includes(r.role)),
          )
          ? conference
          : null;
      },
      { readOnly: true, timeout: 5000 },
    );
    if (!valid) throw new UnauthorizedException('Invalid API credential');
    const scopes = integrationScopesSchema.safeParse(
      key.scopes.filter((s) => g.scopes.includes(s)),
    );
    if (!scopes.success) throw new UnauthorizedException('Invalid API credential');
    return {
      integrationId: g.id,
      keyId: key.id,
      ...ctx,
      scopes: scopes.data,
      expiresAt: key.expiresAt,
      conferenceName: valid.name,
      conferenceReviewDueAt: valid.reviewDueAt,
    };
  }
  async record(
    p: IntegrationPrincipal,
    requestId: string,
    route: string,
    status: number,
    count: number,
    durationMs: number,
    method = 'GET',
  ) {
    await withTenantContext(p, async (tx) => {
      await this.recordInTransaction(tx, p, requestId, route, status, count, durationMs, method);
    });
  }
  async recordInTransaction(
    tx: Tx,
    p: IntegrationPrincipal,
    requestId: string,
    route: string,
    status: number,
    count: number,
    durationMs: number,
    method = 'GET',
  ) {
    await tx.apiIntegrationAccessLog.create({
      data: {
        id: randomUUID(),
        integrationId: p.integrationId,
        keyId: p.keyId,
        conferenceId: p.conferenceId,
        organizationId: p.organizationId,
        requestId,
        route,
        method,
        status,
        resultCount: count,
        durationMs: Math.max(0, Math.round(durationMs)),
      },
    });
    await tx.apiIntegrationKey.updateMany({
      where: {
        id: p.keyId,
        OR: [{ lastUsedAt: null }, { lastUsedAt: { lt: new Date(Date.now() - 60000) } }],
      },
      data: { lastUsedAt: new Date() },
    });
  }
  async references(p: IntegrationPrincipal, ids: string[]) {
    return withTenantContext(p, async (tx) => {
      await tx.apiIntegrationReviewerReference.createMany({
        data: [...new Set(ids)].map((reviewerUserId) => ({
          id: randomUUID(),
          integrationId: p.integrationId,
          conferenceId: p.conferenceId,
          organizationId: p.organizationId,
          reviewerUserId,
        })),
        skipDuplicates: true,
      });
      return tx.apiIntegrationReviewerReference.findMany({
        where: {
          integrationId: p.integrationId,
          conferenceId: p.conferenceId,
          reviewerUserId: { in: ids },
        },
        select: { id: true, reviewerUserId: true },
      });
    });
  }
}
