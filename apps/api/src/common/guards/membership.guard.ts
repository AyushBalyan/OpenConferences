import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { RoleKind } from '@openconferences/db';
import { prisma } from '@openconferences/db';
import type { AuthenticatedRequest } from './auth.guard';
import { REQUIRED_ROLES_KEY } from './guard.constants';

/**
 * Placeholder membership guard for Phase 1.
 * Loads role grants for the route scope; returns empty until Phase 2 grants exist.
 * Use together with AuthGuard: @UseGuards(AuthGuard, MembershipGuard)
 */
@Injectable()
export class MembershipGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<
      AuthenticatedRequest & {
        roleGrants?: RoleKind[];
        conferenceId?: string;
        organizationId?: string;
      }
    >();

    const user = request.user;
    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    const conferenceId =
      (request.params?.conferenceId as string | undefined) ??
      (request.params?.id as string | undefined);
    const organizationId = request.params?.organizationId as string | undefined;

    request.conferenceId = conferenceId;
    request.organizationId = organizationId;

    const memberships = await prisma.membership.findMany({
      where: {
        userId: user.id,
        ...(conferenceId
          ? { conferenceId, scope: 'CONFERENCE' }
          : organizationId
            ? { organizationId, scope: 'ORGANIZATION' }
            : {}),
      },
      include: { roles: true },
    });

    const roleGrants = memberships.flatMap((membership) =>
      membership.roles.map((grant) => grant.role),
    );

    request.roleGrants = roleGrants;

    const requiredRoles = this.reflector.getAllAndOverride<RoleKind[] | undefined>(
      REQUIRED_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const hasRole = requiredRoles.some((role) => roleGrants.includes(role));
    if (!hasRole) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
