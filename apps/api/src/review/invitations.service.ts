import { applyInvitationAction } from './invitation-lifecycle';
import type { InvitationOperation } from '@openconferences/schemas';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import type { RoleKind } from '@openconferences/db';
import {
  generateId,
  withTenantContext,
  invitationTokenHash,
  invitationTokenMatches,
  newInvitationSecret,
  recoverInvitationToken,
  recordInvitationChange,
  validDeclineToken,
  invitationLifecycle,
  sealInvitationData,
} from '@openconferences/db';
import type { IssueReviewerInvitationInput } from '@openconferences/schemas';
import { getConfig } from '@openconferences/config/env';
import {
  paginateItems,
  prismaCursorArgs,
  resolveLimit,
  type CursorPaginationOptions,
} from '../common/pagination/cursor';
import { AuditService } from '../audit/audit.service';
import { AuthService } from '../auth/auth.service';
import { ConferenceService } from '../tenancy/conference.service';
import { canManageConferenceReview } from '../tenancy/role-hierarchy';
import { mapReviewerInvitation } from './review.mapper';
import {
  invitationLinks,
  lockInvitationEmails,
  REVIEWER_INVITATION_TTL_DAYS,
} from './invitation-links';

const INVITATION_TTL_DAYS = REVIEWER_INVITATION_TTL_DAYS;

type TenantDb = Parameters<Parameters<typeof withTenantContext>[1]>[0];

@Injectable()
export class InvitationsService {
  constructor(
    private readonly conferences: ConferenceService,
    private readonly audit: AuditService,
    private readonly authService: AuthService,
  ) {}

  async operate(
    userId: string,
    conferenceId: string,
    invitationId: string,
    input: InvitationOperation,
    roles: RoleKind[],
  ) {
    if (!canManageConferenceReview(roles))
      throw new ForbiddenException('Invitation management permission required');
    const conference = await this.conferences.loadConference(userId, conferenceId, roles);
    return withTenantContext(
      { userId, conferenceId, organizationId: conference.organizationId },
      async (tx) => {
        const row = await applyInvitationAction(
          tx,
          { userId, conferenceId, organizationId: conference.organizationId },
          invitationId,
          input,
        );
        return {
          invitation: mapReviewerInvitation(row),
          ...(['PENDING', 'SENT'].includes(invitationLifecycle(row)) ? invitationLinks(row) : {}),
        };
      },
    );
  }

