import { Controller, UseGuards } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { conferencesContract } from '@openconferences/contracts';
import { prisma } from '@openconferences/db';
import type { RoleKind } from '@openconferences/db';
import { AuthGuard } from '../common/guards/auth.guard';
import { MembershipGuard } from '../common/guards/membership.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RoleGrants } from '../common/decorators/role-grants.decorator';
import { RequireRole } from '../common/decorators/require-role.decorator';
import { RequireMfa } from '../common/decorators/require-mfa.decorator';
import { RequireMembership } from '../common/decorators/require-membership.decorator';
import type { AuthUser } from '../auth/auth.types';
import { ConferenceService } from './conference.service';
import { RoleGrantService } from './role-grant.service';
import { mapTrack } from './tenancy.mapper';

@Controller()
@UseGuards(AuthGuard, MembershipGuard)
export class ConferencesController {
  constructor(
    private readonly conferences: ConferenceService,
    private readonly roleGrants: RoleGrantService,
  ) {}

  @TsRestHandler(conferencesContract.list)
  list(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(conferencesContract.list, async ({ query }) => {
      const result = await this.conferences.listForUser(user.id, roles, query);
      return { status: 200 as const, body: result };
    });
  }

  @TsRestHandler(conferencesContract.create)
  @RequireRole('ORG_ADMIN', 'PLATFORM_ADMIN')
  @RequireMfa()
  create(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(conferencesContract.create, async ({ body }) => {
      const conference = await this.conferences.create(user.id, body, roles);
      return { status: 201 as const, body: conference };
    });
  }

  @TsRestHandler(conferencesContract.get)
  @RequireMembership()
  get(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(conferencesContract.get, async ({ params }) => {
      const conference = await this.conferences.getById(user.id, params.id, roles);
      return { status: 200 as const, body: conference };
    });
  }

  @TsRestHandler(conferencesContract.update)
  @RequireRole('ORGANIZER', 'ORG_ADMIN', 'PLATFORM_ADMIN')
  @RequireMfa()
  update(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(conferencesContract.update, async ({ params, body }) => {
      const conference = await this.conferences.updateMetadata(user.id, params.id, body, roles);
      return { status: 200 as const, body: conference };
    });
  }

  @TsRestHandler(conferencesContract.updateSettings)
  @RequireRole('ORGANIZER', 'ORG_ADMIN', 'PLATFORM_ADMIN')
  @RequireMfa()
  updateSettings(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(conferencesContract.updateSettings, async ({ params, body }) => {
      const conference = await this.conferences.updateSettings(user.id, params.id, body, roles);
      return { status: 200 as const, body: conference };
    });
  }

  @TsRestHandler(conferencesContract.transitionStatus)
  @RequireRole('ORGANIZER', 'ORG_ADMIN', 'PLATFORM_ADMIN')
  @RequireMfa()
  transitionStatus(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(conferencesContract.transitionStatus, async ({ params, body }) => {
      const conference = await this.conferences.transitionStatus(
        user.id,
        params.id,
        body.status,
        roles,
      );
      return { status: 200 as const, body: conference };
    });
  }

  @TsRestHandler(conferencesContract.listTracks)
  @RequireMembership()
  listTracks(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(conferencesContract.listTracks, async ({ params }) => {
      const tracks = await this.conferences.listTracks(user.id, params.id, roles);
      return {
        status: 200 as const,
        body: { data: tracks.map(mapTrack) },
      };
    });
  }

  @TsRestHandler(conferencesContract.createTrack)
  @RequireRole('ORGANIZER', 'ORG_ADMIN', 'PLATFORM_ADMIN')
  @RequireMfa()
  createTrack(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(conferencesContract.createTrack, async ({ params, body }) => {
      const track = await this.conferences.createTrack(user.id, params.id, body, roles);
      return { status: 201 as const, body: mapTrack(track) };
    });
  }

  @TsRestHandler(conferencesContract.updateTrack)
  @RequireRole('ORGANIZER', 'ORG_ADMIN', 'PLATFORM_ADMIN')
  @RequireMfa()
  updateTrack(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(conferencesContract.updateTrack, async ({ params, body }) => {
      const track = await this.conferences.updateTrack(
        user.id,
        params.id,
        params.trackId,
        body,
        roles,
      );
      return { status: 200 as const, body: mapTrack(track) };
    });
  }

  @TsRestHandler(conferencesContract.deleteTrack)
  @RequireRole('ORGANIZER', 'ORG_ADMIN', 'PLATFORM_ADMIN')
  @RequireMfa()
  deleteTrack(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(conferencesContract.deleteTrack, async ({ params }) => {
      await this.conferences.deleteTrack(user.id, params.id, params.trackId, roles);
      return { status: 204 as const, body: undefined };
    });
  }

  @TsRestHandler(conferencesContract.listMembers)
  @RequireRole('ORGANIZER', 'ORG_ADMIN', 'PLATFORM_ADMIN', 'CHAIR')
  listMembers(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(conferencesContract.listMembers, async ({ params }) => {
      const members = await this.roleGrants.listMembers(user.id, params.id, roles);
      return { status: 200 as const, body: { data: members } };
    });
  }

  @TsRestHandler(conferencesContract.grantRole)
  @RequireRole('ORGANIZER', 'ORG_ADMIN', 'PLATFORM_ADMIN')
  @RequireMfa()
  grantRole(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(conferencesContract.grantRole, async ({ params, body }) => {
      const members = await this.roleGrants.grantRole(user.id, params.id, body, roles);
      return { status: 201 as const, body: { data: members } };
    });
  }

  @TsRestHandler(conferencesContract.revokeRole)
  @RequireRole('ORGANIZER', 'ORG_ADMIN', 'PLATFORM_ADMIN')
  @RequireMfa()
  revokeRole(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(conferencesContract.revokeRole, async ({ params, body }) => {
      const members = await this.roleGrants.revokeRole(user.id, params.id, body, roles);
      return { status: 200 as const, body: { data: members } };
    });
  }

  @TsRestHandler(conferencesContract.listAuditLogs)
  @RequireRole('ORGANIZER', 'ORG_ADMIN', 'PLATFORM_ADMIN')
  listAuditLogs(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(conferencesContract.listAuditLogs, async ({ params, query }) => {
      await this.conferences.loadConference(user.id, params.id, roles);
      const limit = query.limit ?? 50;

      const logs = await prisma.auditLog.findMany({
        where: { conferenceId: params.id },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      return {
        status: 200 as const,
        body: {
          data: logs.map((log) => ({
            id: log.id,
            actorUserId: log.actorUserId,
            organizationId: log.organizationId,
            conferenceId: log.conferenceId,
            action: log.action,
            entity: log.entity,
            entityId: log.entityId,
            diff: (log.diff as Record<string, unknown> | null) ?? null,
            createdAt: log.createdAt.toISOString(),
          })),
        },
      };
    });
  }
}
