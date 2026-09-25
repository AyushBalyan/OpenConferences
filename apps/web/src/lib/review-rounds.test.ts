import { describe, expect, it } from 'vitest';
import { currentCycleDecisions } from './review-rounds';

describe('currentCycleDecisions', () => {
  it('allows another decision after a revision opens a new cycle', () => {
    const decisions = [{ paperId: 'paper-a', roundId: 'cycle-1' }];
    expect(
      currentCycleDecisions([{ id: 'paper-a', cycleId: 'cycle-1' }], decisions).has('paper-a'),
    ).toBe(true);
    expect(
      currentCycleDecisions([{ id: 'paper-a', cycleId: 'cycle-2' }], decisions).has('paper-a'),
    ).toBe(false);
  });

  it('matches each paper to its current cycle regardless of history order', () => {
    const current = { paperId: 'paper-a', roundId: 'cycle-2' };
    const decisions = [
      current,
      { paperId: 'paper-a', roundId: 'cycle-1' },
      { paperId: 'paper-b', roundId: 'cycle-b' },
    ];
    const result = currentCycleDecisions(
      [
        { id: 'paper-a', cycleId: 'cycle-2' },
        { id: 'paper-b', cycleId: 'cycle-b' },
        { id: 'paper-c', cycleId: null },
      ],
      decisions,
    );
    expect(result.get('paper-a')).toBe(current);
    expect([...result.keys()]).toEqual(['paper-a', 'paper-b']);
  });
});
