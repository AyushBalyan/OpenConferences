import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  newInvitationSecret,
  recordInvitationChange,
  invitationLifecycle,
  type Prisma,
  type ReviewerInvitation,
} from '@openconferences/db';
import { getConfig } from '@openconferences/config/env';
import type { InvitationOperation } from '@openconferences/schemas';
export async function applyInvitationAction(
  tx: Prisma.TransactionClient,
  context: { conferenceId: string; organizationId: string; userId: string },
  id: string,
  input: InvitationOperation,
): Promise<ReviewerInvitation> {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`invitation-changes:${context.conferenceId}`},0))::text`;
  await tx.$queryRaw`SELECT id FROM reviewer_invitations WHERE id=${id}::uuid AND "conferenceId"=${context.conferenceId}::uuid FOR UPDATE`;
  const current = await tx.reviewerInvitation.findFirst({
    where: { id, conferenceId: context.conferenceId },
  });
  if (!current) throw new NotFoundException('Invitation not found');
  if (current.version !== input.version)
    throw new ConflictException('Invitation changed. Refresh and retry.');
  const state = invitationLifecycle(current);
  const conference = await tx.conference.findFirstOrThrow({
    where: { id: context.conferenceId },
    select: { invitationLifetimeDays: true, name: true },
  });
  const expiresAt = new Date(
    Date.now() + (input.lifetimeDays ?? conference.invitationLifetimeDays) * 86400000,
  );
  let row;
  if (input.action === 'REINVITE') {
    if (!['DECLINED', 'REVOKED'].includes(state))
      throw new ConflictException(
        'Only declined or revoked invitations can be explicitly reinvited',
      );
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`reviewer-invite:${context.conferenceId}:${current.email.toLowerCase()}`},0))::text`;
    if (
      await tx.reviewerInvitation.findFirst({
        where: {
          conferenceId: context.conferenceId,
          email: { equals: current.email, mode: 'insensitive' },
          revokedAt: null,
          status: 'PENDING',
          expiresAt: { gt: new Date() },
        },
      })
    )
      throw new ConflictException('An active invitation already exists');
    const recipient = await tx.user.findFirst({
      where: { email: { equals: current.email, mode: 'insensitive' }, deletedAt: null },
      select: { id: true },
    });
    if (
      recipient &&
      (await tx.membership.findFirst({
        where: {
          conferenceId: context.conferenceId,
          userId: recipient.id,
          roles: { some: { role: 'REVIEWER' } },
        },
      }))
    )
      throw new ConflictException('This person already has reviewer access');
    const secret = newInvitationSecret(getConfig().auth.secret);
    row = await tx.reviewerInvitation.create({
      data: {
        id: randomUUID(),
        organizationId: context.organizationId,
        conferenceId: context.conferenceId,
        conferenceName: conference.name,
        email: current.email,
        invitedUserId: recipient?.id ?? null,
        displayName: current.displayName,
        affiliation: current.affiliation,
        researchFields: current.researchFields,
        externalReference: current.externalReference,
        token: secret.token,
        tokenCiphertext: secret.tokenCiphertext,
        sentAt: new Date(),
        expiresAt,
      },
    });
  } else {
    if (['ACCEPTED', 'DECLINED', 'REVOKED'].includes(state))
      throw new ConflictException(`This invitation is ${state.toLowerCase()}`);
    if (
      input.action === 'EXTEND' &&
      (!['SENT', 'PENDING'].includes(state) || expiresAt <= current.expiresAt)
    )
      throw new BadRequestException('Choose a later expiry for an active invitation');
    const secret = input.action === 'REISSUE' ? newInvitationSecret(getConfig().auth.secret) : null;
    row = await tx.reviewerInvitation.update({
      where: { id },
      data: {
        version: { increment: 1 },
        ...(input.action === 'REVOKE'
          ? { revokedAt: new Date(), status: 'EXPIRED' }
          : { expiresAt, status: 'PENDING' }),
        ...(secret
          ? {
              token: secret.token,
              tokenCiphertext: secret.tokenCiphertext,
              reissuedAt: new Date(),
              sentAt: new Date(),
            }
          : {}),
      },
    });
  }
  await recordInvitationChange(tx, row, input.action, context.userId);
  return row;
}
