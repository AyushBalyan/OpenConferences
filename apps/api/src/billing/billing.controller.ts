import { Controller, Headers, UseGuards } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { billingContract } from '@openconferences/contracts';
import type { RoleKind } from '@openconferences/db';
import { AuthGuard } from '../common/guards/auth.guard';
import { MembershipGuard } from '../common/guards/membership.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RoleGrants } from '../common/decorators/role-grants.decorator';
import { RequireMembership } from '../common/decorators/require-membership.decorator';
import { RequireReviewCoordination } from '../common/decorators/require-review-coordination.decorator';
import type { AuthUser } from '../auth/auth.types';
import { ConferenceService } from '../tenancy/conference.service';
import { RegistrationsService } from './registrations.service';
import { PaymentsService } from './payments.service';
import { StudentVerificationService } from './student-verification.service';
import { InvoicesService } from './invoices.service';

@Controller()
@UseGuards(AuthGuard, MembershipGuard)
export class BillingController {
  constructor(
    private readonly registrations: RegistrationsService,
    private readonly payments: PaymentsService,
    private readonly studentVerification: StudentVerificationService,
    private readonly invoices: InvoicesService,
    private readonly conferences: ConferenceService,
  ) {}

  @TsRestHandler(billingContract.getRegistration)
  @RequireMembership()
  getRegistration(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(billingContract.getRegistration, async ({ params }) => {
      const body = await this.registrations.getRegistration(
        user.id,
        params.conferenceId,
        params.paperId,
        roles,
      );
      return { status: 200 as const, body };
    });
  }

  @TsRestHandler(billingContract.createRegistration)
  @RequireMembership()
  createRegistration(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(billingContract.createRegistration, async ({ params, body }) => {
      const registration = await this.registrations.createRegistration(
        user.id,
        params.conferenceId,
        params.paperId,
        body,
        roles,
      );
      return { status: 201 as const, body: registration };
    });
  }

  @TsRestHandler(billingContract.initiateStudentDocUpload)
  @RequireMembership()
  initiateStudentDocUpload(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(billingContract.initiateStudentDocUpload, async ({ params, body }) => {
      const result = await this.studentVerification.initiateDocUpload(
        user.id,
        params.conferenceId,
        params.paperId,
        body,
        roles,
      );
      return { status: 200 as const, body: result };
    });
  }

  @TsRestHandler(billingContract.completeStudentDocUpload)
  @RequireMembership()
  completeStudentDocUpload(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(billingContract.completeStudentDocUpload, async ({ params, body }) => {
      const verification = await this.studentVerification.completeDocUpload(
        user.id,
        params.conferenceId,
        params.paperId,
        body,
        roles,
      );
      return { status: 201 as const, body: verification };
    });
  }

  @TsRestHandler(billingContract.initiatePayment)
  @RequireMembership()
  initiatePayment(
    @CurrentUser() user: AuthUser,
    @RoleGrants() roles: RoleKind[],
    @Headers('idempotency-key') idempotencyKey: string,
  ) {
    return tsRestHandler(billingContract.initiatePayment, async ({ params }) => {
      const result = await this.payments.initiatePayment(
        user.id,
        params.conferenceId,
        params.paperId,
        idempotencyKey,
        roles,
      );
      return { status: 200 as const, body: result };
    });
  }

  @TsRestHandler(billingContract.getInvoice)
  @RequireMembership()
  getInvoice(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(billingContract.getInvoice, async ({ params }) => {
      const conference = await this.conferences.loadConference(user.id, params.conferenceId, roles);
      const invoice = await this.invoices.getInvoiceDownload(
        user.id,
        params.conferenceId,
        params.paperId,
        conference.organizationId,
      );
      return { status: 200 as const, body: invoice };
    });
  }

  @TsRestHandler(billingContract.listRegistrations)
  @RequireReviewCoordination()
  @RequireMembership()
  listRegistrations(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(billingContract.listRegistrations, async ({ params, query }) => {
      const result = await this.registrations.listRegistrations(
        user.id,
        params.conferenceId,
        roles,
        query,
      );
      return { status: 200 as const, body: result };
    });
  }

  @TsRestHandler(billingContract.listStudentVerifications)
  @RequireReviewCoordination()
  @RequireMembership()
  listStudentVerifications(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(billingContract.listStudentVerifications, async ({ params, query }) => {
      const result = await this.studentVerification.listPending(
        user.id,
        params.conferenceId,
        roles,
        query,
      );
      return { status: 200 as const, body: result };
    });
  }

  @TsRestHandler(billingContract.reviewStudentVerification)
  @RequireReviewCoordination()
  @RequireMembership()
  reviewStudentVerification(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(billingContract.reviewStudentVerification, async ({ params, body }) => {
      const result = await this.studentVerification.review(
        user.id,
        params.conferenceId,
        params.verificationId,
        body,
        roles,
      );
      return { status: 200 as const, body: result };
    });
  }

  @TsRestHandler(billingContract.refundRegistration)
  @RequireReviewCoordination()
  @RequireMembership()
  refundRegistration(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(billingContract.refundRegistration, async ({ params, body }) => {
      const result = await this.payments.refund(
        user.id,
        params.conferenceId,
        params.registrationId,
        body,
        roles,
      );
      return { status: 200 as const, body: result };
    });
  }

  @TsRestHandler(billingContract.extendRegistrationDeadline)
  @RequireReviewCoordination()
  @RequireMembership()
  extendRegistrationDeadline(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(billingContract.extendRegistrationDeadline, async ({ params, body }) => {
      const result = await this.registrations.extendDeadline(
        user.id,
        params.conferenceId,
        params.registrationId,
        body.deadlineAt,
        body.version,
        roles,
      );
      return { status: 200 as const, body: result };
    });
  }
}
