import { z } from 'zod';
import { paperSchema } from './submission.js';
import { cursorPaginationQuerySchema } from './pagination.js';

export const bidValueSchema = z.enum(['EAGER', 'YES', 'MAYBE', 'NO', 'CONFLICT']);
export const coiTypeSchema = z.enum([
  'CO_AUTHOR',
  'INSTITUTION',
  'ADVISOR_STUDENT',
  'PERSONAL',
  'FINANCIAL',
  'OTHER',
]);
export const coiSourceSchema = z.enum(['SELF', 'CHAIR', 'SYSTEM']);
export const roundStatusSchema = z.enum(['OPEN', 'REVIEWING', 'REBUTTAL', 'DECIDING', 'CLOSED']);
export const invitationStatusSchema = z.enum(['PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED']);
export const assignmentStatusSchema = z.enum(['ASSIGNED', 'ACCEPTED', 'DECLINED', 'COMPLETED']);

export type BidValue = z.infer<typeof bidValueSchema>;
export type CoiType = z.infer<typeof coiTypeSchema>;
export type RoundStatus = z.infer<typeof roundStatusSchema>;
export type AssignmentStatus = z.infer<typeof assignmentStatusSchema>;
export type InvitationStatus = z.infer<typeof invitationStatusSchema>;

export const reviewRoundSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  conferenceId: z.string().uuid(),
  roundNumber: z.number().int().positive(),
  status: roundStatusSchema,
  reviewDueAt: z.string().datetime().nullable(),
  rebuttalDueAt: z.string().datetime().nullable(),
  revisionDueAt: z.string().datetime().nullable(),
  version: z.number().int(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ReviewRoundDto = z.infer<typeof reviewRoundSchema>;

export const reviewRoundListSchema = z.object({
  data: z.array(reviewRoundSchema),
  nextCursor: z.string().uuid().nullable(),
});

export const reviewRoundListQuerySchema = cursorPaginationQuerySchema;

export const createReviewRoundSchema = z.object({
  roundNumber: z.number().int().positive().default(1),
  reviewDueAt: z.string().datetime().optional(),
  rebuttalDueAt: z.string().datetime().optional(),
  revisionDueAt: z.string().datetime().optional(),
});

export type CreateReviewRoundInput = z.infer<typeof createReviewRoundSchema>;

export const updateReviewRoundSchema = z.object({
  status: roundStatusSchema.optional(),
  reviewDueAt: z.string().datetime().nullable().optional(),
  rebuttalDueAt: z.string().datetime().nullable().optional(),
  revisionDueAt: z.string().datetime().nullable().optional(),
  version: z.number().int().nonnegative(),
});

export type UpdateReviewRoundInput = z.infer<typeof updateReviewRoundSchema>;

export const reviewerInvitationSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  conferenceId: z.string().uuid(),
  email: z.string().email(),
  invitedUserId: z.string().uuid().nullable(),
  status: invitationStatusSchema,
  expiresAt: z.string().datetime(),
  roleNote: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ReviewerInvitationDto = z.infer<typeof reviewerInvitationSchema>;

export const reviewerInvitationListSchema = z.object({
  data: z.array(reviewerInvitationSchema),
  nextCursor: z.string().uuid().nullable(),
});

export const reviewerInvitationListQuerySchema = cursorPaginationQuerySchema;

export const issueReviewerInvitationSchema = z.object({
  email: z.string().email(),
  roleNote: z.string().max(500).optional(),
});

export type IssueReviewerInvitationInput = z.infer<typeof issueReviewerInvitationSchema>;

export const invitationTokenSchema = z.object({
  token: z.string().min(32),
});

export type InvitationTokenInput = z.infer<typeof invitationTokenSchema>;

export const invitationActionResponseSchema = z.object({
  invitation: reviewerInvitationSchema,
  message: z.string(),
});

export const acceptPendingInvitationsResponseSchema = z.object({
  data: z.array(reviewerInvitationSchema),
  message: z.string(),
});

export type AcceptPendingInvitationsResponse = z.infer<
  typeof acceptPendingInvitationsResponseSchema
>;

export const bidSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  conferenceId: z.string().uuid(),
  paperId: z.string().uuid(),
  reviewerUserId: z.string().uuid(),
  value: bidValueSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type BidDto = z.infer<typeof bidSchema>;

export const upsertBidSchema = z.object({
  value: bidValueSchema,
});

export type UpsertBidInput = z.infer<typeof upsertBidSchema>;

export const bidListSchema = z.object({
  data: z.array(
    bidSchema.extend({
      paperTitle: z.string().optional(),
      reviewerName: z.string().optional(),
      reviewerEmail: z.string().email().optional(),
    }),
  ),
  nextCursor: z.string().uuid().nullable(),
});

export const blindedPaperPoolItemSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  abstract: z.string(),
  keywords: z.array(z.string()),
  trackId: z.string().uuid(),
  status: z.string(),
  authorships: z
    .array(
      z.object({
        id: z.string().uuid(),
        fullName: z.string(),
        email: z.string().email(),
        affiliation: z.string().nullable(),
        order: z.number().int(),
      }),
    )
    .optional(),
  myBid: bidValueSchema.nullable().optional(),
  bids: z
    .array(
      z.object({
        reviewerUserId: z.string().uuid(),
        reviewerName: z.string(),
        reviewerEmail: z.string().email(),
        value: bidValueSchema,
      }),
    )
    .optional(),
});

