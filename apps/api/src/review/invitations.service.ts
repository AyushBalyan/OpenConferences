import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { RoleKind } from '@openconferences/db';
import { generateId, withTenantContext } from '@openconferences/db';
import type { IssueReviewerInvitationInput } from '@openconferences/schemas';
import { getConfig } from '@openconferences/config/env';
import { randomBytes } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import { NotificationPublisher } from '../messaging/notification.publisher';
import { ConferenceService } from '../tenancy/conference.service';
import { canManageConferenceReview } from '../tenancy/role-hierarchy';
import { mapReviewerInvitation } from './review.mapper';

const INVITATION_TTL_DAYS = 7;

type TenantDb = Parameters<Parameters<typeof withTenantContext>[1]>[0];

@Injectable()
export class InvitationsService {
  constructor(
    private readonly conferences: ConferenceService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationPublisher,
  ) {}

  async list(userId: string, conferenceId: string, roles: RoleKind[]) {
    if (!canManageConferenceReview(roles)) {
      throw new ForbiddenException('Insufficient permissions to list invitations');
    }

    const conference = await this.conferences.loadConference(userId, conferenceId, roles);

    const invitations = await withTenantContext(
      { userId, conferenceId, organizationId: conference.organizationId },
      async (tx) =>
        tx.reviewerInvitation.findMany({
          where: { conferenceId },
          orderBy: { createdAt: 'desc' },
        }),
    );

    return { data: invitations.map(mapReviewerInvitation) };
  }

  async issue(
    userId: string,
    conferenceId: string,
    input: IssueReviewerInvitationInput,
    roles: RoleKind[],
  ) {
    if (!canManageConferenceReview(roles)) {
      throw new ForbiddenException('Insufficient permissions to issue invitations');
    }

    const conference = await this.conferences.loadConference(userId, conferenceId, roles);
    const normalizedEmail = input.email.trim().toLowerCase();

    const existingPending = await withTenantContext(
      { userId, conferenceId, organizationId: conference.organizationId },
      async (tx) =>
        tx.reviewerInvitation.findFirst({
          where: {
            conferenceId,
            email: normalizedEmail,
            status: 'PENDING',
            expiresAt: { gt: new Date() },
          },
        }),
    );

    if (existingPending) {
      throw new ConflictException('A pending invitation already exists for this email');
    }

    const existingUser = await withTenantContext({ bypass: true }, async (tx) =>
      tx.user.findFirst({ where: { email: normalizedEmail, deletedAt: null } }),
    );

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);

    const invitation = await withTenantContext(
      { userId, conferenceId, organizationId: conference.organizationId, bypass: true },
      async (tx) =>
        tx.reviewerInvitation.create({
          data: {
            id: generateId(),
            organizationId: conference.organizationId,
            conferenceId,
            email: normalizedEmail,
            invitedUserId: existingUser?.id ?? null,
            token,
            status: 'PENDING',
            expiresAt,
            roleNote: input.roleNote ?? null,
          },
        }),
    );

    await this.audit.log({
      actorUserId: userId,
      organizationId: conference.organizationId,
      conferenceId,
      action: 'reviewer_invitation.issued',
      entity: 'ReviewerInvitation',
      entityId: invitation.id,
      diff: { email: normalizedEmail },
    });

    const signupUrl = new URL('/sign-up', getConfig().webUrl);
    signupUrl.searchParams.set('reviewerInvite', token);
    signupUrl.searchParams.set('email', normalizedEmail);

    await this.notifications.publishReviewerInvitation({
      to: normalizedEmail,
      conferenceId,
      organizationId: conference.organizationId,
      conferenceName: conference.name,
      signupUrl: signupUrl.toString(),
      expiresAt: expiresAt.toISOString(),
      invitationId: invitation.id,
      idempotencyKey: `reviewer-invite-${invitation.id}`,
    });

