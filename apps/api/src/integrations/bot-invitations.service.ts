import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, withTenantContext } from '@openconferences/db';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { z } from 'zod';
import type { BotGenerateInvitations, IntegrationScope } from '@openconferences/schemas';
import { botInvitationLinkSchema } from '@openconferences/schemas';
import {
  lockInvitationEmails,
  reviewerInvitationUrl,
  REVIEWER_INVITATION_TTL_DAYS,
} from '../review/invitation-links';
import { IntegrationStore } from './integration.store';
import type { IntegrationPrincipal } from './integration.security';

const READ: IntegrationScope[] = [
  'invitations:read',
  'reviewers:read',
  'reviewers:identity:read',
  'reviewers:contacts:read',
];
const WRITE: IntegrationScope[] = ['invitations:write', ...READ];
const route = '/integrations/v1/conferences/:conferenceId/reviewer-invitations';
const generated = z
  .object({ operation: z.literal('invitations.generate'), ids: z.array(z.string().uuid()) })
  .strict();
const removed = z
  .object({ operation: z.literal('invitations.remove'), id: z.string().uuid() })
  .strict();
type Tx = Prisma.TransactionClient;

@Injectable()
export class BotInvitationsService {
  constructor(private readonly store: IntegrationStore) {}

  private async render(tx: Tx, p: IntegrationPrincipal, ids: string[], emails: string[]) {
    const rows = await tx.reviewerInvitation.findMany({
      where: { conferenceId: p.conferenceId, id: { in: ids } },
      select: { id: true, email: true, token: true, status: true, expiresAt: true },
    });
    const byId = new Map(rows.map((i) => [i.id, i]));
    return ids.map((id, index) => {
      const i = byId.get(id);
      const status = !i
        ? ('REMOVED' as const)
        : i.status === 'PENDING' && i.expiresAt <= new Date()
          ? ('EXPIRED' as const)
          : i.status;
      return botInvitationLinkSchema.parse({
        id,
        email: i?.email ?? emails[index],
        status,
        expiresAt: i?.expiresAt.toISOString() ?? null,
        invitationUrl: i && status === 'PENDING' ? reviewerInvitationUrl(i.token) : null,
      });
    });
  }

  async link(p: IntegrationPrincipal, invitationId: string) {
    return withTenantContext(
      p,
      async (tx) => {
        await tx.$executeRaw`SET LOCAL statement_timeout = '3s'`;
        await this.store.authorizeOperation(tx, p, READ, false);
        const invitation = await tx.reviewerInvitation.findFirst({
          where: { id: invitationId, conferenceId: p.conferenceId },
          select: { email: true },
        });
        if (!invitation) throw new NotFoundException('Invitation not found');
        const result = (await this.render(tx, p, [invitationId], [invitation.email]))[0]!;
        if (result.status !== 'PENDING')
          throw new ConflictException('Only unexpired pending invitation links can be shared');
        return result;
      },
      { readOnly: true, timeout: 5000, isolationLevel: 'RepeatableRead' },
    );
  }

