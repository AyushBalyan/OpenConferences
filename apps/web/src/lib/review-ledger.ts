import type { ReviewLedgerPaperDto, CoordinationAssignmentDto } from '@openconferences/schemas';

export const LEDGER_QUEUES = ['ALL', 'NEEDS_REVIEWERS', 'OVERDUE', 'READY'] as const;
export type LedgerQueue = (typeof LEDGER_QUEUES)[number];
export type LedgerFilters = {
  search: string;
  track: string;
  cycle: string;
  reviewer: string;
  history: string;
  queue: string;
};
export const DEFAULT_LEDGER_FILTERS: LedgerFilters = {
  search: '',
  track: '',
  cycle: '',
  reviewer: '',
  history: 'CURRENT',
  queue: 'ALL',
};
export function filterLedger(
  rows: ReviewLedgerPaperDto[],
  filters: LedgerFilters,
): ReviewLedgerPaperDto[] {
  const search = filters.search.trim().toLocaleLowerCase();
  return rows.filter(
    (row) =>
      (filters.history === 'ALL' ||
        (filters.history === 'HISTORICAL' ? !row.isCurrentCycle : row.isCurrentCycle)) &&
      (!search ||
        `${row.paperTitle} ${row.submissionNumber ?? ''}`.toLocaleLowerCase().includes(search)) &&
      (!filters.track || row.trackId === filters.track) &&
      (!filters.cycle || String(row.roundNumber) === filters.cycle) &&
      (!filters.reviewer || row.assignments.some((a) => a.reviewerUserId === filters.reviewer)) &&
      (filters.queue === 'NEEDS_REVIEWERS'
        ? row.needsReviewers
        : filters.queue === 'OVERDUE'
          ? row.overdueReviewCount > 0
          : filters.queue === 'READY'
            ? row.readyForDecision
            : true),
  );
}
export function actionableAssignments(row: ReviewLedgerPaperDto): CoordinationAssignmentDto[] {
  return row.canIntervene
    ? row.assignments.filter(
        (a) => ['ASSIGNED', 'ACCEPTED'].includes(a.status) && a.reviewProgress !== 'SUBMITTED',
      )
    : [];
}
export function ledgerKey(row: ReviewLedgerPaperDto): string {
  return row.cycleId ?? row.paperId;
}
export function localDateTimeInput(iso: string): string {
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
