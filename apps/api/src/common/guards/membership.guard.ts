import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { RoleKind } from '@openconferences/db';
import { prisma, withTenantContext } from '@openconferences/db';
import type { AuthenticatedRequest } from './auth.guard';
import { MFA_REQUIRED_KEY, REQUIRED_ROLES_KEY, REQUIRE_MEMBERSHIP_KEY } from './guard.constants';
import { MFA_REQUIRED_ROLES } from '../../tenancy/role-hierarchy';

export type MembershipRequest = AuthenticatedRequest & {
  roleGrants?: RoleKind[];
  conferenceId?: string;
  organizationId?: string;
};

function resolveRouteScope(request: Request): {
  conferenceId?: string;
  organizationId?: string;
} {
  const path = request.path ?? request.url ?? '';
  const params = request.params ?? {};

  if (params.conferenceId) {
    return { conferenceId: params.conferenceId as string };
  }

  if (params.organizationId) {
    return { organizationId: params.organizationId as string };
  }

  if (path.includes('/conferences/') && params.id) {
    return { conferenceId: params.id as string };
  }

  const conferenceMatch = path.match(/\/conferences\/([^/]+)/);
  if (conferenceMatch?.[1]) {
    return { conferenceId: conferenceMatch[1] };
  }

  if (path.includes('/organizations/') && params.id) {
    return { organizationId: params.id as string };
  }

  return {};
}

/**
 * Loads role grants for the route scope and enforces RBAC (§5.3).
 * Use together with AuthGuard: @UseGuards(AuthGuard, MembershipGuard)
 */
@Injectable()
export class MembershipGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<MembershipRequest>();

    const user = request.user;
    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    const { conferenceId, organizationId } = resolveRouteScope(request);

    request.conferenceId = conferenceId;
    request.organizationId = organizationId;

    let resolvedOrganizationId = organizationId;

    if (conferenceId && !organizationId) {
      const conference = await withTenantContext({ userId: user.id, conferenceId }, async (tx) =>
        tx.conference.findFirst({
          where: { id: conferenceId, deletedAt: null },
          select: { organizationId: true },
        }),
      );
      if (conference) {
        resolvedOrganizationId = conference.organizationId;
        request.organizationId = conference.organizationId;
      }
    }

    const { memberships, orgLevelRoles } = await withTenantContext(
      {
        userId: user.id,
        conferenceId,
        organizationId: resolvedOrganizationId,
      },
      async (tx) => {
        const scopedMemberships = await tx.membership.findMany({
          where: {
            userId: user.id,
            ...(conferenceId
              ? {
                  OR: [
                    { conferenceId, scope: 'CONFERENCE' },
                    ...(resolvedOrganizationId
                      ? [{ organizationId: resolvedOrganizationId, scope: 'ORGANIZATION' as const }]
                      : []),
                  ],
                }
              : resolvedOrganizationId
                ? { organizationId: resolvedOrganizationId, scope: 'ORGANIZATION' }
                : {}),
          },
          include: { roles: true },
        });

        let inheritedOrgRoles: RoleKind[] = [];
        if (conferenceId && resolvedOrganizationId) {
          const orgMemberships = await tx.membership.findMany({
            where: {
              userId: user.id,
              organizationId: resolvedOrganizationId,
              scope: 'ORGANIZATION',
            },
            include: { roles: true },
          });
          inheritedOrgRoles = orgMemberships.flatMap((m) => m.roles.map((g) => g.role));
        }

        return { memberships: scopedMemberships, orgLevelRoles: inheritedOrgRoles };
      },
    );

    const roleGrants = [
      ...new Set([
        ...memberships.flatMap((membership) => membership.roles.map((grant) => grant.role)),
        ...orgLevelRoles,
      ]),
    ];

    request.roleGrants = roleGrants;

    const requireMembership = this.reflector.getAllAndOverride<boolean>(REQUIRE_MEMBERSHIP_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (requireMembership && (conferenceId || organizationId) && roleGrants.length === 0) {
      throw new NotFoundException('Resource not found');
    }

    const requiredRoles = this.reflector.getAllAndOverride<RoleKind[] | undefined>(
      REQUIRED_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (requiredRoles && requiredRoles.length > 0) {
      const hasRole = requiredRoles.some((role) => roleGrants.includes(role));
      if (!hasRole) {
        throw new ForbiddenException('Insufficient permissions');
      }
    }

    const mfaRequired = this.reflector.getAllAndOverride<boolean>(MFA_REQUIRED_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const privilegedAction =
      mfaRequired || (requiredRoles?.some((role) => MFA_REQUIRED_ROLES.includes(role)) ?? false);

    if (privilegedAction) {
      const userRecord = await prisma.user.findUnique({
        where: { id: user.id },
        select: { twoFactorEnabled: true },
      });
      if (!userRecord?.twoFactorEnabled) {
        throw new ForbiddenException('Multi-factor authentication is required for this action');
      }
    }

    return true;
  }
}
