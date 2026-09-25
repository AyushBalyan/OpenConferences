import { Controller, UseGuards } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { outreachContract } from '@openconferences/contracts';
import type { RoleKind } from '@openconferences/db';
import { AuthGuard } from '../common/guards/auth.guard';
import { MembershipGuard } from '../common/guards/membership.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequireRole } from '../common/decorators/require-role.decorator';
import { RoleGrants } from '../common/decorators/role-grants.decorator';
import type { AuthUser } from '../auth/auth.types';
import { OutreachService } from './outreach.service';

@Controller()
@UseGuards(AuthGuard, MembershipGuard)
export class OutreachController {
  constructor(private readonly outreach: OutreachService) {}

  @TsRestHandler(outreachContract.listCampaigns)
  @RequireRole('ORGANIZER', 'ORG_ADMIN', 'PLATFORM_ADMIN')
  listCampaigns(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(outreachContract.listCampaigns, async ({ params, query }) => {
      const result = await this.outreach.listCampaigns(user.id, params.conferenceId, roles, query);
      return { status: 200 as const, body: result };
    });
  }

  @TsRestHandler(outreachContract.createCampaign)
  @RequireRole('ORGANIZER', 'ORG_ADMIN', 'PLATFORM_ADMIN')
  createCampaign(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(outreachContract.createCampaign, async ({ params, body }) => {
      const campaign = await this.outreach.createCampaign(
        user.id,
        params.conferenceId,
        roles,
        body,
      );
      return { status: 201 as const, body: campaign };
    });
  }

  @TsRestHandler(outreachContract.getCampaign)
  @RequireRole('ORGANIZER', 'ORG_ADMIN', 'PLATFORM_ADMIN')
  getCampaign(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(outreachContract.getCampaign, async ({ params }) => {
      const campaign = await this.outreach.getCampaign(
        user.id,
        params.conferenceId,
        params.campaignId,
        roles,
      );
      return { status: 200 as const, body: campaign };
    });
  }

  @TsRestHandler(outreachContract.importRecipients)
  @RequireRole('ORGANIZER', 'ORG_ADMIN', 'PLATFORM_ADMIN')
  importRecipients(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(outreachContract.importRecipients, async ({ params, body }) => {
      const result = await this.outreach.importRecipients(
        user.id,
        params.conferenceId,
        params.campaignId,
        roles,
        body,
      );
      return { status: 200 as const, body: result };
    });
  }

  @TsRestHandler(outreachContract.listRecipients)
  @RequireRole('ORGANIZER', 'ORG_ADMIN', 'PLATFORM_ADMIN')
  listRecipients(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(outreachContract.listRecipients, async ({ params, query }) => {
      const result = await this.outreach.listRecipients(
        user.id,
        params.conferenceId,
        params.campaignId,
        roles,
        query,
      );
      return { status: 200 as const, body: result };
    });
  }

  @TsRestHandler(outreachContract.listTemplates)
  @RequireRole('ORGANIZER', 'ORG_ADMIN', 'PLATFORM_ADMIN')
  listTemplates(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(outreachContract.listTemplates, async ({ params }) => {
      const result = await this.outreach.listTemplates(user.id, params.conferenceId, roles);
      return { status: 200 as const, body: result };
    });
  }

  @TsRestHandler(outreachContract.selectTemplate)
  @RequireRole('ORGANIZER', 'ORG_ADMIN', 'PLATFORM_ADMIN')
  selectTemplate(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(outreachContract.selectTemplate, async ({ params, body }) => {
      const campaign = await this.outreach.selectTemplate(
        user.id,
        params.conferenceId,
        params.campaignId,
        roles,
        body,
      );
      return { status: 200 as const, body: campaign };
    });
  }

  @TsRestHandler(outreachContract.previewCampaign)
  @RequireRole('ORGANIZER', 'ORG_ADMIN', 'PLATFORM_ADMIN')
  previewCampaign(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(outreachContract.previewCampaign, async ({ params, query }) => {
      const preview = await this.outreach.previewCampaign(
        user.id,
        params.conferenceId,
        params.campaignId,
        roles,
        query.recipientId,
      );
      return { status: 200 as const, body: preview };
    });
  }

  @TsRestHandler(outreachContract.sendCampaign)
  @RequireRole('ORGANIZER', 'ORG_ADMIN', 'PLATFORM_ADMIN')
  sendCampaign(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(outreachContract.sendCampaign, async ({ params, body }) => {
      const result = await this.outreach.sendCampaign(
        user.id,
        params.conferenceId,
        params.campaignId,
        roles,
        body,
      );
      return { status: 200 as const, body: result };
    });
  }

  @TsRestHandler(outreachContract.getSender)
  @RequireRole('ORGANIZER', 'ORG_ADMIN', 'PLATFORM_ADMIN')
  getSender(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(outreachContract.getSender, async ({ params }) => {
      const sender = await this.outreach.getSender(user.id, params.conferenceId, roles);
      return { status: 200 as const, body: sender };
    });
  }
}