export type BlindedPaperPoolItemDto = z.infer<typeof blindedPaperPoolItemSchema>;

export const blindedPaperPoolSchema = z.object({
  data: z.array(blindedPaperPoolItemSchema),
  nextCursor: z.string().uuid().nullable(),
  blindingMode: z.enum(['SINGLE', 'DOUBLE', 'OPEN']),
  mode: z.enum(['reviewer', 'oversight']).optional(),
});

export const conflictOfInterestSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  conferenceId: z.string().uuid(),
  userId: z.string().uuid(),
  paperId: z.string().uuid().nullable(),
  withUserId: z.string().uuid().nullable(),
  type: coiTypeSchema,
  source: coiSourceSchema,
  note: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ConflictOfInterestDto = z.infer<typeof conflictOfInterestSchema>;

export const declareCoiSchema = z
  .object({
    paperId: z.string().uuid().optional(),
    withUserId: z.string().uuid().optional(),
    type: coiTypeSchema,
    note: z.string().max(1000).optional(),
    userId: z.string().uuid().optional(),
  })
  .refine((data) => data.paperId || data.withUserId, {
    message: 'Either paperId or withUserId is required',
  });

export type DeclareCoiInput = z.infer<typeof declareCoiSchema>;

export const coiListSchema = z.object({
  data: z.array(
    conflictOfInterestSchema.extend({
      userName: z.string().optional(),
      paperTitle: z.string().nullable().optional(),
    }),
  ),
  nextCursor: z.string().uuid().nullable(),
});

export const coiListQuerySchema = cursorPaginationQuerySchema;

export const coiDeclareTargetPaperSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
});

export const coiDeclareTargetPaperListSchema = z.object({
  data: z.array(coiDeclareTargetPaperSchema),
});

