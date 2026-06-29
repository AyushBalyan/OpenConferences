import { Injectable, Logger } from '@nestjs/common';
import { prisma, generateId, type Prisma } from '@openconferences/db';

export type AuditLogInput = {
  actorUserId?: string | null;
  organizationId?: string | null;
  conferenceId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  diff?: Prisma.InputJsonValue;
};

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  async log(input: AuditLogInput): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          id: generateId(),
          actorUserId: input.actorUserId ?? null,
          organizationId: input.organizationId ?? null,
          conferenceId: input.conferenceId ?? null,
          action: input.action,
          entity: input.entity,
          entityId: input.entityId ?? null,
          diff: input.diff ?? undefined,
        },
      });
    } catch (error) {
      this.logger.error({ err: error, action: input.action }, 'Failed to write audit log');
    }
  }
}
