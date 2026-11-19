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
import {
  paginateItems,
  prismaCursorArgs,
  resolveLimit,
  type CursorPaginationOptions,
} from '../common/pagination/cursor';
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
    const registration = await this.registrations.loadRegistrationForPayment(
      userId,
      conferenceId,
      paperId,
      roles,
    );
    if (registration.userId && registration.userId !== userId)
      throw new ForbiddenException('Only the registering author can upload student proof');
    if (
      registration.audience !== 'STUDENT' ||
      !['PENDING', 'AWAITING_VERIFICATION'].includes(registration.status)
    )
      throw new ConflictException('Student proof cannot be uploaded for this registration');

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
    const registration = await this.registrations.loadRegistrationForPayment(
      userId,
      conferenceId,
      paperId,
      roles,
    );
    if (registration.userId && registration.userId !== userId)
      throw new ForbiddenException('Only the registering author can upload student proof');
    if (
      registration.audience !== 'STUDENT' ||
      !['PENDING', 'AWAITING_VERIFICATION'].includes(registration.status)
    )
      throw new ConflictException('Student proof cannot be uploaded for this registration');

    const fileAsset = await this.files.finalizeStudentVerificationUpload({
      organizationId: conference.organizationId,
      conferenceId,
      paperId,
      registrationId: registration.id,
      userId,
      objectKey: input.objectKey,
    });

    const verification = await withTenantContext(
      { userId, conferenceId, organizationId: conference.organizationId },
      async (tx) => {
        const current = await lockRegistrationForUpdate(tx, registration.id);
        if (
          !current ||
          current.audience !== 'STUDENT' ||
          !['PENDING', 'AWAITING_VERIFICATION'].includes(current.status)
        )
          throw new ConflictException('Registration is no longer eligible for student proof');
        const existing = await tx.studentVerification.findFirst({
          where: { fileAssetId: fileAsset.id, registrationId: registration.id },
        });
        if (existing) return existing;
        await tx.studentVerification.updateMany({
          where: {
            registrationId: registration.id,
            status: { in: ['PENDING', 'CLARIFICATION_REQUESTED'] },
          },
          data: { status: 'REJECTED', note: 'Replaced by a newer document' },
        });
        return tx.studentVerification.create({
          data: {
            id: generateId(),
            organizationId: conference.organizationId,
            registrationId: registration.id,
            fileAssetId: fileAsset.id,
            status: 'PENDING',
          },
        });
      },
    );

    await this.files.enqueueStudentDocumentScan(
      fileAsset,
      paperId,
      conferenceId,
      conference.organizationId,
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
    options: CursorPaginationOptions = {},
  ): Promise<StudentVerificationListDto> {
    if (!canCoordinateReview(roles)) {
      throw new ForbiddenException('Insufficient permissions to view verifications');
    }

    const conference = await this.conferences.loadConference(userId, conferenceId, roles);
    const limit = resolveLimit(options.limit);

    const rows = await withTenantContext(
      { userId, conferenceId, organizationId: conference.organizationId },
      async (tx) =>
        tx.studentVerification.findMany({
          where: {
            organizationId: conference.organizationId,
            registration: {
              conferenceId,
              status: { notIn: ['CANCELLED', 'REFUNDED', 'DISCARDED_NONPAYMENT'] },
            },
          },
          include: {
            fileAsset: true,
            registration: {
              include: {
                paper: { select: { title: true, submittedAt: true, submissionNumber: true } },
              },
            },
          },
          orderBy: { submittedAt: 'asc' },
          ...prismaCursorArgs(options, limit),
        }),
    );

    const page = paginateItems(rows, limit, (row) => row.id);

    return {
      data: page.data.map((row) => ({
        ...mapStudentVerification(row),
        paperId: row.registration.paperId,
        submissionNumber: row.registration.paper.submissionNumber,
        paperTitle: row.registration.paper.title,
        paperSubmittedAt: row.registration.paper.submittedAt?.toISOString() ?? null,
        registrationAudience: row.registration.audience,
        scanStatus: row.fileAsset.scanStatus,
        originalFilename: row.fileAsset.originalFilename,
      })),
      nextCursor: page.nextCursor,
    };
  }

  async downloadDocument(
    userId: string,
    conferenceId: string,
    verificationId: string,
    roles: RoleKind[],
    disposition: 'attachment' | 'inline' = 'attachment',
  ) {
    if (!canCoordinateReview(roles))
      throw new ForbiddenException('Only organizers and chairs can download student documents');
    const conference = await this.conferences.loadConference(userId, conferenceId, roles);
    const verification = await withTenantContext(
      { userId, conferenceId, organizationId: conference.organizationId },
      (tx) =>
        tx.studentVerification.findFirst({
          where: { id: verificationId, registration: { conferenceId } },
          include: { fileAsset: true },
        }),
    );
    if (!verification) throw new NotFoundException('Student verification not found');
    const result = await this.files.presignDownload(
      verification.fileAssetId,
      userId,
      conference.organizationId,
      disposition,
      verification.fileAsset.originalFilename,
    );
    await this.audit.log({
      actorUserId: userId,
      organizationId: conference.organizationId,
      conferenceId,
      action: 'student_verification.downloaded',
      entity: 'StudentVerification',
      entityId: verificationId,
    });
    return result;
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
    // What a rejection leaves the author owing, for the email sent afterwards.
    let balance: { dueMinor: number; payBy: Date } | null = null;

    const updatedRegistration = await withTenantContext(
      { userId, conferenceId, organizationId: conference.organizationId },
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

        if (['CANCELLED', 'DISCARDED_NONPAYMENT', 'REFUNDED'].includes(registration.status))
          throw new ConflictException('Registration is no longer eligible for verification');

        // Serialize review decisions with checkout and other reviewers, then
        // re-read the document to reject stale/replaced or already reviewed rows.
        const latest = await tx.studentVerification.findFirst({
          where: { registrationId: registration.id },
          orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
          include: { fileAsset: true },
        });
        if (
          !latest ||
          latest.id !== verificationId ||
          !['PENDING', 'CLARIFICATION_REQUESTED'].includes(latest.status)
        )
          throw new ConflictException('Verification was reviewed or replaced; refresh the list');
        if (input.action === 'APPROVE' && latest.fileAsset.scanStatus !== 'CLEAN')
          throw new ConflictException('Document must pass scanning before approval');
        if (registration.userId === userId || latest.fileAsset.uploadedById === userId)
          throw new ForbiddenException('You cannot review your own student document');
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

          const paidState = await computePaidState(tx, registration.id);
          const fullyPaid =
            registration.amountDueMinor > 0 && paidState.netMinor >= registration.amountDueMinor;
          const updated = await tx.registration.update({
            where: { id: registration.id },
            data: { status: fullyPaid ? 'PAID' : registration.status, version: { increment: 1 } },
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

        // A rejection changes what the author pays, so they are always told why.
        if (!input.note?.trim()) {
          throw new BadRequestException('Rejection reason is required');
        }

        const feeSchedule = parseFeeSchedule(conference.feeSchedule);
        if (!registration.lockedTiming) {
          await tx.studentVerification.update({
            where: { id: verificationId },
            data: {
              status: 'REJECTED',
              reviewedById: userId,
              reviewedAt: now,
              note: input.note ?? 'Student verification rejected',
            },
          });
          return tx.registration.update({
            where: { id: registration.id },
            data: { audience: 'REGULAR', version: { increment: 1 } },
          });
        }

        const regularDue =
          registration.regularAmountDueMinor ??
          resolveMatrixAmount(feeSchedule, 'REGULAR', registration.lockedTiming);

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

        balance = { dueMinor: regularDue - paidState.netMinor, payBy: graceUntil };
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

    // Read as the reviewer: with no tenant context, row-level security hides the
    // verification and the author would never be emailed.
    const context = await withTenantContext(
      { userId, conferenceId, organizationId: conference.organizationId },
      async (tx) =>
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
          paperId: reg.paperId,
          paperTitle: reg.paper.title,
          verificationId,
        };
        const owed = balance as { dueMinor: number; payBy: Date } | null;

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
        } else if (owed) {
          // Paid at the student rate: ask only for the difference, and say why.
          await this.notifications.publishAdditionalPaymentRequired({
            ...base,
            reason: input.note ?? '',
            amountFormatted: `${(owed.dueMinor / 100).toFixed(2)} ${reg.currency}`,
            deadlineAt: owed.payBy.toISOString(),
            registrationId: reg.id,
            idempotencyKey: `verification-reject-${verificationId}`,
          });
        } else {
          // Not paid yet, or the payment already covers the regular fee.
          await this.notifications.publishStudentRateRejected({
            ...base,
            reason: input.note ?? '',
            paidInFull: updatedRegistration.status === 'PAID',
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