  async generate(
    p: IntegrationPrincipal,
    input: BotGenerateInvitations,
    accessId: string,
    start: number,
  ) {
    const emails = [...new Set(input.emails.map((e) => e.trim().toLowerCase()))].sort();
    const payloadHash = createHash('sha256')
      .update(JSON.stringify({ operation: 'invitations.generate', emails }))
      .digest('hex');
    return withTenantContext(
      p,
      async (tx) => {
        await tx.$executeRaw`SET LOCAL statement_timeout = '3s'`;
        await this.store.authorizeOperation(tx, p, WRITE);
        const prior = await tx.apiIntegrationMutation.findUnique({
          where: {
            integrationId_requestId: { integrationId: p.integrationId, requestId: input.requestId },
          },
        });
        let ids: string[];
        if (prior) {
          if (prior.payloadHash !== payloadHash)
            throw new ConflictException(
              'requestId was already used with different operation details',
            );
          ids = generated.parse(prior.response).ids;
        } else {
          await lockInvitationEmails(tx, p.conferenceId, emails);
          const now = new Date();
          const pending = await tx.reviewerInvitation.findMany({
            where: {
              conferenceId: p.conferenceId,
              email: { in: emails, mode: 'insensitive' },
              status: 'PENDING',
              expiresAt: { gt: now },
            },
            orderBy: { createdAt: 'desc' },
            select: { id: true, email: true },
          });
          const current = new Map<string, string>();
          for (const i of pending)
            if (!current.has(i.email.toLowerCase())) current.set(i.email.toLowerCase(), i.id);
          const users = await tx.user.findMany({
            where: { email: { in: emails, mode: 'insensitive' }, deletedAt: null },
            select: { id: true, email: true },
          });
          const byEmail = new Map(users.map((u) => [u.email.toLowerCase(), u.id]));
          ids = [];
          for (const email of emails) {
            const existing = current.get(email);
            if (existing) {
              ids.push(existing);
              continue;
            }
            const invitation = await tx.reviewerInvitation.create({
              data: {
                id: randomUUID(),
                organizationId: p.organizationId,
                conferenceId: p.conferenceId,
                email,
                invitedUserId: byEmail.get(email) ?? null,
                token: randomBytes(32).toString('hex'),
                status: 'PENDING',
                expiresAt: new Date(now.getTime() + REVIEWER_INVITATION_TTL_DAYS * 86400000),
              },
              select: { id: true },
            });
            ids.push(invitation.id);
            await this.audit(tx, p, invitation.id, input.requestId, 'generated');
          }
          // Store references only. Never persist live invitation URLs, tokens or email addresses here.
          await tx.apiIntegrationMutation.create({
            data: {
              id: randomUUID(),
              integrationId: p.integrationId,
              organizationId: p.organizationId,
              conferenceId: p.conferenceId,
              requestId: input.requestId,
              payloadHash,
              response: { operation: 'invitations.generate', ids },
            },
          });
        }
        const data = await this.render(tx, p, ids, emails);
        await this.store.recordInTransaction(
          tx,
          p,
          accessId,
          route,
          201,
          data.length,
          performance.now() - start,
          'POST',
        );
        return {
          data,
          replayed: !!prior,
          message: prior
            ? 'Original invitation request replayed. Only pending links remain available.'
            : 'Invitation links generated. No emails sent.',
        };
      },
      { timeout: 5000 },
    );
  }

  async remove(
    p: IntegrationPrincipal,
    invitationId: string,
    requestId: string,
    accessId: string,
    start: number,
  ) {
    const payloadHash = createHash('sha256')
      .update(JSON.stringify({ operation: 'invitations.remove', invitationId }))
      .digest('hex');
    return withTenantContext(
      p,
      async (tx) => {
        await tx.$executeRaw`SET LOCAL statement_timeout = '3s'`;
        await this.store.authorizeOperation(tx, p, WRITE);
        const prior = await tx.apiIntegrationMutation.findUnique({
          where: { integrationId_requestId: { integrationId: p.integrationId, requestId } },
        });
        if (prior) {
          if (
            prior.payloadHash !== payloadHash ||
            removed.parse(prior.response).id !== invitationId
          )
            throw new ConflictException(
              'requestId was already used with different operation details',
            );
        } else {
          await tx.$queryRaw`SELECT id FROM reviewer_invitations WHERE id=${invitationId}::uuid AND "conferenceId"=${p.conferenceId}::uuid FOR UPDATE`;
          const invitation = await tx.reviewerInvitation.findFirst({
            where: { id: invitationId, conferenceId: p.conferenceId },
            select: { status: true },
          });
          if (!invitation) throw new NotFoundException('Invitation not found');
          if (invitation.status !== 'PENDING')
            throw new ConflictException('Only pending invitations can be removed');
          const deleted = await tx.reviewerInvitation.deleteMany({
            where: { id: invitationId, conferenceId: p.conferenceId, status: 'PENDING' },
          });
          if (deleted.count !== 1)
            throw new ConflictException('Invitation changed. Refresh and retry.');
          await this.audit(tx, p, invitationId, requestId, 'removed');
          await tx.apiIntegrationMutation.create({
            data: {
              id: randomUUID(),
              integrationId: p.integrationId,
              organizationId: p.organizationId,
              conferenceId: p.conferenceId,
              requestId,
              payloadHash,
              response: { operation: 'invitations.remove', id: invitationId },
            },
          });
        }
        await this.store.recordInTransaction(
          tx,
          p,
          accessId,
          route + '/:invitationId',
          200,
          1,
          performance.now() - start,
          'DELETE',
        );
        return {
          id: invitationId,
          removed: true as const,
          replayed: !!prior,
          message: 'Invitation removed. Its link can no longer be accepted.',
        };
      },
      { timeout: 5000 },
    );
  }
  private async audit(
    tx: Tx,
    p: IntegrationPrincipal,
    id: string,
    requestId: string,
    action: string,
  ) {
    await tx.auditLog.create({
      data: {
        id: randomUUID(),
        actorUserId: p.userId,
        organizationId: p.organizationId,
        conferenceId: p.conferenceId,
        action: `integration.invitation.${action}`,
        entity: 'ReviewerInvitation',
        entityId: id,
        diff: { integrationId: p.integrationId, keyId: p.keyId, requestId },
      },
    });
  }
}
