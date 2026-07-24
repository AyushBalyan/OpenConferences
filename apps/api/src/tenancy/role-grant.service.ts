import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { MembershipScope, RoleKind } from '@openconferences/db';
import { generateId, withTenantContext } from '@openconferences/db';
import type { GrantRoleInput, RevokeRoleInput } from '@openconferences/schemas';
import { AuditService } from '../audit/audit.service';
import { ConferenceService } from './conference.service';
import { canGrantRole, maxRoleRank } from './role-hierarchy';
import {
  paginateItems,
  prismaCursorArgs,
  resolveLimit,
  type CursorPaginationOptions,
} from '../common/pagination/cursor';

export type MemberDto = {
  userId: string;
  email: string;
  name: string;
  scope: MembershipScope;
  roles: RoleKind[];
  membershipId: string;
};

@Injectable()
export class RoleGrantService {
  constructor(
    private readonly audit: AuditService,
    private readonly conferenceService: ConferenceService,
  ) {}

  async listMembers(
    userId: string,
    conferenceId: string,
    userRoles: RoleKind[],
    options: CursorPaginationOptions = {},
  ): Promise<{ data: MemberDto[]; nextCursor: string | null }> {
    const conference = await this.conferenceService.loadConference(userId, conferenceId, userRoles);
    const limit = resolveLimit(options.limit);

    const memberships = await withTenantContext(
      {
        userId,
        organizationId: conference.organizationId,
        conferenceId,
      },
      async (tx) =>
        tx.membership.findMany({
          where: {
            OR: [
              { conferenceId, scope: 'CONFERENCE' },
              { organizationId: conference.organizationId, scope: 'ORGANIZATION' },
            ],
          },
          include: {
            roles: true,
            user: { select: { id: true, email: true, name: true } },
          },
          orderBy: { createdAt: 'asc' },
          ...prismaCursorArgs(options, limit),
        }),
    );

    const page = paginateItems(memberships, limit, (membership) => membership.id);
    return {
      data: page.data.map((membership) => ({
        userId: membership.userId,
        email: membership.user.email,
        name: membership.user.name,
        scope: membership.scope,
        roles: membership.roles.map((grant) => grant.role),
        membershipId: membership.id,
      })),
      nextCursor: page.nextCursor,
    };
  }

  async grantRole(
    actorUserId: string,
    conferenceId: string,
    input: GrantRoleInput,
    grantorRoles: RoleKind[],
  ): Promise<{ data: MemberDto[]; nextCursor: string | null }> {
    if (maxRoleRank(grantorRoles) < maxRoleRank(['ORGANIZER'])) {
      throw new ForbiddenException('Insufficient permissions to grant roles');
    }

    if (!canGrantRole(grantorRoles, input.role)) {
      throw new ForbiddenException(
        'Cannot grant a role equal to or above your own privilege level',
      );
    }

    const conference = await this.conferenceService.loadConference(
      actorUserId,
      conferenceId,
      grantorRoles,
    );

    const targetUser = await withTenantContext({}, async (tx) =>
      tx.user.findFirst({
        where: { id: input.userId, deletedAt: null },
      }),
    );

    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    const membership = await this.findOrCreateMembership(
      actorUserId,
      conference.organizationId,
      conferenceId,
      input.userId,
      input.scope,
      grantorRoles,
    );

    const existingGrant = membership.roles.find((grant) => grant.role === input.role);
    if (existingGrant) {
      throw new ConflictException('Role already granted');
    }

    await withTenantContext(
      {
        userId: actorUserId,
        organizationId: conference.organizationId,
        conferenceId,
      },
      async (tx) =>
        tx.roleGrant.create({
          data: {
            id: generateId(),
            membershipId: membership.id,
            role: input.role,
          },
        }),
    );

    await this.audit.log({
      actorUserId,
      organizationId: conference.organizationId,
      conferenceId: input.scope === 'CONFERENCE' ? conferenceId : null,
      action: 'role.granted',
      entity: 'role_grant',
      entityId: membership.id,
      diff: { userId: input.userId, role: input.role, scope: input.scope },
    });

    return this.listMembers(actorUserId, conferenceId, grantorRoles);
  }

  async revokeRole(
    actorUserId: string,
    conferenceId: string,
    input: RevokeRoleInput,
    grantorRoles: RoleKind[],
  ): Promise<{ data: MemberDto[]; nextCursor: string | null }> {
    if (maxRoleRank(grantorRoles) < maxRoleRank(['ORGANIZER'])) {
      throw new ForbiddenException('Insufficient permissions to revoke roles');
    }

    if (!canGrantRole(grantorRoles, input.role)) {
      throw new ForbiddenException(
        'Cannot revoke a role equal to or above your own privilege level',
      );
    }

    const conference = await this.conferenceService.loadConference(
      actorUserId,
      conferenceId,
      grantorRoles,
    );

    const membership = await withTenantContext(
      {
        userId: actorUserId,
        organizationId: conference.organizationId,
        conferenceId,
      },
      async (tx) =>
        tx.membership.findFirst({
          where: {
            userId: input.userId,
            scope: input.scope,
            organizationId: conference.organizationId,
            conferenceId: input.scope === 'CONFERENCE' ? conferenceId : null,
          },
          include: { roles: true },
        }),
    );

    if (!membership) {
      throw new NotFoundException('Membership not found');
    }

    const grant = membership.roles.find((entry) => entry.role === input.role);
    if (!grant) {
      throw new NotFoundException('Role grant not found');
    }

    await withTenantContext(
      {
        userId: actorUserId,
        organizationId: conference.organizationId,
        conferenceId,
      },
      async (tx) =>
        tx.roleGrant.delete({
          where: { id: grant.id },
        }),
    );

    await this.audit.log({
      actorUserId,
      organizationId: conference.organizationId,
      conferenceId: input.scope === 'CONFERENCE' ? conferenceId : null,
      action: 'role.revoked',
      entity: 'role_grant',
      entityId: grant.id,
      diff: { userId: input.userId, role: input.role, scope: input.scope },
    });

    return this.listMembers(actorUserId, conferenceId, grantorRoles);
  }

  private async findOrCreateMembership(
    actorUserId: string,
    organizationId: string,
    conferenceId: string,
    targetUserId: string,
    scope: MembershipScope,
    _grantorRoles: RoleKind[],
  ) {
    const existing = await withTenantContext(
      {
        userId: actorUserId,
        organizationId,
        conferenceId,
      },
      async (tx) =>
        tx.membership.findFirst({
          where: {
            userId: targetUserId,
            scope,
            organizationId,
            conferenceId: scope === 'CONFERENCE' ? conferenceId : null,
          },
          include: { roles: true },
        }),
    );

    if (existing) {
      return existing;
    }

    return withTenantContext(
      {
        userId: actorUserId,
        organizationId,
        conferenceId,
      },
      async (tx) =>
        tx.membership.create({
          data: {
            id: generateId(),
            userId: targetUserId,
            organizationId,
            conferenceId: scope === 'CONFERENCE' ? conferenceId : null,
            scope,
          },
          include: { roles: true },
        }),
    );
  }
}
