import { Controller, UseGuards } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { organizationsContract } from '@openconferences/contracts';
import { AuthGuard } from '../common/guards/auth.guard';
import { MembershipGuard } from '../common/guards/membership.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RoleGrants } from '../common/decorators/role-grants.decorator';
import { RequireRole } from '../common/decorators/require-role.decorator';
import type { AuthUser } from '../auth/auth.types';
import type { RoleKind } from '@openconferences/db';
import { OrganizationService } from './organization.service';

@Controller()
@UseGuards(AuthGuard, MembershipGuard)
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationService) {}

  @TsRestHandler(organizationsContract.list)
  list(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(organizationsContract.list, async ({ query }) => {
      const result = await this.organizations.listForUser(user.id, roles, query);
      return { status: 200 as const, body: result };
    });
  }

  @TsRestHandler(organizationsContract.create)
  @RequireRole('PLATFORM_ADMIN')
  create(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(organizationsContract.create, async ({ body }) => {
      const org = await this.organizations.create(user.id, body, roles);
      return {
        status: 201 as const,
        body: {
          id: org.id,
          slug: org.slug,
          name: org.name,
          createdAt: org.createdAt.toISOString(),
          updatedAt: org.updatedAt.toISOString(),
        },
      };
    });
  }

  @TsRestHandler(organizationsContract.get)
  get(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(organizationsContract.get, async ({ params }) => {
      const org = await this.organizations.getById(user.id, params.id, roles);
      return {
        status: 200 as const,
        body: {
          id: org.id,
          slug: org.slug,
          name: org.name,
          createdAt: org.createdAt.toISOString(),
          updatedAt: org.updatedAt.toISOString(),
        },
      };
    });
  }

  @TsRestHandler(organizationsContract.update)
  @RequireRole('ORG_ADMIN', 'PLATFORM_ADMIN')
  update(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(organizationsContract.update, async ({ params, body }) => {
      const org = await this.organizations.update(user.id, params.id, body.name, roles);
      return {
        status: 200 as const,
        body: {
          id: org.id,
          slug: org.slug,
          name: org.name,
          createdAt: org.createdAt.toISOString(),
          updatedAt: org.updatedAt.toISOString(),
        },
      };
    });
  }
}
