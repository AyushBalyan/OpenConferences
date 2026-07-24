import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Conference, ConferenceStatus, RoleKind } from '@openconferences/db';
import { withTenantContext } from '@openconferences/db';
import { AuditService } from '../audit/audit.service';
import { VALID_STATUS_TRANSITIONS, deriveStatusFromWindows } from './tenancy.mapper';
import { maxRoleRank } from './role-hierarchy';

@Injectable()
export class LifecycleService {
  constructor(private readonly audit: AuditService) {}

  deriveStatus(conference: Conference): ConferenceStatus {
    return deriveStatusFromWindows(conference);
  }

  async transition(
    actorUserId: string,
    conferenceId: string,
    targetStatus: ConferenceStatus,
    userRoles: RoleKind[],
    expectedVersion?: number,
  ): Promise<Conference> {
    if (maxRoleRank(userRoles) < maxRoleRank(['ORGANIZER'])) {
      throw new ForbiddenException('Insufficient permissions to transition conference status');
    }

    const conference = await withTenantContext(
      {
        userId: actorUserId,
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

    const allowed = VALID_STATUS_TRANSITIONS[conference.status] ?? [];
    if (!allowed.includes(targetStatus) && conference.status !== targetStatus) {
      throw new ConflictException(`Cannot transition from ${conference.status} to ${targetStatus}`);
    }

    if (expectedVersion !== undefined && conference.version !== expectedVersion - 1) {
      throw new ConflictException('Conference version mismatch');
    }

    if (targetStatus === 'CFP_OPEN') {
      if (!conference.cfpOpensAt || !conference.cfpClosesAt) {
        throw new ConflictException('CFP phase windows must be configured before opening CFP');
      }
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
            status: targetStatus,
            version: { increment: 1 },
          },
        }),
    );

    await this.audit.log({
      actorUserId,
      organizationId: conference.organizationId,
      conferenceId,
      action: 'conference.status_transition',
      entity: 'conference',
      entityId: conferenceId,
      diff: { from: conference.status, to: targetStatus },
    });

    return updated;
  }
}
