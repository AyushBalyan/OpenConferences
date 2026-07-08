import { Controller, UseGuards } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { analyticsContract } from '@openconferences/contracts';
import type { RoleKind } from '@openconferences/db';
import { AuthGuard } from '../common/guards/auth.guard';
import { MembershipGuard } from '../common/guards/membership.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RoleGrants } from '../common/decorators/role-grants.decorator';
import { RequireMembership } from '../common/decorators/require-membership.decorator';
import type { AuthUser } from '../auth/auth.types';
import { AnalyticsService } from './analytics.service';

@Controller()
@UseGuards(AuthGuard, MembershipGuard)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @TsRestHandler(analyticsContract.getOverview)
  @RequireMembership()
  getOverview(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(analyticsContract.getOverview, async ({ params }) => {
      const overview = await this.analytics.getOverview(user.id, params.conferenceId, roles);
      return { status: 200 as const, body: overview };
    });
  }
}