export const reviewerAssignmentSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  conferenceId: z.string().uuid(),
  roundId: z.string().uuid(),
  paperId: z.string().uuid(),
  reviewerUserId: z.string().uuid(),
  status: assignmentStatusSchema,
  dueAt: z.string().datetime().nullable(),
  version: z.number().int(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ReviewerAssignmentDto = z.infer<typeof reviewerAssignmentSchema>;

export const createAssignmentSchema = z.object({
  roundId: z.string().uuid(),
  reviewerUserId: z.string().uuid(),
  dueAt: z.string().datetime().optional(),
});

export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;

export const assignmentListSchema = z.object({
  data: z.array(
    reviewerAssignmentSchema.extend({
      paperTitle: z.string().optional(),
      reviewerName: z.string().optional(),
      reviewerEmail: z.string().email().optional(),
      bidValue: bidValueSchema.nullable().optional(),
    }),
  ),
  nextCursor: z.string().uuid().nullable(),
});

export const assignmentListQuerySchema = cursorPaginationQuerySchema;

export const assignmentActionResponseSchema = z.object({
  assignment: reviewerAssignmentSchema,
  message: z.string(),
});

export const copyAssignmentsFromPreviousRoundSchema = z.object({
  paperIds: z.array(z.string().uuid()).optional(),
});

export const copyAssignmentFailureSchema = z.object({
  paperId: z.string().uuid(),
  reviewerUserId: z.string().uuid(),
  reason: z.string(),
});

export const copyAssignmentsFromPreviousRoundResponseSchema = z.object({
  createdCount: z.number().int().nonnegative(),
  skippedCount: z.number().int().nonnegative(),
  failures: z.array(copyAssignmentFailureSchema),
  previousRoundNumber: z.number().int().positive(),
  message: z.string(),
});

export type CopyAssignmentsFromPreviousRoundInput = z.infer<
  typeof copyAssignmentsFromPreviousRoundSchema
>;
export type CopyAssignmentsFromPreviousRoundResponse = z.infer<
  typeof copyAssignmentsFromPreviousRoundResponseSchema
>;

/** Re-export for organizer paper detail with assignment context */
export const paperWithAssignmentsSchema = paperSchema.extend({
  assignments: z.array(reviewerAssignmentSchema).optional(),
});

export const recommendationSchema = z.enum([
  'STRONG_ACCEPT',
  'ACCEPT',
  'WEAK_ACCEPT',
  'BORDERLINE',
  'WEAK_REJECT',
  'REJECT',
  'STRONG_REJECT',
]);

export type Recommendation = z.infer<typeof recommendationSchema>;

export const reviewVisibilitySchema = z.enum(['HIDDEN', 'AUTHOR_VISIBLE', 'PUBLIC']);

export type ReviewVisibility = z.infer<typeof reviewVisibilitySchema>;

export const reviewSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  conferenceId: z.string().uuid(),
  assignmentId: z.string().uuid(),
  roundId: z.string().uuid(),
  paperId: z.string().uuid(),
  reviewerUserId: z.string().uuid().optional(),
  /** Present on assignment review payloads so reviewers can download the assigned PDF. */
  paperTitle: z.string().optional(),
  currentVersionId: z.string().uuid().nullable().optional(),
  scores: z.record(z.string(), z.number()),
  recommendation: recommendationSchema.nullable(),
  confidence: z.number().int().min(1).max(5).nullable(),
  commentsToAuthors: z.string().nullable(),
  commentsToChairs: z.string().nullable().optional(),
  visibility: reviewVisibilitySchema,
  submittedAt: z.string().datetime().nullable(),
  version: z.number().int(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ReviewDto = z.infer<typeof reviewSchema>;

export const saveReviewSchema = z.object({
  scores: z.record(z.string(), z.number()).default({}),
  recommendation: recommendationSchema.nullable().optional(),
  confidence: z.number().int().min(1).max(5).nullable().optional(),
  commentsToAuthors: z.string().max(20000).nullable().optional(),
  commentsToChairs: z.string().max(20000).nullable().optional(),
  version: z.number().int().nonnegative(),
});

export type SaveReviewInput = z.infer<typeof saveReviewSchema>;

export const submitReviewSchema = z.object({
  version: z.number().int().nonnegative(),
});

export type SubmitReviewInput = z.infer<typeof submitReviewSchema>;

export const reviewActionResponseSchema = z.object({
  review: reviewSchema,
  message: z.string(),
});

export const reviewListSchema = z.object({
  data: z.array(reviewSchema),
  roundId: z.string().uuid().optional(),
  roundStatus: roundStatusSchema.optional(),
  nextCursor: z.string().uuid().nullable(),
});

export const reviewListQuerySchema = cursorPaginationQuerySchema.extend({
  roundId: z.string().uuid().optional(),
});

export type ReviewListDto = z.infer<typeof reviewListSchema>;

export const myAssignmentItemSchema = reviewerAssignmentSchema.extend({
  paperTitle: z.string(),
  currentVersionId: z.string().uuid().nullable().optional(),
  roundNumber: z.number().int(),
  roundStatus: roundStatusSchema,
  review: reviewSchema.nullable().optional(),
});

export type MyAssignmentItemDto = z.infer<typeof myAssignmentItemSchema>;

export const myAssignmentsSchema = z.object({
  data: z.array(myAssignmentItemSchema),
  nextCursor: z.string().uuid().nullable(),
});

export const myAssignmentsQuerySchema = cursorPaginationQuerySchema;

export const releaseReviewsSchema = z.object({
  version: z.number().int().nonnegative(),
});

export type ReleaseReviewsInput = z.infer<typeof releaseReviewsSchema>;

export const releaseReviewsResponseSchema = z.object({
  releasedCount: z.number().int(),
  round: reviewRoundSchema,
  message: z.string(),
});

export const rebuttalSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  conferenceId: z.string().uuid(),
  paperId: z.string().uuid(),
  roundId: z.string().uuid(),
  authoredByUserId: z.string().uuid(),
  body: z.string(),
  submittedAt: z.string().datetime().nullable(),
  version: z.number().int(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type RebuttalDto = z.infer<typeof rebuttalSchema>;

export const submitRebuttalSchema = z.object({
  body: z.string().min(1).max(50000),
  version: z.number().int().nonnegative().optional(),
});

export type SubmitRebuttalInput = z.infer<typeof submitRebuttalSchema>;

export const rebuttalActionResponseSchema = z.object({
  rebuttal: rebuttalSchema,
  message: z.string(),
});

export const rebuttalQuerySchema = z.object({
  roundId: z.string().uuid().optional(),
});

export const decisionOutcomeSchema = z.enum([
  'ACCEPT',
  'REJECT',
  'MINOR_REVISION',
  'MAJOR_REVISION',
]);

export type DecisionOutcome = z.infer<typeof decisionOutcomeSchema>;

export const decisionSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  conferenceId: z.string().uuid(),
  paperId: z.string().uuid(),
  roundId: z.string().uuid(),
  decidedById: z.string().uuid(),
  outcome: decisionOutcomeSchema,
  rationale: z.string().nullable(),
  notifiedAt: z.string().datetime().nullable(),
  version: z.number().int(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type DecisionDto = z.infer<typeof decisionSchema>;

export const decisionListSchema = z.object({
  data: z.array(
    decisionSchema.extend({
      paperTitle: z.string().optional(),
      roundNumber: z.number().int().optional(),
    }),
  ),
  roundId: z.string().uuid().optional(),
  nextCursor: z.string().uuid().nullable(),
});

export const decisionQuerySchema = cursorPaginationQuerySchema.extend({
  roundId: z.string().uuid().optional(),
  outcome: decisionOutcomeSchema.optional(),
});

export type DecisionListDto = z.infer<typeof decisionListSchema>;

export const makeDecisionSchema = z.object({
  roundId: z.string().uuid(),
  outcome: decisionOutcomeSchema,
  rationale: z.string().max(10000).nullable().optional(),
  version: z.number().int().nonnegative(),
  notify: z.boolean().optional(),
});

export type MakeDecisionInput = z.infer<typeof makeDecisionSchema>;

export const bulkDecisionItemSchema = z.object({
  paperId: z.string().uuid(),
  outcome: decisionOutcomeSchema,
  rationale: z.string().max(10000).nullable().optional(),
});

export const bulkDecisionSchema = z.object({
  items: z.array(bulkDecisionItemSchema).min(1).max(100),
  notify: z.boolean().optional(),
});

export type BulkDecisionInput = z.infer<typeof bulkDecisionSchema>;

export const notifyDecisionsSchema = z.object({
  paperIds: z.array(z.string().uuid()).optional(),
});

export type NotifyDecisionsInput = z.infer<typeof notifyDecisionsSchema>;

export const decisionActionResponseSchema = z.object({
  decision: decisionSchema,
  message: z.string(),
  nextRound: reviewRoundSchema.nullable().optional(),
});

export type DecisionActionResponse = z.infer<typeof decisionActionResponseSchema>;

export const bulkDecisionResponseSchema = z.object({
  data: z.array(decisionSchema),
  message: z.string(),
});

export type BulkDecisionResponse = z.infer<typeof bulkDecisionResponseSchema>;

export const notifyDecisionsResponseSchema = z.object({
  notifiedCount: z.number().int(),
  message: z.string(),
});

export type NotifyDecisionsResponse = z.infer<typeof notifyDecisionsResponseSchema>;
