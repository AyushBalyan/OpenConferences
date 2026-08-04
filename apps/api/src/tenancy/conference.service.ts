import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Conference, ConferenceStatus, RoleKind } from '@openconferences/db';
import { generateId, withTenantContext } from '@openconferences/db';
import type {
  CreateConferenceInput,
  UpdateConferenceSettingsInput,
  ConferenceDto,
  ConferenceListDto,
  RoleKind as SchemaRoleKind,
} from '@openconferences/schemas';
import { assertScope } from '../common/scope/assert-scope';
import { AuditService } from '../audit/audit.service';
import { LifecycleService } from './lifecycle.service';
import { mapConference, parseOptionalDate } from './tenancy.mapper';
import { maxRoleRank } from './role-hierarchy';

function toSchemaRoles(roles: RoleKind[]): SchemaRoleKind[] {
  return roles as SchemaRoleKind[];
}
import { effectiveRolesForConference, mergeRolesByConference } from './membership-roles';
import {
  paginateItems,
  prismaCursorArgs,
  resolveLimit,
  type CursorPaginationOptions,
} from '../common/pagination/cursor';

@Injectable()
export class ConferenceService {
  constructor(
    private readonly audit: AuditService,
    private readonly lifecycle: LifecycleService,
  ) {}

  async listForUser(
    userId: string,
    userRoles: RoleKind[],
    options: { limit?: number; cursor?: string; organizationId?: string },
  ): Promise<ConferenceListDto> {
    const limit = options.limit ?? 20;
    const globalRoles = userRoles.filter((role) => role === 'PLATFORM_ADMIN');

    const result = await withTenantContext(
      {
        userId,
        organizationId: options.organizationId,
      },
      async (tx) => {
        const memberships = await tx.membership.findMany({
          where: {
            userId,
            scope: 'CONFERENCE',
            ...(options.organizationId ? { organizationId: options.organizationId } : {}),
          },
          select: { conferenceId: true },
        });

        const conferenceIds = memberships
          .map((m) => m.conferenceId)
          .filter((id): id is string => id !== null);

        if (conferenceIds.length === 0 && !userRoles.includes('PLATFORM_ADMIN')) {
          return [];
        }

        const conferences = await tx.conference.findMany({
          where: {
            deletedAt: null,
            ...(userRoles.includes('PLATFORM_ADMIN') && conferenceIds.length === 0
              ? options.organizationId
                ? { organizationId: options.organizationId }
                : {}
              : { id: { in: conferenceIds } }),
          },
          orderBy: { createdAt: 'desc' },
          take: limit + 1,
          ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
        });

        if (conferences.length === 0) {
          return [] as Array<{ conference: Conference; myRoles: RoleKind[] }>;
        }

        const orgIds = [...new Set(conferences.map((conference) => conference.organizationId))];
        const scopedConferenceIds = conferences.map((conference) => conference.id);

        const roleMemberships = await tx.membership.findMany({
          where: {
            userId,
            OR: [
              { conferenceId: { in: scopedConferenceIds }, scope: 'CONFERENCE' },
              { organizationId: { in: orgIds }, scope: 'ORGANIZATION' },
            ],
          },
          include: { roles: true },
        });

        const { rolesByConferenceId, rolesByOrganizationId } =
          mergeRolesByConference(roleMemberships);

        return conferences.map((conference) => ({
          conference,
          myRoles: effectiveRolesForConference(
            conference.id,
            conference.organizationId,
            rolesByConferenceId,
            rolesByOrganizationId,
            globalRoles,
          ),
        }));
      },
    );

    const hasMore = result.length > limit;
    const page = hasMore ? result.slice(0, limit) : result;

    return {
      data: page.map(({ conference, myRoles }) =>
        mapConference(conference, toSchemaRoles(myRoles)),
      ),
      nextCursor: hasMore ? (page[page.length - 1]?.conference.id ?? null) : null,
    };
  }

  async getById(
    userId: string,
    conferenceId: string,
    userRoles: RoleKind[],
  ): Promise<ConferenceDto> {
    const conference = await this.loadConference(userId, conferenceId, userRoles);
    return mapConference(conference, toSchemaRoles(userRoles));
  }

