import { Controller, NotFoundException, UseGuards } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { reviewContract } from '@openconferences/contracts';
import type { RoleKind } from '@openconferences/db';
import { AuthGuard } from '../common/guards/auth.guard';
import { MembershipGuard } from '../common/guards/membership.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RoleGrants } from '../common/decorators/role-grants.decorator';
import {
  RequireReviewCoordination,
  RequireConferenceOrganizer,
} from '../common/decorators/require-review-coordination.decorator';
import { RequireRole } from '../common/decorators/require-role.decorator';
import { RequireMembership } from '../common/decorators/require-membership.decorator';
import type { AuthUser } from '../auth/auth.types';
import { AssignmentsService } from './assignments.service';
import { BidsService, CoiService } from './bids.service';
import { InvitationsService } from './invitations.service';
import { RebuttalsService } from './rebuttals.service';
import { DecisionsService } from './decisions.service';
import { ReviewsService } from './reviews.service';
import { RoundsService } from './rounds.service';

@Controller()
@UseGuards(AuthGuard, MembershipGuard)
export class ReviewController {
  constructor(
    private readonly rounds: RoundsService,
    private readonly invitations: InvitationsService,
    private readonly bids: BidsService,
    private readonly coi: CoiService,
    private readonly assignments: AssignmentsService,
    private readonly reviews: ReviewsService,
    private readonly rebuttals: RebuttalsService,
    private readonly decisions: DecisionsService,
  ) {}

  @TsRestHandler(reviewContract.listRounds)
  @RequireMembership()
  listRounds(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(reviewContract.listRounds, async ({ params, query }) => {
      const result = await this.rounds.list(user.id, params.conferenceId, roles, query);
      return { status: 200 as const, body: result };
    });
  }

  @TsRestHandler(reviewContract.createRound)
  @RequireReviewCoordination()
  @RequireMembership()
  createRound(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(reviewContract.createRound, async ({ params, body }) => {
      const round = await this.rounds.create(user.id, params.conferenceId, body, roles);
      return { status: 201 as const, body: round };
    });
  }

  @TsRestHandler(reviewContract.updateRound)
  @RequireReviewCoordination()
  @RequireMembership()
  updateRound(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(reviewContract.updateRound, async ({ params, body }) => {
      const round = await this.rounds.update(
        user.id,
        params.conferenceId,
        params.roundId,
        body,
        roles,
      );
      return { status: 200 as const, body: round };
    });
  }

  @TsRestHandler(reviewContract.listInvitations)
  @RequireConferenceOrganizer()
  @RequireMembership()
  listInvitations(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(reviewContract.listInvitations, async ({ params, query }) => {
      const result = await this.invitations.list(user.id, params.conferenceId, roles, query);
      return { status: 200 as const, body: result };
    });
  }

  @TsRestHandler(reviewContract.issueInvitation)
  @RequireConferenceOrganizer()
  @RequireMembership()
  issueInvitation(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(reviewContract.issueInvitation, async ({ params, body }) => {
      const invitation = await this.invitations.issue(user.id, params.conferenceId, body, roles);
      return { status: 201 as const, body: invitation };
    });
  }

  @TsRestHandler(reviewContract.resendInvitation)
  @RequireConferenceOrganizer()
  @RequireMembership()
  resendInvitation(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(reviewContract.resendInvitation, async ({ params }) => {
      const result = await this.invitations.resend(
        user.id,
        params.conferenceId,
        params.invitationId,
        roles,
      );
      return { status: 200 as const, body: result };
    });
  }

  @TsRestHandler(reviewContract.revokeInvitation)
  @RequireConferenceOrganizer()
  @RequireMembership()
  revokeInvitation(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(reviewContract.revokeInvitation, async ({ params }) => {
      await this.invitations.revoke(user.id, params.conferenceId, params.invitationId, roles);
      return { status: 204 as const, body: undefined };
    });
  }

  @TsRestHandler(reviewContract.listBids)
  @RequireReviewCoordination()
  @RequireMembership()
  listBids(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(reviewContract.listBids, async ({ params, query }) => {
      const result = await this.bids.list(user.id, params.conferenceId, roles, query);
      return { status: 200 as const, body: result };
    });
  }

  @TsRestHandler(reviewContract.getPaperPool)
  @RequireMembership()
  getPaperPool(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(reviewContract.getPaperPool, async ({ params, query }) => {
      const result = await this.bids.getPaperPool(user.id, params.conferenceId, roles, query);
      return { status: 200 as const, body: result };
    });
  }

  @TsRestHandler(reviewContract.upsertBid)
  @RequireRole('REVIEWER')
  @RequireMembership()
  upsertBid(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(reviewContract.upsertBid, async ({ params, body }) => {
      const bid = await this.bids.upsert(user.id, params.conferenceId, params.paperId, body, roles);
      return { status: 200 as const, body: bid };
    });
  }

