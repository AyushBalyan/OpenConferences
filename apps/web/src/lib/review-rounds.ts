import type { DecisionDto, ReviewRoundDto } from './review-types';

/** Historical outcomes must not decide a paper's newly opened review cycle. */
export function currentCycleDecisions<T extends Pick<DecisionDto, 'paperId' | 'roundId'>>(
  papers: { id: string; cycleId: string | null }[],
  decisions: T[],
): Map<string, T> {
  const cycles = new Map(papers.map((paper) => [paper.id, paper.cycleId]));
  return new Map(
    decisions
      .filter((decision) => cycles.get(decision.paperId) === decision.roundId)
      .map((decision) => [decision.paperId, decision]),
  );
}

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
