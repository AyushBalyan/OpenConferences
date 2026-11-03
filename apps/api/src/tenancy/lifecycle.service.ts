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

    const result = await withTenantContext({ userId: actorUserId, conferenceId }, async (tx) => {
      const [conference] = await tx.$queryRaw<Conference[]>`
        SELECT * FROM conferences WHERE id = ${conferenceId}::uuid AND "deletedAt" IS NULL FOR UPDATE
      `;
      if (!conference) throw new NotFoundException('Conference not found');
      const effectiveStatus = deriveStatusFromWindows(conference);
      const allowed = new Set([
        ...VALID_STATUS_TRANSITIONS[conference.status],
        ...VALID_STATUS_TRANSITIONS[effectiveStatus],
      ]);
      if (!allowed.has(targetStatus) && conference.status !== targetStatus)
        throw new ConflictException(`Cannot transition from ${effectiveStatus} to ${targetStatus}`);
      if (expectedVersion !== undefined && conference.version !== expectedVersion - 1)
        throw new ConflictException('Conference version mismatch');
      if (targetStatus === 'CFP_OPEN') {
        if (
          !conference.cfpOpensAt ||
          !conference.cfpClosesAt ||
          conference.cfpOpensAt >= conference.cfpClosesAt
        )
          throw new ConflictException(
            'Configure a valid CFP opening and closing time before publishing',
          );
        if (new Date() >= conference.cfpClosesAt)
          throw new ConflictException(
            'Extend the CFP closing date in Settings before reopening submissions',
          );
      }
      const updated = await tx.conference.update({
        where: { id: conferenceId },
        data: { status: targetStatus, version: { increment: 1 } },
      });
      return { updated, from: conference.status };
    });
    const updated = result.updated;

    await this.audit.log({
      actorUserId,
      organizationId: updated.organizationId,
      conferenceId,
      action: 'conference.status_transition',
      entity: 'conference',
      entityId: conferenceId,
      diff: { from: result.from, to: targetStatus },
    });

    return updated;
  }
}