    return mapReviewerInvitation(invitation);
  }

  async accept(userId: string, token: string) {
    const invitation = await this.resolveInvitationByToken(token);
    await this.resolveInvitationUser(userId, invitation.email);

    if (invitation.status === 'ACCEPTED') {
      if (invitation.invitedUserId && invitation.invitedUserId !== userId) {
        throw new ConflictException('Invitation was accepted by another account');
      }

      await this.materializeReviewerMembership(userId, invitation);
      const current = await withTenantContext({ bypass: true }, async (tx) =>
        tx.reviewerInvitation.findUniqueOrThrow({ where: { id: invitation.id } }),
      );

      return {
        invitation: mapReviewerInvitation(current),
        message: 'Reviewer invitation already accepted',
      };
    }

    if (invitation.status !== 'PENDING') {
      throw new ConflictException('Invitation is no longer pending');
    }

    if (invitation.expiresAt < new Date()) {
      await withTenantContext({ bypass: true }, async (tx) =>
        tx.reviewerInvitation.update({
          where: { id: invitation.id },
          data: { status: 'EXPIRED' },
        }),
      );
      throw new ConflictException('Invitation has expired');
    }

    await withTenantContext(
      {
        userId,
        conferenceId: invitation.conferenceId,
        organizationId: invitation.organizationId,
        bypass: true,
      },
      async (tx) => {
        await this.materializeReviewerMembership(userId, invitation, tx);

        await tx.reviewerInvitation.update({
          where: { id: invitation.id },
          data: {
            status: 'ACCEPTED',
            invitedUserId: userId,
          },
        });
      },
    );

    const updated = await withTenantContext({ bypass: true }, async (tx) =>
      tx.reviewerInvitation.findUniqueOrThrow({ where: { id: invitation.id } }),
    );

    await this.audit.log({
      actorUserId: userId,
      organizationId: invitation.organizationId,
      conferenceId: invitation.conferenceId,
      action: 'reviewer_invitation.accepted',
      entity: 'ReviewerInvitation',
      entityId: invitation.id,
    });

    return {
      invitation: mapReviewerInvitation(updated),
      message: 'Reviewer invitation accepted',
    };
  }

  async acceptPendingForUser(userId: string) {
    const user = await withTenantContext({ userId, bypass: true }, async (tx) =>
      tx.user.findFirst({ where: { id: userId, deletedAt: null } }),
    );

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const normalizedEmail = user.email.trim().toLowerCase();
    const pending = await withTenantContext({ bypass: true }, async (tx) =>
      tx.reviewerInvitation.findMany({
        where: {
          email: normalizedEmail,
          status: 'PENDING',
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: 'asc' },
      }),
    );

    const accepted = [];
    for (const invitation of pending) {
      const result = await this.accept(userId, invitation.token);
      accepted.push(result.invitation);
    }

    return {
      data: accepted,
      message:
        accepted.length > 0
          ? `Accepted ${accepted.length} reviewer invitation${accepted.length === 1 ? '' : 's'}`
          : 'No pending reviewer invitations',
    };
  }

  async decline(userId: string | null, token: string) {
    const invitation = await this.resolveInvitationByToken(token);

    if (invitation.status !== 'PENDING') {
      throw new ConflictException('Invitation is no longer pending');
    }

    if (invitation.expiresAt < new Date()) {
      await withTenantContext({ bypass: true }, async (tx) =>
        tx.reviewerInvitation.update({
          where: { id: invitation.id },
          data: { status: 'EXPIRED' },
        }),
      );
      throw new ConflictException('Invitation has expired');
    }

    if (userId) {
      const user = await withTenantContext({ userId, bypass: true }, async (tx) =>
        tx.user.findFirst({ where: { id: userId } }),
      );
      if (user && user.email.toLowerCase() !== invitation.email.toLowerCase()) {
        throw new ForbiddenException('Invitation email does not match your account');
      }
    }

    const updated = await withTenantContext({ bypass: true }, async (tx) =>
      tx.reviewerInvitation.update({
        where: { id: invitation.id },
        data: { status: 'DECLINED', invitedUserId: userId ?? invitation.invitedUserId },
      }),
    );

    await this.audit.log({
      actorUserId: userId,
      organizationId: invitation.organizationId,
      conferenceId: invitation.conferenceId,
      action: 'reviewer_invitation.declined',
      entity: 'ReviewerInvitation',
      entityId: invitation.id,
    });

    return {
      invitation: mapReviewerInvitation(updated),
      message: 'Reviewer invitation declined',
    };
  }

  private async resolveInvitationUser(userId: string, invitedEmail: string) {
    const user = await withTenantContext({ userId, bypass: true }, async (tx) =>
      tx.user.findFirst({ where: { id: userId, deletedAt: null } }),
    );

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.email.toLowerCase() !== invitedEmail.toLowerCase()) {
      throw new ForbiddenException('Invitation email does not match your account');
    }

    return user;
  }

  private async materializeReviewerMembership(
    userId: string,
    invitation: { conferenceId: string; organizationId: string },
    tx?: TenantDb,
  ) {
    const apply = async (client: TenantDb) => {
      const membership = await client.membership.findFirst({
        where: {
          userId,
          conferenceId: invitation.conferenceId,
          scope: 'CONFERENCE',
        },
        include: { roles: true },
      });

      if (membership) {
        const hasReviewer = membership.roles.some((r) => r.role === 'REVIEWER');
        if (!hasReviewer) {
          await client.roleGrant.create({
            data: {
              id: generateId(),
              membershipId: membership.id,
              role: 'REVIEWER',
            },
          });
        }
        return;
      }

      await client.membership.create({
        data: {
          id: generateId(),
          userId,
          organizationId: invitation.organizationId,
          conferenceId: invitation.conferenceId,
          scope: 'CONFERENCE',
          roles: {
            create: { id: generateId(), role: 'REVIEWER' },
          },
        },
      });
    };

    if (tx) {
      await apply(tx);
      return;
    }

    await withTenantContext(
      {
        userId,
        conferenceId: invitation.conferenceId,
        organizationId: invitation.organizationId,
        bypass: true,
      },
      apply,
    );
  }

  private async resolveInvitationByToken(token: string) {
    const invitation = await withTenantContext({ bypass: true }, async (tx) =>
      tx.reviewerInvitation.findFirst({ where: { token } }),
    );

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    return invitation;
  }
}
