import { applyInvitationAction } from '../review/invitation-lifecycle';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import {
  withTenantContext,
  invitationLifecycle,
  openInvitationData,
  type Prisma,
} from '@openconferences/db';
import { getConfig } from '@openconferences/config/env';
import {
  type InvitationOperation,
  type IntegrationScope,
  type invitationOperationsQuerySchema,
} from '@openconferences/schemas';
import { z } from 'zod';
import { IntegrationStore, type IntegrationAudit } from './integration.store';
import type { IntegrationPrincipal } from './integration.security';
import { invitationLinks } from '../review/invitation-links';
import { mapOperationalInvitation } from '../review/review.mapper';
const READ: IntegrationScope[] = [
  'invitations:read',
  'reviewers:read',
  'reviewers:identity:read',
  'reviewers:contacts:read',
];
const WRITE: IntegrationScope[] = ['invitations:write', ...READ];
type Query = z.infer<typeof invitationOperationsQuerySchema>;
const STATES = ['PENDING', 'SENT', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'REVOKED'] as const;
function lifecycleFilter(
  state: (typeof STATES)[number],
  now: Date,
): Prisma.ReviewerInvitationWhereInput {
  if (state === 'REVOKED') return { revokedAt: { not: null } };
  if (state === 'ACCEPTED' || state === 'DECLINED') return { revokedAt: null, status: state };
  if (state === 'EXPIRED')
    return {
      revokedAt: null,
      OR: [{ status: 'EXPIRED' }, { status: 'PENDING', expiresAt: { lte: now } }],
    };
  return {
    revokedAt: null,
    status: 'PENDING',
    expiresAt: { gt: now },
    sentAt: state === 'SENT' ? { not: null } : null,
  };
}
@Injectable()
export class InvitationOperationsService {
  constructor(private readonly store: IntegrationStore) {}
  async settings(p: IntegrationPrincipal, lifetimeDays: number, recordAccess?: IntegrationAudit) {
    return withTenantContext(p, async (tx) => {
      await this.store.authorizeOperation(tx, p, WRITE);
      await tx.conference.update({
        where: { id: p.conferenceId },
        data: { invitationLifetimeDays: lifetimeDays, version: { increment: 1 } },
      });
      await tx.auditLog.createMany({
        data: {
          id: randomUUID(),
          actorUserId: p.userId,
          organizationId: p.organizationId,
          conferenceId: p.conferenceId,
          entity: 'Conference',
          entityId: p.conferenceId,
          action: 'reviewer_invitation.default_lifetime_updated',
          diff: { lifetimeDays },
        },
      });
      await recordAccess?.(tx);
      return { lifetimeDays };
    });
  }
  async list(p: IntegrationPrincipal, q: Query) {
    if (q.cursor && !z.string().uuid().safeParse(q.cursor).success)
      throw new BadRequestException('Invalid invitation cursor');
    return withTenantContext(
      p,
      async (tx) => {
        await this.store.authorizeOperation(
          tx,
          p,
          p.scopes.includes('invitations:responses:read')
            ? [...READ, 'invitations:responses:read']
            : READ,
          false,
        );
        const now = new Date();
        const filter: Prisma.ReviewerInvitationWhereInput = {
          conferenceId: p.conferenceId,
          ...(q.email ? { email: { contains: q.email, mode: 'insensitive' } } : {}),
          ...(q.field ? { researchFields: { has: q.field.toLowerCase() } } : {}),
          ...(q.updatedSince ? { updatedAt: { gte: new Date(q.updatedSince) } } : {}),
        };
        // Count in the database; never materialize the full invitation ledger
        // in application memory merely to return a paginated response.
        const counts = Object.fromEntries(
          await Promise.all(
            STATES.map(
              async (state) =>
                [
                  state,
                  await tx.reviewerInvitation.count({
                    where: { AND: [filter, lifecycleFilter(state, now)] },
                  }),
                ] as const,
            ),
          ),
        );
        const rows = await tx.reviewerInvitation.findMany({
          where: {
            AND: [
              filter,
              ...(q.lifecycle ? [lifecycleFilter(q.lifecycle, now)] : []),
              ...(q.cursor ? [{ id: { gt: q.cursor } }] : []),
            ],
          },
          orderBy: { id: 'asc' },
          take: q.limit + 1,
        });
        const page = rows.slice(0, q.limit);
        return {
          data: page.map((row) => ({
            ...mapOperationalInvitation(row, now),
            externalReference: row.externalReference,
            ...(p.scopes.includes('invitations:responses:read')
              ? {
                  declineReason: row.declineReasonEncrypted
                    ? openInvitationData(row.declineReasonEncrypted, getConfig().auth.secret)
                    : null,
                }
              : {}),
          })),
          counts,
          nextCursor: rows.length > q.limit ? page.at(-1)!.id : null,
          observedAt: now.toISOString(),
        };
      },
      { isolationLevel: 'RepeatableRead', timeout: 10000, readOnly: true },
    );
  }
  async changes(p: IntegrationPrincipal, q: Query) {
    if (q.cursor && (!/^\d{1,19}$/.test(q.cursor) || BigInt(q.cursor) > 9223372036854775807n))
      throw new BadRequestException('Invalid change cursor');
    return withTenantContext(p, async (tx) => {
      await this.store.authorizeOperation(tx, p, READ, false);
      const rows = await tx.reviewerInvitationChange.findMany({
        where: { conferenceId: p.conferenceId, sequence: { gt: BigInt(q.cursor ?? '0') } },
        orderBy: { sequence: 'asc' },
        take: q.limit + 1,
      });
      const page = rows.slice(0, q.limit);
      return {
        data: page.map((row) => ({
          cursor: row.sequence.toString(),
          invitationId: row.invitationId,
          action: row.action,
          version: row.version,
          recordedAt: row.createdAt.toISOString(),
        })),
        nextCursor: page.at(-1)?.sequence.toString() ?? q.cursor ?? '0',
        hasMore: rows.length > q.limit,
      };
    });
  }
  async operate(
    p: IntegrationPrincipal,
    id: string,
    input: InvitationOperation,
    recordAccess?: IntegrationAudit,
  ) {
    const hash = createHash('sha256')
      .update(
        JSON.stringify({ operation: 'invitation.lifecycle', id, ...input, requestId: undefined }),
      )
      .digest('hex');
    return withTenantContext(
      p,
      async (tx) => {
        await this.store.authorizeOperation(tx, p, WRITE);
        const prior = await tx.apiIntegrationMutation.findUnique({
          where: {
            integrationId_requestId: { integrationId: p.integrationId, requestId: input.requestId },
          },
        });
        if (prior && prior.payloadHash !== hash)
          throw new ConflictException(
            'requestId was already used with different operation details',
          );
        if (prior) {
          const saved = prior.response as { id: string };
          const row = await tx.reviewerInvitation.findFirst({
            where: { id: saved.id, conferenceId: p.conferenceId },
          });
          if (!row) throw new NotFoundException('Invitation not found');
          await recordAccess?.(tx);
          return {
            invitation: mapOperationalInvitation(row),
            ...(['PENDING', 'SENT'].includes(invitationLifecycle(row)) ? invitationLinks(row) : {}),
            replayed: true,
          };
        }
        const row = await applyInvitationAction(tx, p, id, input);
        await tx.apiIntegrationMutation.create({
          data: {
            id: randomUUID(),
            integrationId: p.integrationId,
            organizationId: p.organizationId,
            conferenceId: p.conferenceId,
            requestId: input.requestId,
            payloadHash: hash,
            response: { id: row.id, operation: 'invitation.lifecycle' },
          },
        });
        await recordAccess?.(tx);
        return {
          invitation: mapOperationalInvitation(row),
          ...(['PENDING', 'SENT'].includes(invitationLifecycle(row)) ? invitationLinks(row) : {}),
          replayed: false,
        };
      },
      { timeout: 10000 },
    );
  }
}
