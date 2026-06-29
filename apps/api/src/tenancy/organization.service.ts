import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { generateId, withTenantContext, type RoleKind } from '@openconferences/db';
import type { CreateOrganizationInput } from '@openconferences/schemas';
import { AuditService } from '../audit/audit.service';
import { maxRoleRank } from './role-hierarchy';

@Injectable()
export class OrganizationService {
  constructor(private readonly audit: AuditService) {}

  async listForUser(userId: string, userRoles: RoleKind[]) {
    const isPlatformAdmin = userRoles.includes('PLATFORM_ADMIN');

    return withTenantContext({ userId, bypass: isPlatformAdmin }, async (tx) => {
      if (isPlatformAdmin) {
        return tx.organization.findMany({
          where: { deletedAt: null },
          orderBy: { name: 'asc' },
        });
      }

      const memberships = await tx.membership.findMany({
        where: { userId },
        select: { organizationId: true },
      });

      const orgIds = [...new Set(memberships.map((m) => m.organizationId))];
      if (orgIds.length === 0) return [];

      return tx.organization.findMany({
        where: { id: { in: orgIds }, deletedAt: null },
        orderBy: { name: 'asc' },
      });
    });
  }

  async getById(userId: string, organizationId: string, userRoles: RoleKind[]) {
    const org = await withTenantContext(
      { userId, organizationId, bypass: userRoles.includes('PLATFORM_ADMIN') },
      async (tx) =>
        tx.organization.findFirst({
          where: { id: organizationId, deletedAt: null },
        }),
    );

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    return org;
  }

  async create(actorUserId: string, input: CreateOrganizationInput, userRoles: RoleKind[]) {
    if (!userRoles.includes('PLATFORM_ADMIN')) {
      throw new ForbiddenException('Only platform administrators can create organizations');
    }

    try {
      const org = await withTenantContext({ userId: actorUserId, bypass: true }, async (tx) =>
        tx.organization.create({
          data: {
            id: generateId(),
            slug: input.slug,
            name: input.name,
          },
        }),
      );

      await this.audit.log({
        actorUserId,
        organizationId: org.id,
        action: 'organization.created',
        entity: 'organization',
        entityId: org.id,
        diff: { slug: org.slug, name: org.name },
      });

      return org;
    } catch (error) {
      if (error instanceof Error && error.message.includes('Unique constraint')) {
        throw new ConflictException('Organization slug already exists');
      }
      throw error;
    }
  }

  async update(
    actorUserId: string,
    organizationId: string,
    name: string | undefined,
    userRoles: RoleKind[],
  ) {
    const grantorMax = maxRoleRank(userRoles);
    if (grantorMax < maxRoleRank(['ORG_ADMIN'])) {
      throw new ForbiddenException('Insufficient permissions');
    }

    await this.getById(actorUserId, organizationId, userRoles);

    const org = await withTenantContext(
      { userId: actorUserId, organizationId, bypass: userRoles.includes('PLATFORM_ADMIN') },
      async (tx) =>
        tx.organization.update({
          where: { id: organizationId },
          data: { ...(name !== undefined ? { name } : {}) },
        }),
    );

    await this.audit.log({
      actorUserId,
      organizationId,
      action: 'organization.updated',
      entity: 'organization',
      entityId: org.id,
      diff: { name },
    });

    return org;
  }
}
