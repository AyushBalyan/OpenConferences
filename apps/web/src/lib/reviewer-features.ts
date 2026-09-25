/**
 * Reviewer self-service bidding and conflict declaration.
 * Keep in step with apps/api/src/review/reviewer-features.ts.
 * Set to true to turn those flows back on. Organizer oversight is unaffected.
 */
export const REVIEWER_BIDDING_ENABLED = false;
export const REVIEWER_COI_ENABLED = false;

export function reviewerLandingPath(conferenceId: string): string {
  const base = `/dashboard/conferences/${conferenceId}/reviews`;
  return REVIEWER_BIDDING_ENABLED ? `${base}/bidding` : `${base}/my-assignments`;
}