  @TsRestHandler(reviewContract.listCoi)
  @RequireMembership()
  listCoi(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(reviewContract.listCoi, async ({ params, query }) => {
      const result = await this.coi.list(user.id, params.conferenceId, roles, query);
      return { status: 200 as const, body: result };
    });
  }

  @TsRestHandler(reviewContract.listCoiDeclareTargets)
  @RequireMembership()
  listCoiDeclareTargets(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(reviewContract.listCoiDeclareTargets, async ({ params }) => {
      const result = await this.coi.listDeclareTargets(user.id, params.conferenceId, roles);
      return { status: 200 as const, body: result };
    });
  }

  @TsRestHandler(reviewContract.declareCoi)
  @RequireMembership()
  declareCoi(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(reviewContract.declareCoi, async ({ params, body }) => {
      const coi = await this.coi.declare(user.id, params.conferenceId, body, roles);
      return { status: 201 as const, body: coi };
    });
  }

  @TsRestHandler(reviewContract.deleteCoi)
  @RequireMembership()
  deleteCoi(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(reviewContract.deleteCoi, async ({ params }) => {
      await this.coi.remove(user.id, params.conferenceId, params.coiId, roles);
      return { status: 204 as const, body: undefined };
    });
  }

  @TsRestHandler(reviewContract.listAssignments)
  @RequireReviewCoordination()
  @RequireMembership()
  listAssignments(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(reviewContract.listAssignments, async ({ params, query }) => {
      const result = await this.assignments.list(
        user.id,
        params.conferenceId,
        params.roundId,
        roles,
        query,
      );
      return { status: 200 as const, body: result };
    });
  }

  @TsRestHandler(reviewContract.copyAssignmentsFromPreviousRound)
  @RequireReviewCoordination()
  @RequireMembership()
  copyAssignmentsFromPreviousRound(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(
      reviewContract.copyAssignmentsFromPreviousRound,
      async ({ params, body }) => {
        const result = await this.assignments.copyFromPreviousRound(
          user.id,
          params.conferenceId,
          params.roundId,
          body,
          roles,
        );
        return { status: 200 as const, body: result };
      },
    );
  }

  @TsRestHandler(reviewContract.createAssignment)
  @RequireReviewCoordination()
  @RequireMembership()
  createAssignment(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(reviewContract.createAssignment, async ({ params, body }) => {
      const result = await this.assignments.assign(
        user.id,
        params.conferenceId,
        params.paperId,
        body,
        roles,
      );
      return { status: 201 as const, body: result };
    });
  }

  @TsRestHandler(reviewContract.deleteAssignment)
  @RequireReviewCoordination()
  @RequireMembership()
  deleteAssignment(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(reviewContract.deleteAssignment, async ({ params }) => {
      await this.assignments.unassign(user.id, params.conferenceId, params.assignmentId, roles);
      return { status: 204 as const, body: undefined };
    });
  }

  @TsRestHandler(reviewContract.listMyAssignments)
  @RequireRole('REVIEWER')
  @RequireMembership()
  listMyAssignments(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(reviewContract.listMyAssignments, async ({ params, query }) => {
      const result = await this.reviews.listMyAssignments(
        user.id,
        params.conferenceId,
        roles,
        query,
      );
      return { status: 200 as const, body: result };
    });
  }

  @TsRestHandler(reviewContract.getAssignmentReview)
  @RequireRole('REVIEWER')
  @RequireMembership()
  getAssignmentReview(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(reviewContract.getAssignmentReview, async ({ params }) => {
      const review = await this.reviews.getReview(
        user.id,
        params.conferenceId,
        params.assignmentId,
        roles,
      );
      return { status: 200 as const, body: review };
    });
  }

  @TsRestHandler(reviewContract.saveAssignmentReview)
  @RequireRole('REVIEWER')
  @RequireMembership()
  saveAssignmentReview(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(reviewContract.saveAssignmentReview, async ({ params, body }) => {
      const review = await this.reviews.saveReview(
        user.id,
        params.conferenceId,
        params.assignmentId,
        body,
        roles,
      );
      return { status: 200 as const, body: review };
    });
  }

  @TsRestHandler(reviewContract.submitAssignmentReview)
  @RequireRole('REVIEWER')
  @RequireMembership()
  submitAssignmentReview(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(reviewContract.submitAssignmentReview, async ({ params, body }) => {
      const result = await this.reviews.submitReview(
        user.id,
        params.conferenceId,
        params.assignmentId,
        body,
        roles,
      );
      return { status: 200 as const, body: result };
    });
  }

