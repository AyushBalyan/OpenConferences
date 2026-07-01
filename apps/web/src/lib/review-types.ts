import type {
  ReviewRoundDto,
  ReviewerInvitationDto,
  BidDto,
  BlindedPaperPoolItemDto,
  ConflictOfInterestDto,
  ReviewerAssignmentDto,
  ReviewDto,
  RebuttalDto,
  MyAssignmentItemDto,
  DecisionDto,
  DecisionOutcome,
  Recommendation,
  ReviewVisibility,
  BidValue,
  RoundStatus,
  CoiType,
} from '@openconferences/schemas';

export type {
  ReviewRoundDto,
  ReviewerInvitationDto,
  BidDto,
  BlindedPaperPoolItemDto,
  ConflictOfInterestDto,
  ReviewerAssignmentDto,
  ReviewDto,
  RebuttalDto,
  MyAssignmentItemDto,
  DecisionDto,
  DecisionOutcome,
  Recommendation,
  ReviewVisibility,
  BidValue,
  RoundStatus,
  CoiType,
};

export const BID_OPTIONS: { value: BidValue; label: string }[] = [
  { value: 'EAGER', label: 'Eager' },
  { value: 'YES', label: 'Yes' },
  { value: 'MAYBE', label: 'Maybe' },
  { value: 'NO', label: 'No' },
  { value: 'CONFLICT', label: 'Conflict' },
];

export const COI_TYPE_OPTIONS: { value: CoiType; label: string }[] = [
  { value: 'CO_AUTHOR', label: 'Co-author' },
  { value: 'INSTITUTION', label: 'Institution' },
  { value: 'ADVISOR_STUDENT', label: 'Advisor / student' },
  { value: 'PERSONAL', label: 'Personal' },
  { value: 'FINANCIAL', label: 'Financial' },
  { value: 'OTHER', label: 'Other' },
];

export function roundStatusLabel(status: RoundStatus): string {
  const labels: Record<RoundStatus, string> = {
    OPEN: 'Open',
    REVIEWING: 'Reviewing',
    REBUTTAL: 'Rebuttal',
    DECIDING: 'Deciding',
    CLOSED: 'Closed',
  };
  return labels[status];
}

export function bidValueLabel(value: BidValue): string {
  return BID_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export const RECOMMENDATION_OPTIONS: { value: Recommendation; label: string }[] = [
  { value: 'STRONG_ACCEPT', label: 'Strong accept' },
  { value: 'ACCEPT', label: 'Accept' },
  { value: 'WEAK_ACCEPT', label: 'Weak accept' },
  { value: 'BORDERLINE', label: 'Borderline' },
  { value: 'WEAK_REJECT', label: 'Weak reject' },
  { value: 'REJECT', label: 'Reject' },
  { value: 'STRONG_REJECT', label: 'Strong reject' },
];

export function recommendationLabel(value: Recommendation | null | undefined): string {
  if (!value) return 'Not set';
  return RECOMMENDATION_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export function reviewVisibilityLabel(value: ReviewVisibility): string {
  const labels: Record<ReviewVisibility, string> = {
    HIDDEN: 'Hidden',
    AUTHOR_VISIBLE: 'Visible to authors',
    PUBLIC: 'Public',
  };
  return labels[value];
}

export const DECISION_OPTIONS: { value: DecisionOutcome; label: string }[] = [
  { value: 'ACCEPT', label: 'Accept' },
  { value: 'REJECT', label: 'Reject' },
  { value: 'MINOR_REVISION', label: 'Minor revision' },
  { value: 'MAJOR_REVISION', label: 'Major revision' },
];

export function decisionOutcomeLabel(value: DecisionOutcome | null | undefined): string {
  if (!value) return 'Not decided';
  return DECISION_OPTIONS.find((o) => o.value === value)?.label ?? value;
}
