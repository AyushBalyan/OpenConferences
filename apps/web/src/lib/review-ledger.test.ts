import { describe, expect, it } from 'vitest';
import type { ReviewLedgerPaperDto } from '@openconferences/schemas';
import {
  actionableAssignments,
  DEFAULT_LEDGER_FILTERS,
  filterLedger,
  ledgerKey,
} from './review-ledger';
const current = {
  paperId: 'paper',
  paperTitle: 'Privacy in review',
  submissionNumber: 'SYS-12',
  cycleId: 'cycle-2',
  roundNumber: 2,
  trackId: 'systems',
  isCurrentCycle: true,
  canIntervene: true,
  needsReviewers: true,
  overdueReviewCount: 1,
  readyForDecision: false,
  assignments: [
    { id: 'draft', reviewerUserId: 'reviewer', status: 'ASSIGNED', reviewProgress: 'DRAFT' },
    { id: 'submitted', reviewerUserId: 'other', status: 'COMPLETED', reviewProgress: 'SUBMITTED' },
    { id: 'replaced', reviewerUserId: 'previous', status: 'REPLACED', reviewProgress: 'DRAFT' },
  ],
} as ReviewLedgerPaperDto;
const historical = {
  ...current,
  cycleId: 'cycle-1',
  roundNumber: 1,
  isCurrentCycle: false,
  canIntervene: false,
  needsReviewers: false,
  overdueReviewCount: 0,
};
describe('review ledger filters and selection', () => {
  it('defaults to current cycles and exposes history when requested', () => {
    expect(filterLedger([current, historical], DEFAULT_LEDGER_FILTERS)).toEqual([current]);
    expect(
      filterLedger([current, historical], { ...DEFAULT_LEDGER_FILTERS, history: 'HISTORICAL' }),
    ).toEqual([historical]);
    expect(
      filterLedger([current, historical], { ...DEFAULT_LEDGER_FILTERS, history: 'ALL' }),
    ).toHaveLength(2);
    expect(ledgerKey(current)).not.toBe(ledgerKey(historical));
  });
  it('combines identifier, track, cycle, reviewer and attention filters', () => {
    expect(
      filterLedger([current], {
        ...DEFAULT_LEDGER_FILTERS,
        search: 'sys-12',
        track: 'systems',
        cycle: '2',
        reviewer: 'reviewer',
        queue: 'OVERDUE',
      }),
    ).toEqual([current]);
    expect(filterLedger([current], { ...DEFAULT_LEDGER_FILTERS, queue: 'READY' })).toEqual([]);
    expect(filterLedger([current], { ...DEFAULT_LEDGER_FILTERS, track: 'other' })).toEqual([]);
  });
  it('never includes submitted, retired or historical assignments in a batch', () => {
    expect(actionableAssignments(current).map((a) => a.id)).toEqual(['draft']);
    expect(actionableAssignments(historical)).toEqual([]);
  });
});
