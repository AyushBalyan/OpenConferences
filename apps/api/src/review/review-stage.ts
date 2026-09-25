import type { DecisionOutcome } from '@openconferences/db';
import type { ReviewStage } from '@openconferences/schemas';

const REVISION_OUTCOMES = new Set<DecisionOutcome>(['MINOR_REVISION', 'MAJOR_REVISION']);

export function deriveReviewStage(input: {
  reviewsReleasedAt: Date | null;
  decisionOutcome: DecisionOutcome | null;
  hasNewerCycle: boolean;
}): ReviewStage {
  if (input.hasNewerCycle) return 'IN_REVIEW';
  if (input.decisionOutcome === 'ACCEPT' || input.decisionOutcome === 'REJECT') return 'DECIDED';
  if (input.decisionOutcome && REVISION_OUTCOMES.has(input.decisionOutcome)) {
    return 'REVISION_REQUESTED';
  }
  if (input.reviewsReleasedAt) return 'FEEDBACK_RELEASED';
  return 'IN_REVIEW';
}

export function minimumReviewsFromConfig(reviewConfig: unknown): number {
  if (reviewConfig && typeof reviewConfig === 'object' && 'minimumReviews' in reviewConfig) {
    const value = (reviewConfig as { minimumReviews?: unknown }).minimumReviews;
    if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value;
  }
  return 1;
}

export function reviewCountWarning(submitted: number, minimum: number): string | null {
  if (submitted >= minimum) return null;
  return `${submitted} of ${minimum} required reviews submitted`;
}