  @TsRestHandler(reviewContract.listPaperReviews)
  @RequireMembership()
  listPaperReviews(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(reviewContract.listPaperReviews, async ({ params, query }) => {
      const result = await this.reviews.listReviewsForPaper(
        user.id,
        params.conferenceId,
        params.paperId,
        roles,
        query,
      );
      return { status: 200 as const, body: result };
    });
  }

  @TsRestHandler(reviewContract.releaseReviews)
  @RequireReviewCoordination()
  @RequireMembership()
  releaseReviews(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(reviewContract.releaseReviews, async ({ params, body }) => {
      const result = await this.reviews.releaseReviews(
        user.id,
        params.conferenceId,
        params.roundId,
        body,
        roles,
      );
      return { status: 200 as const, body: result };
    });
  }

  @TsRestHandler(reviewContract.getRebuttal)
  @RequireMembership()
  getRebuttal(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(reviewContract.getRebuttal, async ({ params, query }) => {
      const rebuttal = await this.rebuttals.getRebuttal(
        user.id,
        params.conferenceId,
        params.paperId,
        roles,
        query.roundId,
      );
      if (!rebuttal) {
        throw new NotFoundException('Rebuttal not found');
      }
      return { status: 200 as const, body: rebuttal };
    });
  }

  @TsRestHandler(reviewContract.submitRebuttal)
  @RequireMembership()
  submitRebuttal(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(reviewContract.submitRebuttal, async ({ params, body }) => {
      const result = await this.rebuttals.submitRebuttal(
        user.id,
        params.conferenceId,
        params.paperId,
        body,
        roles,
      );
      return { status: 200 as const, body: result };
    });
  }

  @TsRestHandler(reviewContract.listDecisions)
  @RequireReviewCoordination()
  @RequireMembership()
  listDecisions(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(reviewContract.listDecisions, async ({ params, query }) => {
      const result = await this.decisions.listDecisions(user.id, params.conferenceId, roles, query);
      return { status: 200 as const, body: result };
    });
  }

  @TsRestHandler(reviewContract.makeDecision)
  @RequireReviewCoordination()
  @RequireMembership()
  makeDecision(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(reviewContract.makeDecision, async ({ params, body }) => {
      const result = await this.decisions.makeDecision(
        user.id,
        params.conferenceId,
        params.paperId,
        body,
        roles,
      );
      return { status: 201 as const, body: result };
    });
  }

  @TsRestHandler(reviewContract.bulkDecide)
  @RequireReviewCoordination()
  @RequireMembership()
  bulkDecide(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(reviewContract.bulkDecide, async ({ params, body }) => {
      const result = await this.decisions.bulkDecide(
        user.id,
        params.conferenceId,
        params.roundId,
        body,
        roles,
      );
      return { status: 201 as const, body: result };
    });
  }

  @TsRestHandler(reviewContract.notifyDecisions)
  @RequireReviewCoordination()
  @RequireMembership()
  notifyDecisions(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(reviewContract.notifyDecisions, async ({ params, body }) => {
      const result = await this.decisions.notifyDecisions(
        user.id,
        params.conferenceId,
        params.roundId,
        body,
        roles,
      );
      return { status: 200 as const, body: result };
    });
  }

  @TsRestHandler(reviewContract.getPaperDecision)
  @RequireMembership()
  getPaperDecision(@CurrentUser() user: AuthUser, @RoleGrants() roles: RoleKind[]) {
    return tsRestHandler(reviewContract.getPaperDecision, async ({ params, query }) => {
      const decision = await this.decisions.getPaperDecision(
        user.id,
        params.conferenceId,
        params.paperId,
        roles,
        query.roundId,
      );
      return { status: 200 as const, body: decision };
    });
  }
}

@Controller()
@UseGuards(AuthGuard)
export class ReviewInvitationController {
  constructor(private readonly invitations: InvitationsService) {}

  @TsRestHandler(reviewContract.acceptInvitation)
  acceptInvitation(@CurrentUser() user: AuthUser) {
    return tsRestHandler(reviewContract.acceptInvitation, async ({ body }) => {
      const result = await this.invitations.accept(user.id, body.token);
      return { status: 200 as const, body: result };
    });
  }

  @TsRestHandler(reviewContract.acceptPendingInvitations)
  acceptPendingInvitations(@CurrentUser() user: AuthUser) {
    return tsRestHandler(reviewContract.acceptPendingInvitations, async () => {
      const result = await this.invitations.acceptPendingForUser(user.id);
      return { status: 200 as const, body: result };
    });
  }

  @TsRestHandler(reviewContract.declineInvitation)
  declineInvitation(@CurrentUser() user: AuthUser) {
    return tsRestHandler(reviewContract.declineInvitation, async ({ body }) => {
      const result = await this.invitations.decline(user.id, body.token);
      return { status: 200 as const, body: result };
    });
  }
}