  async loadConference(
    userId: string,
    conferenceId: string,
    _userRoles: RoleKind[],
  ): Promise<Conference> {
    const conference = await withTenantContext(
      {
        userId,
        conferenceId,
      },
      async (tx) =>
        tx.conference.findFirst({
          where: { id: conferenceId, deletedAt: null },
        }),
    );

    if (!conference) {
      throw new NotFoundException('Conference not found');
    }

    return conference;
  }

  async create(actorUserId: string, input: CreateConferenceInput, userRoles: RoleKind[]) {
    if (maxRoleRank(userRoles) < maxRoleRank(['ORG_ADMIN'])) {
      throw new ForbiddenException('Insufficient permissions to create conferences');
    }

    const orgExists = await withTenantContext(
      { userId: actorUserId, organizationId: input.organizationId },
      async (tx) =>
        tx.organization.findFirst({
          where: { id: input.organizationId, deletedAt: null },
        }),
    );

    if (!orgExists) {
      throw new NotFoundException('Organization not found');
    }

    try {
      const conference = await withTenantContext(
        { userId: actorUserId, organizationId: input.organizationId },
        async (tx) => {
          const created = await tx.conference.create({
            data: {
              id: generateId(),
              organizationId: input.organizationId,
              slug: input.slug,
              name: input.name,
              authorJoinToken: generateId(),
              blindingMode: input.blindingMode ?? 'DOUBLE',
            },
          });

          await tx.track.create({
            data: {
              id: generateId(),
              conferenceId: created.id,
              organizationId: input.organizationId,
              slug: 'main',
              name: 'Main Track',
            },
          });

          return created;
        },
      );

      await withTenantContext(
        { userId: actorUserId, organizationId: input.organizationId },
        async (tx) =>
          tx.membership.create({
            data: {
              id: generateId(),
              userId: actorUserId,
              organizationId: input.organizationId,
              conferenceId: conference.id,
              scope: 'CONFERENCE',
              roles: {
                create: {
                  id: generateId(),
                  role: 'ORGANIZER',
                },
              },
            },
          }),
      );

      await this.audit.log({
        actorUserId,
        organizationId: input.organizationId,
        conferenceId: conference.id,
        action: 'conference.created',
        entity: 'conference',
        entityId: conference.id,
        diff: { slug: conference.slug, name: conference.name },
      });

      return mapConference(conference, ['ORGANIZER']);
    } catch (error) {
      if (error instanceof Error && error.message.includes('Unique constraint')) {
        throw new ConflictException('Conference slug already exists in this organization');
      }
      throw error;
    }
  }

  async updateMetadata(
    actorUserId: string,
    conferenceId: string,
    data: { name?: string; slug?: string },
    userRoles: RoleKind[],
  ) {
    if (maxRoleRank(userRoles) < maxRoleRank(['ORGANIZER'])) {
      throw new ForbiddenException('Insufficient permissions');
    }

    const conference = await this.loadConference(actorUserId, conferenceId, userRoles);

    try {
      const updated = await withTenantContext(
        {
          userId: actorUserId,
          organizationId: conference.organizationId,
          conferenceId,
        },
        async (tx) =>
          tx.conference.update({
            where: { id: conferenceId },
            data: {
              ...(data.name !== undefined ? { name: data.name } : {}),
              ...(data.slug !== undefined ? { slug: data.slug } : {}),
              version: { increment: 1 },
            },
          }),
      );

      await this.audit.log({
        actorUserId,
        organizationId: conference.organizationId,
        conferenceId,
        action: 'conference.updated',
        entity: 'conference',
        entityId: conferenceId,
        diff: data,
      });

      return mapConference(updated, toSchemaRoles(userRoles));
    } catch (error) {
      if (error instanceof Error && error.message.includes('Unique constraint')) {
        throw new ConflictException('Conference slug already exists');
      }
      throw error;
    }
  }

