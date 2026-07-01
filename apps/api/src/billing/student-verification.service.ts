import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { NotificationPublisher } from '../messaging/notification.publisher';
import type { RoleKind } from '@openconferences/db';
import { generateId, withTenantContext } from '@openconferences/db';
import type {
  CompleteStudentDocUploadInput,
  InitiateStudentDocUploadInput,
  ReviewVerificationInput,
  StudentVerificationListDto,
} from '@openconferences/schemas';
import { getConfig } from '@openconferences/config/env';
import { assertScope } from '../common/scope/assert-scope';
import { AuditService } from '../audit/audit.service';
import { FilesService } from '../files/files.service';
import { ConferenceService } from '../tenancy/conference.service';
import { canCoordinateReview } from '../tenancy/role-hierarchy';
import { PapersService } from '../submission/papers.service';
import { mapRegistration, mapStudentVerification } from './billing.mapper';
import { parseFeeSchedule, resolveMatrixAmount } from './fee-resolver';
import { computePaidState, lockRegistrationForUpdate } from './paid-state';
import { RegistrationsService } from './registrations.service';

@Injectable()
export class StudentVerificationService {
  constructor(
    private readonly conferences: ConferenceService,
    private readonly papers: PapersService,
    private readonly registrations: RegistrationsService,
    private readonly files: FilesService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationPublisher,
  ) {}

  async initiateDocUpload(
    userId: string,
    conferenceId: string,
    paperId: string,
    input: InitiateStudentDocUploadInput,
    roles: RoleKind[],
  ) {
    const conference = await this.conferences.loadConference(userId, conferenceId, roles);
    await this.papers.loadPaper(userId, conferenceId, paperId, roles);
    const registration = await this.registrations.loadRegistration(userId, conferenceId, paperId);

    if (registration.audience !== 'STUDENT') {
      throw new UnprocessableEntityException(
        'Student document upload is only for STUDENT audience',
      );
    }

    const presigned = await this.files.presignStudentVerificationUpload({
      organizationId: conference.organizationId,
      conferenceId,
      paperId,
      registrationId: registration.id,
      userId,
      originalFilename: input.originalFilename,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
    });

    return presigned;
  }

  async completeDocUpload(
    userId: string,
    conferenceId: string,
    paperId: string,
    input: CompleteStudentDocUploadInput,
    roles: RoleKind[],
  ) {
    const conference = await this.conferences.loadConference(userId, conferenceId, roles);
    await this.papers.loadPaper(userId, conferenceId, paperId, roles);
    const registration = await this.registrations.loadRegistration(userId, conferenceId, paperId);

    const fileAsset = await this.files.finalizeStudentVerificationUpload({
      organizationId: conference.organizationId,
      conferenceId,
      paperId,
      registrationId: registration.id,
      userId,
      objectKey: input.objectKey,
    });

    const verification = await withTenantContext(
      { userId, conferenceId, organizationId: conference.organizationId, bypass: true },
      async (tx) =>
        tx.studentVerification.create({
          data: {
            id: generateId(),
            organizationId: conference.organizationId,
            registrationId: registration.id,
            fileAssetId: fileAsset.id,
            status: 'PENDING',
          },
        }),
    );

    await this.audit.log({
      actorUserId: userId,
      organizationId: conference.organizationId,
      conferenceId,
      action: 'student_verification.submitted',
      entity: 'StudentVerification',
      entityId: verification.id,
      diff: { registrationId: registration.id },
    });

    return mapStudentVerification(verification);
  }

  async listPending(
    userId: string,
    conferenceId: string,
    roles: RoleKind[],
  ): Promise<StudentVerificationListDto> {
    if (!canCoordinateReview(roles)) {
      throw new ForbiddenException('Insufficient permissions to view verifications');
    }

    const conference = await this.conferences.loadConference(userId, conferenceId, roles);

    const rows = await withTenantContext(
      { userId, conferenceId, organizationId: conference.organizationId },
      async (tx) =>
        tx.studentVerification.findMany({
          where: {
            organizationId: conference.organizationId,
            status: 'PENDING',
            registration: { conferenceId },
          },
          include: {
            registration: {
              include: { paper: { select: { title: true } } },
            },
          },
          orderBy: { submittedAt: 'asc' },
        }),
    );

    return {
      data: rows.map((row) => ({
        ...mapStudentVerification(row),
        paperTitle: row.registration.paper.title,
        registrationAudience: row.registration.audience,
      })),
    };
  }

