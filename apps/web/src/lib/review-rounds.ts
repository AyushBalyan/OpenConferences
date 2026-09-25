import type { ReviewRoundDto } from './review-types';

const OPEN_STAGES = new Set(['IN_REVIEW', 'FEEDBACK_RELEASED', 'SUBMITTED']);

/** Prefer the highest-numbered cycle that still has no final outcome. */
export function resolveActiveReviewRound(
  rounds: Pick<ReviewRoundDto, 'id' | 'roundNumber' | 'reviewStage'>[],
): Pick<ReviewRoundDto, 'id' | 'roundNumber' | 'reviewStage'> | undefined {
  if (rounds.length === 0) return undefined;

  const openRounds = rounds.filter((round) => OPEN_STAGES.has(round.reviewStage));
  const pool = openRounds.length > 0 ? openRounds : rounds;
  return pool.reduce((best, round) => (round.roundNumber > best.roundNumber ? round : best));
}

/** A paper can be decided while it is in review or after feedback is released. */
export function resolveDecisionRound(
  rounds: Pick<ReviewRoundDto, 'id' | 'roundNumber' | 'reviewStage'>[],
): Pick<ReviewRoundDto, 'id' | 'roundNumber' | 'reviewStage'> | undefined {
  return resolveActiveReviewRound(rounds);
}