  async updateSettings(
    actorUserId: string,
    conferenceId: string,
    input: UpdateConferenceSettingsInput,
    userRoles: RoleKind[],
  ) {
    if (maxRoleRank(userRoles) < maxRoleRank(['ORGANIZER'])) {
      throw new ForbiddenException('Insufficient permissions');
    }

    const conference = await this.loadConference(actorUserId, conferenceId, userRoles);

    if (
      input.cfpOpensAt &&
      input.cfpClosesAt &&
      new Date(input.cfpOpensAt) >= new Date(input.cfpClosesAt)
    ) {
      throw new ConflictException('CFP opens must be before CFP closes');
    }

    const updated = await withTenantContext(
      {
        userId: actorUserId,
        organizationId: conference.organizationId,
        conferenceId,
      },
      async (tx) =>
        tx.conference.update({
          where: { id: conferenceId },
          data: {
            ...(input.blindingMode !== undefined ? { blindingMode: input.blindingMode } : {}),
            ...(input.reviewConfig !== undefined ? { reviewConfig: input.reviewConfig } : {}),
            ...(input.feeSchedule !== undefined ? { feeSchedule: input.feeSchedule } : {}),
            ...(input.cfpOpensAt !== undefined
              ? { cfpOpensAt: parseOptionalDate(input.cfpOpensAt) }
              : {}),
            ...(input.cfpClosesAt !== undefined
              ? { cfpClosesAt: parseOptionalDate(input.cfpClosesAt) }
              : {}),
            ...(input.biddingOpensAt !== undefined
              ? { biddingOpensAt: parseOptionalDate(input.biddingOpensAt) }
              : {}),
            ...(input.biddingClosesAt !== undefined
              ? { biddingClosesAt: parseOptionalDate(input.biddingClosesAt) }
              : {}),
            ...(input.reviewDueAt !== undefined
              ? { reviewDueAt: parseOptionalDate(input.reviewDueAt) }
              : {}),
            ...(input.rebuttalDueAt !== undefined
              ? { rebuttalDueAt: parseOptionalDate(input.rebuttalDueAt) }
              : {}),
            ...(input.decisionDueAt !== undefined
              ? { decisionDueAt: parseOptionalDate(input.decisionDueAt) }
              : {}),
            ...(input.cameraReadyDueAt !== undefined
              ? { cameraReadyDueAt: parseOptionalDate(input.cameraReadyDueAt) }
              : {}),
            ...(input.registrationDueAt !== undefined
              ? { registrationDueAt: parseOptionalDate(input.registrationDueAt) }
              : {}),
            version: { increment: 1 },
          },
        }),
    );

    const derivedStatus = this.lifecycle.deriveStatus(updated);
    if (derivedStatus !== updated.status) {
      const transitioned = await this.lifecycle.transition(
        actorUserId,
        conferenceId,
        derivedStatus,
        userRoles,
        updated.version + 1,
      );
      return mapConference(transitioned, toSchemaRoles(userRoles));
    }

    await this.audit.log({
      actorUserId,
      organizationId: conference.organizationId,
      conferenceId,
      action: 'conference.settings_updated',
      entity: 'conference',
      entityId: conferenceId,
      diff: input,
    });

    return mapConference(updated, toSchemaRoles(userRoles));
  }

  async transitionStatus(
    actorUserId: string,
    conferenceId: string,
    status: ConferenceStatus,
    userRoles: RoleKind[],
  ) {
    const conference = await this.lifecycle.transition(
      actorUserId,
      conferenceId,
      status,
      userRoles,
    );
    return mapConference(conference, toSchemaRoles(userRoles));
  }

  async listTracks(
    userId: string,
    conferenceId: string,
    userRoles: RoleKind[],
    options: CursorPaginationOptions = {},
  ) {
    const conference = await this.loadConference(userId, conferenceId, userRoles);
    const limit = resolveLimit(options.limit);

    const tracks = await withTenantContext(
      {
        userId,
        organizationId: conference.organizationId,
        conferenceId,
      },
      async (tx) =>
        tx.track.findMany({
          where: { conferenceId, deletedAt: null },
          orderBy: { name: 'asc' },
          ...prismaCursorArgs(options, limit),
        }),
    );

    const page = paginateItems(tracks, limit, (track) => track.id);
    return { data: page.data, nextCursor: page.nextCursor };
  }

