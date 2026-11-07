import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  withTenantContext,
  sealInvitationData,
  openInvitationData,
  invitationLifecycle,
  type InvitationBatchResult,
} from '@openconferences/db';
import type { BulkInvitationInput, IntegrationScope } from '@openconferences/schemas';
import { getConfig } from '@openconferences/config/env';
import { IntegrationStore, type IntegrationAudit } from './integration.store';
import { QueueService } from '../queue/queue.service';
import { integrationPayloadHash, type IntegrationPrincipal } from './integration.security';
import { invitationLinks } from '../review/invitation-links';
const READ: IntegrationScope[] = [
  'invitations:read',
  'reviewers:read',
  'reviewers:identity:read',
  'reviewers:contacts:read',
];
@Injectable()
export class InvitationBatchService {
  constructor(
    private readonly store: IntegrationStore,
    private readonly queue: QueueService,
  ) {}
  async submit(
    p: IntegrationPrincipal,
    input: BulkInvitationInput,
    recordAccess?: IntegrationAudit,
  ) {
    const hash = integrationPayloadHash({ ...input, requestId: undefined });
    return withTenantContext(
      p,
      async (tx) => {
        await this.store.authorizeOperation(tx, p, ['invitations:write', ...READ]);
        const prior = await tx.reviewerInvitationBatch.findUnique({
          where: {
            integrationId_requestId: { integrationId: p.integrationId, requestId: input.requestId },
          },
        });
        if (prior) {
          if (prior.payloadHash !== hash)
            throw new ConflictException('requestId was already used with different batch details');
          await recordAccess?.(tx);
          return { id: prior.id, status: prior.status, total: prior.total, replayed: true };
        }
        const conference = await tx.conference.findFirstOrThrow({
          where: { id: p.conferenceId },
          select: { invitationLifetimeDays: true },
        });
        const batch = await tx.reviewerInvitationBatch.create({
          data: {
            id: randomUUID(),
            integrationId: p.integrationId,
            keyId: p.keyId,
            organizationId: p.organizationId,
            conferenceId: p.conferenceId,
            requestId: input.requestId,
            payloadHash: hash,
            total: input.rows.length,
            expiresAt: new Date(Date.now() + 7 * 86400000),
            inputEncrypted: sealInvitationData(
              JSON.stringify({
                rows: input.rows,
                lifetimeDays: input.lifetimeDays ?? conference.invitationLifetimeDays,
              }),
              getConfig().auth.secret,
            ),
          },
        });
        if (!(await this.queue.enqueueInvitationBatch(batch.id, tx)))
          throw new Error('Invitation batch queue is unavailable');
        await tx.auditLog.createMany({
          data: {
            id: randomUUID(),
            organizationId: p.organizationId,
            conferenceId: p.conferenceId,
            actorUserId: p.userId,
            entity: 'ReviewerInvitationBatch',
            entityId: batch.id,
            action: 'reviewer_invitation.batch_submitted',
            diff: { total: batch.total },
          },
        });
        await recordAccess?.(tx);
        return { id: batch.id, status: batch.status, total: batch.total, replayed: false };
      },
      { timeout: 10000 },
    );
  }
  async status(p: IntegrationPrincipal, id: string) {
    return withTenantContext(p, async (tx) => {
      await this.store.authorizeOperation(tx, p, READ, false);
      const row = await tx.reviewerInvitationBatch.findFirst({
        where: { id, integrationId: p.integrationId, conferenceId: p.conferenceId },
      });
      if (!row) throw new NotFoundException('Batch not found');
      return {
        id: row.id,
        status: row.status,
        total: row.total,
        processed: row.processed,
        createdAt: row.createdAt.toISOString(),
        resultsExpireAt: row.expiresAt.toISOString(),
      };
    });
  }
  async results(p: IntegrationPrincipal, id: string, query: { offset: number; limit: number }) {
    return withTenantContext(
      p,
      async (tx) => {
        await this.store.authorizeOperation(tx, p, READ, false);
        const batch = await tx.reviewerInvitationBatch.findFirst({
          where: { id, integrationId: p.integrationId, conferenceId: p.conferenceId },
        });
        if (!batch) throw new NotFoundException('Batch not found');
        const available = batch.expiresAt > new Date() && !!batch.inputEncrypted;
        const input = available
          ? (JSON.parse(openInvitationData(batch.inputEncrypted, getConfig().auth.secret)) as {
              rows: unknown[];
            })
          : null;
        const page = (batch.results as InvitationBatchResult[]).slice(
          query.offset,
          query.offset + query.limit,
        );
        const rows = await tx.reviewerInvitation.findMany({
          where: {
            conferenceId: p.conferenceId,
            id: { in: page.flatMap((row) => (row.invitationId ? [row.invitationId] : [])) },
          },
        });
        return {
          id,
          status: batch.status,
          total: batch.total,
          processed: batch.processed,
          resultsExpired: !available,
          nextOffset:
            query.offset + page.length < batch.processed ? query.offset + page.length : null,
          data: page.map(({ generation, ...row }) => {
            const invitation = rows.find((candidate) => candidate.id === row.invitationId);
            const links =
              available &&
              row.outcome === 'CREATED' &&
              invitation &&
              invitation.token === generation &&
              ['SENT', 'PENDING'].includes(invitationLifecycle(invitation))
                ? invitationLinks(invitation)
                : { invitationUrl: null, declineUrl: null };
            return { ...row, ...(input ? { input: input.rows[row.row - 1] } : {}), ...links };
          }),
        };
      },
      { timeout: 10000 },
    );
  }
}
