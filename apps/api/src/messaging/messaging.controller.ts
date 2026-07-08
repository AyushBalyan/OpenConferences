import { Controller, UseGuards } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { messagingContract } from '@openconferences/contracts';
import type { RoleKind } from '@openconferences/db';
import { AuthGuard } from '../common/guards/auth.guard';
import { MembershipGuard } from '../common/guards/membership.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequireRole } from '../common/decorators/require-role.decorator';
import { RoleGrants } from '../common/decorators/role-grants.decorator';
import type { AuthUser } from '../auth/auth.types';
import { ConferenceService } from '../tenancy/conference.service';
import { NotificationService } from './notification.service';
import { TemplateService } from './template.service';

@Controller()
@UseGuards(AuthGuard, MembershipGuard)
export class MessagingController {
  constructor(
    private readonly conferences: ConferenceService,
    private readonly notifications: NotificationService,
    private readonly templates: TemplateService,
  ) {}

  @TsRestHandler(messagingContract.listNotificationLogs)
  @RequireRole('ORGANIZER', 'ORG_ADMIN', 'PLATFORM_ADMIN')
  listNotificationLogs(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(messagingContract.listNotificationLogs, async ({ params, query }) => {
      await this.conferences.loadConference(user.id, params.id, roles);
      const result = await this.notifications.listLogs(params.id, query);
      return { status: 200 as const, body: result };
    });
  }

  @TsRestHandler(messagingContract.resendNotification)
  @RequireRole('ORGANIZER', 'ORG_ADMIN', 'PLATFORM_ADMIN')
  resendNotification(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(messagingContract.resendNotification, async ({ params }) => {
      await this.conferences.loadConference(user.id, params.id, roles);
      const result = await this.notifications.resend(params.id, params.logId);
      return { status: 200 as const, body: result };
    });
  }

  @TsRestHandler(messagingContract.listNotificationTemplates)
  @RequireRole('ORGANIZER', 'ORG_ADMIN', 'PLATFORM_ADMIN')
  listNotificationTemplates(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(messagingContract.listNotificationTemplates, async ({ params, query }) => {
      const conference = await this.conferences.loadConference(user.id, params.id, roles);
      const result = await this.templates.listForOrganization(conference.organizationId, query);
      return { status: 200 as const, body: result };
    });
  }

  @TsRestHandler(messagingContract.createNotificationTemplate)
  @RequireRole('ORGANIZER', 'ORG_ADMIN', 'PLATFORM_ADMIN')
  createNotificationTemplate(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(messagingContract.createNotificationTemplate, async ({ params, body }) => {
      const conference = await this.conferences.loadConference(user.id, params.id, roles);
      const template = await this.templates.createTemplate(conference.organizationId, body);
      return { status: 201 as const, body: template };
    });
  }

  @TsRestHandler(messagingContract.updateNotificationTemplate)
  @RequireRole('ORGANIZER', 'ORG_ADMIN', 'PLATFORM_ADMIN')
  updateNotificationTemplate(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(messagingContract.updateNotificationTemplate, async ({ params, body }) => {
      const conference = await this.conferences.loadConference(user.id, params.id, roles);
      const template = await this.templates.updateTemplate(
        conference.organizationId,
        params.templateId,
        body,
      );
      return { status: 200 as const, body: template };
    });
  }
}
