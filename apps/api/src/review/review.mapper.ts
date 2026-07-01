import type {
  Bid,
  BlindingMode,
  ConflictOfInterest,
  Decision,
  Rebuttal,
  Review,
  ReviewRound,
  ReviewerAssignment,
  ReviewerInvitation,
} from '@openconferences/db';
import type {
  BidDto,
  BlindedPaperPoolItemDto,
  ConflictOfInterestDto,
  DecisionDto,
  RebuttalDto,
  ReviewDto,
  ReviewRoundDto,
  ReviewerAssignmentDto,
  ReviewerInvitationDto,
} from '@openconferences/schemas';
import type { Authorship } from '@openconferences/db';

export function mapReviewRound(round: ReviewRound): ReviewRoundDto {
  return {
    id: round.id,
    organizationId: round.organizationId,
    conferenceId: round.conferenceId,
    roundNumber: round.roundNumber,
    status: round.status,
    reviewDueAt: round.reviewDueAt?.toISOString() ?? null,
    rebuttalDueAt: round.rebuttalDueAt?.toISOString() ?? null,
    revisionDueAt: round.revisionDueAt?.toISOString() ?? null,
    version: round.version,
    createdAt: round.createdAt.toISOString(),
    updatedAt: round.updatedAt.toISOString(),
  };
}

export function mapReviewerInvitation(invitation: ReviewerInvitation): ReviewerInvitationDto {
  return {
    id: invitation.id,
    organizationId: invitation.organizationId,
    conferenceId: invitation.conferenceId,
    email: invitation.email,
    invitedUserId: invitation.invitedUserId,
    status: invitation.status,
    expiresAt: invitation.expiresAt.toISOString(),
    roleNote: invitation.roleNote,
    createdAt: invitation.createdAt.toISOString(),
    updatedAt: invitation.updatedAt.toISOString(),
  };
}

export function mapBid(bid: Bid): BidDto {
  return {
    id: bid.id,
    organizationId: bid.organizationId,
    conferenceId: bid.conferenceId,
    paperId: bid.paperId,
    reviewerUserId: bid.reviewerUserId,
    value: bid.value,
    createdAt: bid.createdAt.toISOString(),
    updatedAt: bid.updatedAt.toISOString(),
  };
}

export function mapConflictOfInterest(coi: ConflictOfInterest): ConflictOfInterestDto {
  return {
    id: coi.id,
    organizationId: coi.organizationId,
    conferenceId: coi.conferenceId,
    userId: coi.userId,
    paperId: coi.paperId,
    withUserId: coi.withUserId,
    type: coi.type,
    source: coi.source,
    note: coi.note,
    createdAt: coi.createdAt.toISOString(),
    updatedAt: coi.updatedAt.toISOString(),
  };
}

export function mapReviewerAssignment(assignment: ReviewerAssignment): ReviewerAssignmentDto {
  return {
    id: assignment.id,
    organizationId: assignment.organizationId,
    conferenceId: assignment.conferenceId,
    roundId: assignment.roundId,
    paperId: assignment.paperId,
    reviewerUserId: assignment.reviewerUserId,
    status: assignment.status,
    dueAt: assignment.dueAt?.toISOString() ?? null,
    version: assignment.version,
    createdAt: assignment.createdAt.toISOString(),
    updatedAt: assignment.updatedAt.toISOString(),
  };
}

function normalizeScores(scores: unknown): Record<string, number> {
  if (!scores || typeof scores !== 'object' || Array.isArray(scores)) {
    return {};
  }
  const result: Record<string, number> = {};
  for (const [key, value] of Object.entries(scores)) {
    if (typeof value === 'number') {
      result[key] = value;
    }
  }
  return result;
}

export function mapReview(review: Review, options?: { hideReviewer?: boolean }): ReviewDto {
  const dto: ReviewDto = {
    id: review.id,
    organizationId: review.organizationId,
    conferenceId: review.conferenceId,
    assignmentId: review.assignmentId,
    roundId: review.roundId,
    paperId: review.paperId,
    scores: normalizeScores(review.scores),
    recommendation: review.recommendation,
    confidence: review.confidence,
    commentsToAuthors: review.commentsToAuthors,
    commentsToChairs: review.commentsToChairs,
    visibility: review.visibility,
    submittedAt: review.submittedAt?.toISOString() ?? null,
    version: review.version,
    createdAt: review.createdAt.toISOString(),
    updatedAt: review.updatedAt.toISOString(),
  };

  if (!options?.hideReviewer) {
    dto.reviewerUserId = review.reviewerUserId;
  }

  return dto;
}

export function mapReviewForAuthor(review: Review): ReviewDto {
  const mapped = mapReview(review, { hideReviewer: true });
  return {
    ...mapped,
    commentsToChairs: undefined,
  };
}

export function mapRebuttal(rebuttal: Rebuttal): RebuttalDto {
  return {
    id: rebuttal.id,
    organizationId: rebuttal.organizationId,
    conferenceId: rebuttal.conferenceId,
    paperId: rebuttal.paperId,
    roundId: rebuttal.roundId,
    authoredByUserId: rebuttal.authoredByUserId,
    body: rebuttal.body,
    submittedAt: rebuttal.submittedAt?.toISOString() ?? null,
    version: rebuttal.version,
    createdAt: rebuttal.createdAt.toISOString(),
    updatedAt: rebuttal.updatedAt.toISOString(),
  };
}

export function mapDecision(decision: Decision): DecisionDto {
  return {
    id: decision.id,
    organizationId: decision.organizationId,
    conferenceId: decision.conferenceId,
    paperId: decision.paperId,
    roundId: decision.roundId,
    decidedById: decision.decidedById,
    outcome: decision.outcome,
    rationale: decision.rationale,
    notifiedAt: decision.notifiedAt?.toISOString() ?? null,
    version: decision.version,
    createdAt: decision.createdAt.toISOString(),
    updatedAt: decision.updatedAt.toISOString(),
  };
}

export function shouldShowAuthorsToReviewer(blindingMode: BlindingMode): boolean {
  return blindingMode === 'SINGLE' || blindingMode === 'OPEN';
}

export function blindAuthorships(
  blindingMode: BlindingMode,
  authorships: Authorship[],
): BlindedPaperPoolItemDto['authorships'] {
  if (!shouldShowAuthorsToReviewer(blindingMode)) {
    return undefined;
  }

  return authorships.map((a) => ({
    id: a.id,
    fullName: a.fullName,
    email: a.email,
    affiliation: a.affiliation,
    order: a.order,
  }));
}

export const PRIVILEGED_READER_ROLES = [
  'PLATFORM_ADMIN',
  'ORG_ADMIN',
  'ORGANIZER',
  'CHAIR',
] as const;

export function isPrivilegedReader(roles: string[]): boolean {
  return PRIVILEGED_READER_ROLES.some((role) => roles.includes(role));
}

export function isReviewer(roles: string[]): boolean {
  return roles.includes('REVIEWER') || isPrivilegedReader(roles);
}