  async list(
    userId: string,
    conferenceId: string,
    roles: RoleKind[],
    options: CursorPaginationOptions & { includeHistory?: 'true' | 'false' } = {},
  ) {
    if (!canManageConferenceReview(roles)) {
      throw new ForbiddenException('Insufficient permissions to list invitations');
    }

    const conference = await this.conferences.loadConference(userId, conferenceId, roles);
    const limit = resolveLimit(options.limit);

    const rows = await withTenantContext(
      { userId, conferenceId, organizationId: conference.organizationId },
      async (tx) =>
        tx.reviewerInvitation.findMany({
          where: {
            conferenceId,
            ...(options.includeHistory === 'true' ? {} : { revokedAt: null }),
          },
          orderBy: { createdAt: 'desc' },
          ...prismaCursorArgs(options, limit),
        }),
    );

    const page = paginateItems(rows, limit, (row) => row.id);

    return {
      data: page.data.map(mapReviewerInvitation),
      nextCursor: page.nextCursor,
    };
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
            revokedAt: null,
            expiresAt: { gt: new Date() },
          },
        }),
    );

    if (existingPending) {
      throw new ConflictException('A pending invitation already exists for this email');
    }

    const existingUser = await withTenantContext({}, async (tx) =>
      tx.user.findFirst({ where: { email: normalizedEmail, deletedAt: null } }),
    );

    const secret = newInvitationSecret(getConfig().auth.secret);
    const token = secret.token;
    const lifetimeDays =
      input.lifetimeDays ?? conference.invitationLifetimeDays ?? INVITATION_TTL_DAYS;
    const expiresAt = new Date(Date.now() + lifetimeDays * 86400000);

    const invitation = await withTenantContext(
      { userId, conferenceId, organizationId: conference.organizationId },
      async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`invitation-changes:${conferenceId}`},0))::text`;
        await lockInvitationEmails(tx, conferenceId, [normalizedEmail]);
        if (
          await tx.reviewerInvitation.findFirst({
            where: {
              conferenceId,
              email: normalizedEmail,
              status: 'PENDING',
              revokedAt: null,
              expiresAt: { gt: new Date() },
            },
          })
        )
          throw new ConflictException('A pending invitation already exists for this email');
        const created = await tx.reviewerInvitation.create({
          data: {
            id: generateId(),
            organizationId: conference.organizationId,
            conferenceId,
            email: normalizedEmail,
            invitedUserId: existingUser?.id ?? null,
            token,
            tokenCiphertext: secret.tokenCiphertext,
            sentAt: new Date(),
            status: 'PENDING',
            expiresAt,
            roleNote: input.roleNote ?? null,
            conferenceName: conference.name,
          },
        });
        await recordInvitationChange(tx, created, 'SENT_LINK_GENERATED', userId);
        return created;
      },
    );

    await this.audit.log({
      actorUserId: userId,
      organizationId: conference.organizationId,
      conferenceId,
      action: 'reviewer_invitation.issued',
      entity: 'ReviewerInvitation',
      entityId: invitation.id,
      diff: { email: normalizedEmail, delivery: input.delivery ?? 'EMAIL' },
    });

    if (input.delivery !== 'LINK_ONLY') {
      try {
        await this.sendInvitationEmail(invitation, conference);
      } catch {
        await this.revoke(userId, conferenceId, invitation.id, roles);
        throw new InternalServerErrorException('Unable to send reviewer invitation email');
      }
    }

    return {
      ...mapReviewerInvitation(invitation),
      ...invitationLinks(invitation),
    };
  }

  async link(userId: string, conferenceId: string, invitationId: string, roles: RoleKind[]) {
    if (!canManageConferenceReview(roles))
      throw new ForbiddenException('Insufficient permissions to access invitation links');
    const conference = await this.conferences.loadConference(userId, conferenceId, roles);
    return withTenantContext(
      { userId, conferenceId, organizationId: conference.organizationId },
      async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`invitation-changes:${conferenceId}`},0))::text`;
        await tx.$queryRaw`SELECT id FROM reviewer_invitations WHERE id=${invitationId}::uuid FOR UPDATE`;
        let row = await tx.reviewerInvitation.findFirst({
          where: { id: invitationId, conferenceId, revokedAt: null },
        });
        if (!row) throw new NotFoundException('Invitation not found');
        if (row.status !== 'PENDING' || row.expiresAt <= new Date())
          throw new ConflictException('Only unexpired pending invitation links can be shared');
        if (!row.sentAt) {
          row = await tx.reviewerInvitation.update({
            where: { id: row.id },
            data: { sentAt: new Date(), version: { increment: 1 } },
          });
          await recordInvitationChange(tx, row, 'SENT_LINK_GENERATED', userId);
        }
        return {
          ...invitationLinks(row),
          email: row.email,
          expiresAt: row.expiresAt.toISOString(),
        };
      },
    );
  }

  async resend(userId: string, conferenceId: string, invitationId: string, roles: RoleKind[]) {
    if (!canManageConferenceReview(roles))
      throw new ForbiddenException('Insufficient permissions to resend invitations');
    const conference = await this.conferences.loadConference(userId, conferenceId, roles);
    const updated = await withTenantContext(
      { userId, conferenceId, organizationId: conference.organizationId },
      async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`invitation-changes:${conferenceId}`},0))::text`;
        await tx.$queryRaw`SELECT id FROM reviewer_invitations WHERE id=${invitationId}::uuid FOR UPDATE`;
        const current = await tx.reviewerInvitation.findFirst({
          where: { id: invitationId, conferenceId },
        });
        if (!current) throw new NotFoundException('Invitation not found');
        if (current.revokedAt || ['ACCEPTED', 'DECLINED'].includes(current.status))
          throw new ConflictException('Cannot resend a closed invitation');
        const row = await tx.reviewerInvitation.update({
          where: { id: current.id },
          data: {
            status: 'PENDING',
            expiresAt: new Date(Date.now() + (conference.invitationLifetimeDays ?? 7) * 86400000),
            sentAt: current.sentAt ?? new Date(),
            version: { increment: 1 },
          },
        });
        await recordInvitationChange(tx, row, 'RESENT', userId);
        return row;
      },
    );
    try {
      await this.sendInvitationEmail(updated, conference);
    } catch {
      throw new InternalServerErrorException('Unable to resend reviewer invitation email');
    }
    return {
      invitation: mapReviewerInvitation(updated),
      message: 'Reviewer invitation email resent',
    };
  }

  async revoke(userId: string, conferenceId: string, invitationId: string, roles: RoleKind[]) {
    if (!canManageConferenceReview(roles))
      throw new ForbiddenException('Insufficient permissions to remove invitations');
    const conference = await this.conferences.loadConference(userId, conferenceId, roles);
    await withTenantContext(
      { userId, conferenceId, organizationId: conference.organizationId },
      async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`invitation-changes:${conferenceId}`},0))::text`;
        await tx.$queryRaw`SELECT id FROM reviewer_invitations WHERE id=${invitationId}::uuid FOR UPDATE`;
        const row = await tx.reviewerInvitation.findFirst({
          where: { id: invitationId, conferenceId },
        });
        if (!row) throw new NotFoundException('Invitation not found');
        if (row.revokedAt) return;
        if (row.status !== 'PENDING')
          throw new ConflictException('Only pending invitations can be removed');
        const updated = await tx.reviewerInvitation.update({
          where: { id: row.id },
          data: { revokedAt: new Date(), status: 'EXPIRED', version: { increment: 1 } },
        });
        await recordInvitationChange(tx, updated, 'REVOKED', userId);
      },
    );
  }

  async accept(userId: string, token: string) {
    const invitation = await this.resolveInvitationByToken(token);
    await this.resolveInvitationUser(userId, invitation.email);
    const updated = await withTenantContext(
      { userId, conferenceId: invitation.conferenceId, organizationId: invitation.organizationId },
      async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`invitation-changes:${invitation.conferenceId}`},0))::text`;
        await tx.$queryRaw`SELECT id FROM reviewer_invitations WHERE id=${invitation.id}::uuid FOR UPDATE`;
        const current = await tx.reviewerInvitation.findUnique({ where: { id: invitation.id } });
        if (!current || !invitationTokenMatches(current, token))
          throw new ConflictException('This invitation link is no longer available');
        if (current.revokedAt) throw new ConflictException('This invitation has been revoked');
        if (current.status === 'ACCEPTED') {
          if (current.invitedUserId !== userId)
            throw new ConflictException('Invitation was accepted by another account');
          // A replay must not restore reviewer access deliberately removed later.
          return current;
        }
        if (current.status === 'DECLINED')
          throw new ConflictException('This invitation has already been declined');
        if (current.status !== 'PENDING' || current.expiresAt <= new Date())
          throw new ConflictException('This invitation has expired');
        await this.materializeReviewerMembership(userId, current, tx);
        const row = await tx.reviewerInvitation.update({
          where: { id: current.id },
          data: {
            status: 'ACCEPTED',
            invitedUserId: userId,
            acceptedAt: new Date(),
            version: { increment: 1 },
          },
        });
        await recordInvitationChange(tx, row, 'ACCEPTED', userId);
        return row;
      },
    );
    return { invitation: mapReviewerInvitation(updated), message: 'Reviewer invitation accepted' };
  }

  async acceptPendingForUser(userId: string) {
    const user = await withTenantContext({ userId }, async (tx) =>
      tx.user.findFirst({ where: { id: userId, deletedAt: null } }),
    );

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const normalizedEmail = user.email.trim().toLowerCase();
    const pending = await withTenantContext({}, async (tx) =>
      tx.reviewerInvitation.findMany({
        where: {
          email: normalizedEmail,
          status: 'PENDING',
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: 'asc' },
      }),
    );

    const accepted = [];
    for (const invitation of pending) {
      const result = await this.accept(
        userId,
        recoverInvitationToken(invitation, getConfig().auth.secret),
      );
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
    if (userId) await this.resolveInvitationUser(userId, invitation.email);
    const updated = await withTenantContext(
      {
        userId: userId ?? undefined,
        conferenceId: invitation.conferenceId,
        organizationId: invitation.organizationId,
      },
      async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`invitation-changes:${invitation.conferenceId}`},0))::text`;
        await tx.$queryRaw`SELECT id FROM reviewer_invitations WHERE id=${invitation.id}::uuid FOR UPDATE`;
        const row = await tx.reviewerInvitation.findUnique({ where: { id: invitation.id } });
        if (!row || !invitationTokenMatches(row, token))
          throw new ConflictException('This invitation link is no longer available');
        if (!['PENDING', 'SENT'].includes(invitationLifecycle(row)))
          throw new ConflictException(
            `This invitation is ${invitationLifecycle(row).toLowerCase()}`,
          );
        const result = await tx.reviewerInvitation.update({
          where: { id: row.id },
          data: { status: 'DECLINED', declinedAt: new Date(), version: { increment: 1 } },
        });
        await recordInvitationChange(tx, result, 'DECLINED', userId);
        return result;
      },
    );
    return { invitation: mapReviewerInvitation(updated), message: 'Reviewer invitation declined' };
  }

  async publicDecline(token: string, confirm: boolean, reason?: string) {
    const id = token.split('.')[0] ?? '';
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
      return { state: 'INVALID', conferenceName: null };
    return withTenantContext({}, async (tx) => {
      let row = await tx.reviewerInvitation.findUnique({ where: { id } });
      if (confirm && row && validDeclineToken(row, token, getConfig().auth.secret)) {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`invitation-changes:${row.conferenceId}`},0))::text`;
        await tx.$queryRaw`SELECT id FROM reviewer_invitations WHERE id=${id}::uuid FOR UPDATE`;
        row = await tx.reviewerInvitation.findUnique({ where: { id } });
      }
      if (!row || !validDeclineToken(row, token, getConfig().auth.secret))
        return { state: 'INVALID', conferenceName: null };
      const state = invitationLifecycle(row);
      if (!confirm || !['PENDING', 'SENT'].includes(state))
        return { state, conferenceName: row.conferenceName ?? 'the conference' };
      // Token authorizes only this decline, independent of any signed-in account.
      const updated = await tx.reviewerInvitation.update({
        where: { id },
        data: {
          status: 'DECLINED',
          declinedAt: new Date(),
          declineReasonEncrypted: reason?.trim()
            ? sealInvitationData(reason.trim(), getConfig().auth.secret)
            : null,
          version: { increment: 1 },
        },
      });
      // Establish conference context after validating the token, for the append-only change policy.
      await tx.$executeRaw`SELECT set_config('app.current_conference_id', ${row.conferenceId}, true)`;
      await recordInvitationChange(tx, updated, 'DECLINED');
      return {
        state: 'DECLINED',
        conferenceName: row.conferenceName ?? 'the conference',
        confirmed: true,
      };
    });
  }

  private async resolveInvitationUser(userId: string, invitedEmail: string) {
    const user = await withTenantContext({ userId }, async (tx) =>
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
      },
      apply,
    );
  }

  private async sendInvitationEmail(
    invitation: {
      id: string;
      email: string;
      token: string;
      tokenCiphertext?: string | null;
      expiresAt: Date;
    },
    conference: { id: string; organizationId: string; name: string },
  ): Promise<void> {
    const config = getConfig();
    const rawToken = recoverInvitationToken(invitation, config.auth.secret);
    const callbackURL = new URL('/join/reviewer/complete', config.webUrl);
    callbackURL.searchParams.set('invitationToken', rawToken);
    const errorCallbackURL = new URL('/join/reviewer/error', config.webUrl);

    await this.authService.signInMagicLink({
      email: invitation.email,
      name: invitation.email.split('@')[0] ?? 'Reviewer',
      callbackURL: callbackURL.toString(),
      errorCallbackURL: errorCallbackURL.toString(),
      metadata: {
        reviewerInvitationId: invitation.id,
        invitationToken: rawToken,
        declineUrl: invitationLinks(invitation).declineUrl,
        conferenceId: conference.id,
        organizationId: conference.organizationId,
        conferenceName: conference.name,
        expiresAt: invitation.expiresAt.toISOString(),
      },
    });
  }

  private async resolveInvitationByToken(token: string) {
    const invitation = await withTenantContext({}, async (tx) =>
      tx.reviewerInvitation.findFirst({
        where: { OR: [{ token }, { token: invitationTokenHash(token) }] },
      }),
    );

    if (!invitation || !invitationTokenMatches(invitation, token)) {
      throw new NotFoundException('Invitation not found');
    }

    return invitation;
  }
}