  async review(
    userId: string,
    conferenceId: string,
    verificationId: string,
    input: ReviewVerificationInput,
    roles: RoleKind[],
  ) {
    if (!canCoordinateReview(roles)) {
      throw new ForbiddenException('Insufficient permissions to review verifications');
    }

    const conference = await this.conferences.loadConference(userId, conferenceId, roles);
    const config = getConfig();

    const updatedRegistration = await withTenantContext(
      { userId, conferenceId, organizationId: conference.organizationId, bypass: true },
      async (tx) => {
        const verification = await tx.studentVerification.findFirst({
          where: { id: verificationId },
          include: { registration: true },
        });

        if (!verification) {
          throw new NotFoundException('Student verification not found');
        }

        assertScope(verification.registration, { conferenceId });

        if (
          verification.status !== 'PENDING' &&
          verification.status !== 'CLARIFICATION_REQUESTED'
        ) {
          throw new ConflictException('Verification is not in a reviewable state');
        }

        const registration = await lockRegistrationForUpdate(tx, verification.registrationId);
        if (!registration) {
          throw new NotFoundException('Registration not found');
        }

        const now = new Date();

        if (input.action === 'APPROVE') {
          await tx.studentVerification.update({
            where: { id: verificationId },
            data: {
              status: 'APPROVED',
              reviewedById: userId,
              reviewedAt: now,
              note: input.note ?? null,
            },
          });

          const updated = await tx.registration.update({
            where: { id: registration.id },
            data: { status: 'PAID', version: { increment: 1 } },
          });

          return updated;
        }

        if (input.action === 'CLARIFY') {
          if (!input.note?.trim()) {
            throw new BadRequestException('Clarification note is required');
          }

          await tx.studentVerification.update({
            where: { id: verificationId },
            data: {
              status: 'CLARIFICATION_REQUESTED',
              reviewedById: userId,
              reviewedAt: now,
              note: input.note,
            },
          });

          return registration;
        }

        const feeSchedule = parseFeeSchedule(conference.feeSchedule);
        if (!registration.lockedTiming) {
          throw new ConflictException(
            'Registration timing must be locked before rejection handling',
          );
        }

        const regularDue = resolveMatrixAmount(feeSchedule, 'REGULAR', registration.lockedTiming);

        await tx.studentVerification.update({
          where: { id: verificationId },
          data: {
            status: 'REJECTED',
            reviewedById: userId,
            reviewedAt: now,
            note: input.note ?? 'Student verification rejected',
          },
        });

        const graceUntil = new Date(
          registration.deadlineAt.getTime() +
            config.billing.additionalGraceDays * 24 * 60 * 60 * 1000,
        );

        const updated = await tx.registration.update({
          where: { id: registration.id },
          data: {
            amountDueMinor: regularDue,
            status: 'ADDITIONAL_PAYMENT_REQUIRED',
            additionalGraceUntil: graceUntil,
            version: { increment: 1 },
          },
        });

        const paidState = await computePaidState(tx, registration.id);
        if (paidState.netMinor >= regularDue) {
          return tx.registration.update({
            where: { id: registration.id },
            data: { status: 'PAID', version: { increment: 1 } },
          });
        }

        return updated;
      },
    );

    await this.audit.log({
      actorUserId: userId,
      organizationId: conference.organizationId,
      conferenceId,
      action: `student_verification.${input.action.toLowerCase()}`,
      entity: 'StudentVerification',
      entityId: verificationId,
      diff: { note: input.note },
    });

    const context = await withTenantContext({ bypass: true }, async (tx) =>
      tx.studentVerification.findFirst({
        where: { id: verificationId },
        include: {
          registration: {
            include: {
              paper: { include: { authorships: true } },
              payer: { select: { email: true } },
            },
          },
        },
      }),
    );

    if (context) {
      const reg = context.registration;
      const corresponding =
        reg.paper.authorships.find((a) => a.isCorresponding) ?? reg.paper.authorships[0];
      const to = reg.payer?.email ?? corresponding?.email;
      if (to) {
        const base = {
          to,
          conferenceId,
          organizationId: conference.organizationId,
          paperTitle: reg.paper.title,
          verificationId,
        };

        if (input.action === 'APPROVE') {
          await this.notifications.publishVerificationApproved({
            ...base,
            idempotencyKey: `verification-approved-${verificationId}`,
          });
        } else if (input.action === 'CLARIFY') {
          await this.notifications.publishClarificationRequested({
            ...base,
            note: input.note ?? '',
            idempotencyKey: `verification-clarify-${verificationId}`,
          });
        } else {
          const amountFormatted = `${reg.amountDueMinor / 100} ${reg.currency}`;
          await this.notifications.publishAdditionalPaymentRequired({
            ...base,
            amountFormatted,
            registrationId: reg.id,
            idempotencyKey: `verification-reject-${verificationId}`,
          });
        }
      }
    }

    return {
      registration: mapRegistration(updatedRegistration),
      message: `Verification ${input.action.toLowerCase()}d successfully`,
    };
  }
}
