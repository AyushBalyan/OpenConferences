import type { ReviewRoundDto } from './review-types';

/** Prefer the highest-numbered round that is still open for chair/reviewer workflows. */
export function resolveActiveReviewRound(
  rounds: Pick<ReviewRoundDto, 'id' | 'roundNumber' | 'status'>[],
): Pick<ReviewRoundDto, 'id' | 'roundNumber' | 'status'> | undefined {
  if (rounds.length === 0) return undefined;

  const openRounds = rounds.filter((round) => round.status !== 'CLOSED');
  if (openRounds.length > 0) {
    return openRounds.reduce((best, round) =>
      round.roundNumber > best.roundNumber ? round : best,
    );
  }

  return rounds.reduce((best, round) => (round.roundNumber > best.roundNumber ? round : best));
}

/** Decisions happen during rebuttal/deciding; otherwise fall back to the active round. */
export function resolveDecisionRound(
  rounds: Pick<ReviewRoundDto, 'id' | 'roundNumber' | 'status'>[],
): Pick<ReviewRoundDto, 'id' | 'roundNumber' | 'status'> | undefined {
  if (rounds.length === 0) return undefined;

  const deciding = rounds.filter((r) => r.status === 'REBUTTAL' || r.status === 'DECIDING');
  if (deciding.length > 0) {
    return deciding.reduce((best, round) => (round.roundNumber > best.roundNumber ? round : best));
  }

  return resolveActiveReviewRound(rounds);
}