  async listAuditLogs(
    userId: string,
    conferenceId: string,
    userRoles: RoleKind[],
    options: CursorPaginationOptions = {},
  ) {
    const conference = await this.loadConference(userId, conferenceId, userRoles);
    const limit = resolveLimit(options.limit, 50);

    const logs = await withTenantContext(
      {
        userId,
        organizationId: conference.organizationId,
        conferenceId,
      },
      async (tx) =>
        tx.auditLog.findMany({
          where: { conferenceId },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          ...prismaCursorArgs(options, limit),
        }),
    );

    const page = paginateItems(logs, limit, (log) => log.id);
    return {
      data: page.data.map((log) => ({
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
      nextCursor: page.nextCursor,
    };
  }

  async createTrack(
    actorUserId: string,
    conferenceId: string,
    input: { slug: string; name: string; description?: string },
    userRoles: RoleKind[],
  ) {
    if (maxRoleRank(userRoles) < maxRoleRank(['ORGANIZER'])) {
      throw new ForbiddenException('Insufficient permissions');
    }

    const conference = await this.loadConference(actorUserId, conferenceId, userRoles);

    try {
      const track = await withTenantContext(
        {
          userId: actorUserId,
          organizationId: conference.organizationId,
          conferenceId,
        },
        async (tx) =>
          tx.track.create({
            data: {
              id: generateId(),
              conferenceId,
              organizationId: conference.organizationId,
              slug: input.slug,
              name: input.name,
              description: input.description ?? null,
            },
          }),
      );

      assertScope(track, { conferenceId });

      await this.audit.log({
        actorUserId,
        organizationId: conference.organizationId,
        conferenceId,
        action: 'track.created',
        entity: 'track',
        entityId: track.id,
        diff: { slug: track.slug, name: track.name },
      });

      return track;
    } catch (error) {
      if (error instanceof Error && error.message.includes('Unique constraint')) {
        throw new ConflictException('Track slug already exists');
      }
      throw error;
    }
  }

  async updateTrack(
    actorUserId: string,
    conferenceId: string,
    trackId: string,
    input: { name?: string; description?: string | null },
    userRoles: RoleKind[],
  ) {
    if (maxRoleRank(userRoles) < maxRoleRank(['ORGANIZER'])) {
      throw new ForbiddenException('Insufficient permissions');
    }

    const conference = await this.loadConference(actorUserId, conferenceId, userRoles);

    const track = await withTenantContext(
      {
        userId: actorUserId,
        organizationId: conference.organizationId,
        conferenceId,
      },
      async (tx) =>
        tx.track.findFirst({
          where: { id: trackId, conferenceId, deletedAt: null },
        }),
    );

    if (!track) {
      throw new NotFoundException('Track not found');
    }

    assertScope(track, { conferenceId });

    const updated = await withTenantContext(
      {
        userId: actorUserId,
        organizationId: conference.organizationId,
        conferenceId,
      },
      async (tx) =>
        tx.track.update({
          where: { id: trackId },
          data: {
            ...(input.name !== undefined ? { name: input.name } : {}),
            ...(input.description !== undefined ? { description: input.description } : {}),
          },
        }),
    );

    return updated;
  }

  async deleteTrack(
    actorUserId: string,
    conferenceId: string,
    trackId: string,
    userRoles: RoleKind[],
  ) {
    if (maxRoleRank(userRoles) < maxRoleRank(['ORGANIZER'])) {
      throw new ForbiddenException('Insufficient permissions');
    }

    const conference = await this.loadConference(actorUserId, conferenceId, userRoles);

    const track = await withTenantContext(
      {
        userId: actorUserId,
        organizationId: conference.organizationId,
        conferenceId,
      },
      async (tx) =>
        tx.track.findFirst({
          where: { id: trackId, conferenceId, deletedAt: null },
        }),
    );

    if (!track) {
      throw new NotFoundException('Track not found');
    }

    assertScope(track, { conferenceId });

    await withTenantContext(
      {
        userId: actorUserId,
        organizationId: conference.organizationId,
        conferenceId,
      },
      async (tx) =>
        tx.track.update({
          where: { id: trackId },
          data: { deletedAt: new Date() },
        }),
    );

    await this.audit.log({
      actorUserId,
      organizationId: conference.organizationId,
      conferenceId,
      action: 'track.deleted',
      entity: 'track',
      entityId: trackId,
    });
  }

  async joinAsAuthor(userId: string, token: string) {
    const user = await withTenantContext({ userId }, async (tx) =>
      tx.user.findFirst({ where: { id: userId, deletedAt: null } }),
    );

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.emailVerified) {
      throw new ForbiddenException('Email verification required before joining as author');
    }

    // Resolve via SECURITY DEFINER: RLS conferences_api_select requires org membership,
    // which new authors do not have until after this join succeeds.
    const resolved = await withTenantContext(
      { userId },
      async (tx) =>
        tx.$queryRaw<
          Array<{
            id: string;
            organizationId: string;
            name: string;
            status: ConferenceStatus;
          }>
        >`
        SELECT id, "organizationId", name, status
        FROM public.app_resolve_conference_by_author_join_token(${token}::uuid)
      `,
    );
    const conference = resolved[0];

    if (!conference) {
      throw new NotFoundException('Invalid or expired submit link');
    }

    if (conference.status !== 'CFP_OPEN') {
      throw new ConflictException('Submissions are not open for this conference');
    }

    let alreadyMember = false;

    await withTenantContext(
      {
        userId,
        organizationId: conference.organizationId,
        conferenceId: conference.id,
      },
      async (tx) => {
        let membership = await tx.membership.findFirst({
          where: {
            userId,
            scope: 'CONFERENCE',
            organizationId: conference.organizationId,
            conferenceId: conference.id,
          },
          include: { roles: true },
        });

        if (!membership) {
          membership = await tx.membership.create({
            data: {
              id: generateId(),
              userId,
              organizationId: conference.organizationId,
              conferenceId: conference.id,
              scope: 'CONFERENCE',
            },
            include: { roles: true },
          });
        } else {
          alreadyMember = membership.roles.some((grant) => grant.role === 'AUTHOR');
        }

        const hasAuthor = membership.roles.some((grant) => grant.role === 'AUTHOR');
        if (!hasAuthor) {
          await tx.roleGrant.create({
            data: {
              id: generateId(),
              membershipId: membership.id,
              role: 'AUTHOR',
            },
          });
        }
      },
    );

    await this.audit.log({
      actorUserId: userId,
      organizationId: conference.organizationId,
      conferenceId: conference.id,
      action: 'author_join.accepted',
      entity: 'conference',
      entityId: conference.id,
      diff: { alreadyMember },
    });

    return {
      conferenceId: conference.id,
      conferenceName: conference.name,
      alreadyMember,
    };
  }

  async getAuthorJoinLink(userId: string, conferenceId: string, userRoles: RoleKind[]) {
    if (maxRoleRank(userRoles) < maxRoleRank(['ORGANIZER'])) {
      throw new ForbiddenException('Insufficient permissions to view submit link');
    }

    const conference = await this.loadConference(userId, conferenceId, userRoles);

    return {
      token: conference.authorJoinToken,
      urlPath: `/join/author?token=${conference.authorJoinToken}`,
    };
  }

  async rotateAuthorJoinLink(userId: string, conferenceId: string, userRoles: RoleKind[]) {
    if (maxRoleRank(userRoles) < maxRoleRank(['ORGANIZER'])) {
      throw new ForbiddenException('Insufficient permissions to rotate submit link');
    }

    const conference = await this.loadConference(userId, conferenceId, userRoles);
    const newToken = generateId();

    await withTenantContext(
      {
        userId,
        organizationId: conference.organizationId,
        conferenceId,
      },
      async (tx) =>
        tx.conference.update({
          where: { id: conferenceId },
          data: {
            authorJoinToken: newToken,
            version: { increment: 1 },
          },
        }),
    );

    await this.audit.log({
      actorUserId: userId,
      organizationId: conference.organizationId,
      conferenceId,
      action: 'author_join_link.rotated',
      entity: 'conference',
      entityId: conferenceId,
    });

    return {
      token: newToken,
      urlPath: `/join/author?token=${newToken}`,
    };
  }
}
