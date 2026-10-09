'use client';

import Link from 'next/link';
import { ReviewViewSwitch } from './review-view-switch';
import { Fragment, useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type {
  AssignmentInterventionInput,
  CoordinationAssignmentDto,
  ReviewCoordinationDto,
} from '@openconferences/schemas';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/dashboard/page-header';
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
} from '@/components/dashboard/data-table';
import {
  fetchReviewCoordination,
  fetchMembers,
  interveneReviewerAssignment,
  releaseReviews,
} from '@/lib/api-client';
import type { Member } from '@/lib/conference-types';
import {
  actionableAssignments,
  DEFAULT_LEDGER_FILTERS,
  filterLedger,
  ledgerKey,
  localDateTimeInput,
  type LedgerFilters,
} from '@/lib/review-ledger';
import { reviewStageLabel } from '@/lib/review-types';

const PAGE_SIZE = 25;
const MAX_BATCH = 100;
const controlClass =
  'min-h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const queueLabels = {
  ALL: 'All papers',
  NEEDS_REVIEWERS: 'Needs reviewers',
  OVERDUE: 'Overdue reviews',
  READY: 'Ready for decision',
};
const dateLabel = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    : 'Not set';
type ActionResult = { id: string; label: string; success: boolean; message: string };

export function ReviewLedger({ conferenceId }: { conferenceId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filters: LedgerFilters = { ...DEFAULT_LEDGER_FILTERS };
  for (const key of Object.keys(filters) as (keyof LedgerFilters)[])
    filters[key] = searchParams.get(key) ?? filters[key];
  const urlSearch = searchParams.get('search') ?? '';
  const [searchText, setSearchText] = useState(urlSearch);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSearch = useRef<string | null>(null);
  const currentParams = useRef(searchParams);
  currentParams.current = searchParams;
  filters.search = searchText;
  useEffect(() => {
    if (pendingSearch.current !== null && pendingSearch.current !== urlSearch) return;
    pendingSearch.current = null;
    setSearchText(urlSearch);
  }, [urlSearch]);
  useEffect(
    () => () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    },
    [],
  );
  const [snapshot, setSnapshot] = useState<ReviewCoordinationDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [action, setAction] = useState<AssignmentInterventionInput['action'] | null>(null);
  const actionHeading = useRef<HTMLHeadingElement>(null);
  const [reason, setReason] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [reviewerId, setReviewerId] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [results, setResults] = useState<ActionResult[]>([]);
  const load = useCallback(async () => {
    const next = await fetchReviewCoordination(conferenceId);
    setSnapshot(next);
    setError(null);
  }, [conferenceId]);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchReviewCoordination(conferenceId)
      .then((next) => {
        if (alive) {
          setSnapshot(next);
          setError(null);
        }
      })
      .catch((err) => {
        if (alive) setError(err instanceof Error ? err.message : 'Failed to load the ledger');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [conferenceId]);
  useEffect(() => {
    if (action) {
      actionHeading.current?.focus();
      actionHeading.current?.scrollIntoView({ behavior: 'auto', block: 'center' });
    }
  }, [action]);
  const rows = filterLedger(snapshot?.data ?? [], filters);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const pageRows = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const eligible = rows.flatMap(actionableAssignments);
  const selectedAssignments = eligible.filter((a) => selected.has(a.id));
  const availableReviewers = useMemo(() => {
    const blocked = new Set(
      selectedAssignments.flatMap(
        (a) =>
          snapshot?.data
            .find((p) => p.cycleId === a.roundId)
            ?.assignments.map((a) => a.reviewerUserId) ?? [],
      ),
    );
    return members.filter((m) => !blocked.has(m.userId));
  }, [members, selectedAssignments, snapshot]);
  const tracks = [
    ...new Map((snapshot?.data ?? []).map((p) => [p.trackId, p.trackName])).entries(),
  ];
  const reviewers = [
    ...new Map(
      (snapshot?.data ?? []).flatMap((p) =>
        p.assignments.map((a) => [a.reviewerUserId, a.reviewerName] as const),
      ),
    ).entries(),
  ];
  const cycles = [
    ...new Set((snapshot?.data ?? []).flatMap((p) => (p.roundNumber ? [p.roundNumber] : []))),
  ].sort((a, b) => a - b);

  function setFilter(key: keyof LedgerFilters, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === DEFAULT_LEDGER_FILTERS[key]) params.delete(key);
    else params.set(key, value);
    router.replace(`${pathname}${params.size ? `?${params}` : ''}`, { scroll: false });
    setPage(1);
    setSelected(new Set());
    setAction(null);
  }
  function updateSearch(value: string) {
    setSearchText(value);
    setPage(1);
    setSelected(new Set());
    setAction(null);
    pendingSearch.current = value;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      const params = new URLSearchParams(currentParams.current.toString());
      if (value) params.set('search', value);
      else params.delete('search');
      router.replace(`${pathname}${params.size ? `?${params}` : ''}`, { scroll: false });
    }, 300);
  }
  function toggleAssignment(id: string) {
    setSelected((old) => {
      const next = new Set(old);
      if (next.has(id)) next.delete(id);
      else if (next.size < MAX_BATCH) next.add(id);
      return next;
    });
    setAction(null);
  }
  async function openAction(
    next: AssignmentInterventionInput['action'],
    assignment?: CoordinationAssignmentDto,
  ) {
    if (assignment) setSelected(new Set([assignment.id]));
    setAction(next);
    setReason('');
    setReviewerId('');
    setResults([]);
    setMembersError(null);
    const targets = assignment ? [assignment] : selectedAssignments;
    const latestDate = Math.max(
      Date.now(),
      ...targets.map((a) => new Date(a.dueAt ?? 0).getTime()),
    );
    setDueAt(localDateTimeInput(new Date(latestDate + 24 * 60 * 60 * 1000).toISOString()));
    if (next === 'REPLACE') {
      setMembers([]);
      try {
        setMembers(await fetchMembers(conferenceId, 'REVIEWER'));
      } catch (err) {
        setMembersError(
          err instanceof Error ? err.message : 'Failed to load replacement reviewers',
        );
      }
    }
  }
  async function runAction(event: React.FormEvent) {
    event.preventDefault();
    if (!action || !selectedAssignments.length) return;
    setBusy(true);
    setError(null);
    setResults([]);
    const targets = [...selectedAssignments];
    for (const assignment of targets) {
      const paper = snapshot?.data.find((p) => p.cycleId === assignment.roundId);
      const label = `${paper?.submissionNumber ?? paper?.paperTitle ?? assignment.paperId} · ${assignment.reviewerName} (${assignment.reviewerEmail})`;
      let result: ActionResult;
      try {
        const response = await interveneReviewerAssignment(conferenceId, assignment.id, {
          action,
          version: assignment.version,
          ...(action !== 'REMIND' ? { reason } : {}),
          ...(action === 'EXTEND' || action === 'REPLACE'
            ? { dueAt: new Date(dueAt).toISOString() }
            : {}),
          ...(action === 'REPLACE' ? { reviewerUserId: reviewerId } : {}),
        });
        result = {
          id: assignment.id,
          label,
          success: true,
          message: [response.message, response.notificationWarning].filter(Boolean).join(' '),
        };
      } catch (err) {
        result = {
          id: assignment.id,
          label,
          success: false,
          message: err instanceof Error ? err.message : 'Action failed',
        };
      }
      setResults((old) => [...old, result]);
    }
    setAction(null);
    setSelected(new Set());
    try {
      await load();
    } catch {
      setError(
        'Actions finished, but the ledger could not refresh. Refresh before making another change.',
      );
    }
    setBusy(false);
  }
  async function handleRelease(row: NonNullable<ReviewCoordinationDto['data']>[number]) {
    if (
      !row.cycleId ||
      row.cycleVersion == null ||
      !window.confirm(
        `Release ${row.submittedReviewCount} submitted reviews for ${row.submissionNumber ?? row.paperTitle} to its authors? This makes the submitted review content visible to authors.`,
      )
    )
      return;
    setBusy(true);
    setError(null);
    try {
      const response = await releaseReviews(conferenceId, row.paperId, row.cycleId, {
        version: row.cycleVersion,
      });
      setResults([
        {
          id: row.cycleId,
          label: row.submissionNumber ?? row.paperTitle,
          success: true,
          message: response.message,
        },
      ]);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not release reviews');
    }
    setBusy(false);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Paper review ledger"
        description="See coverage, deadlines and blockers across the conference. Browse earlier cycles without changing active reviews."
        actions={
          <Button
            variant="outline"
            disabled={busy || loading}
            onClick={async () => {
              setLoading(true);
              try {
                await load();
                setSelected(new Set());
                setAction(null);
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Refresh failed');
              } finally {
                setLoading(false);
              }
            }}
          >
            Refresh
          </Button>
        }
      />
      <ReviewViewSwitch conferenceId={conferenceId} view="papers" />
      {error ? (
        <p role="alert" className="text-sm text-rose-700">
          {error}
        </p>
      ) : null}
      <nav aria-label="Review attention queues" className="flex flex-wrap gap-2">
        {Object.entries(queueLabels).map(([key, label]) => (
          <Button
            key={key}
            size="sm"
            variant={filters.queue === key ? 'default' : 'outline'}
            disabled={busy}
            onClick={() => setFilter('queue', key)}
          >
            {label}
            {snapshot && key !== 'ALL'
              ? ` (${key === 'NEEDS_REVIEWERS' ? snapshot.summary.needsReviewers : key === 'OVERDUE' ? snapshot.summary.overduePapers : snapshot.summary.readyForDecision})`
              : ''}
          </Button>
        ))}
      </nav>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <label className="space-y-1 text-sm xl:col-span-2">
          <span>Find a paper</span>
          <input
            className={`${controlClass} w-full placeholder:text-slate-600`}
            type="search"
            value={filters.search}
            disabled={busy}
            onChange={(e) => updateSearch(e.target.value)}
            placeholder="Title or submission number"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span id="ledger-track-label">Track</span>
          <select
            aria-labelledby="ledger-track-label"
            className={`${controlClass} w-full`}
            disabled={busy}
            value={filters.track}
            onChange={(e) => setFilter('track', e.target.value)}
          >
            <option value="">All tracks</option>
            {tracks.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span id="ledger-history-label">History</span>
          <select
            aria-labelledby="ledger-history-label"
            className={`${controlClass} w-full`}
            disabled={busy}
            value={filters.history}
            onChange={(e) => setFilter('history', e.target.value)}
          >
            <option value="CURRENT">Current cycles</option>
            <option value="ALL">All cycles</option>
            <option value="HISTORICAL">Earlier cycles</option>
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span id="ledger-cycle-label">Cycle</span>
          <select
            aria-labelledby="ledger-cycle-label"
            className={`${controlClass} w-full`}
            disabled={busy}
            value={filters.cycle}
            onChange={(e) => setFilter('cycle', e.target.value)}
          >
            <option value="">All cycle numbers</option>
            {cycles.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span id="ledger-reviewer-label">Reviewer</span>
          <select
            aria-labelledby="ledger-reviewer-label"
            className={`${controlClass} w-full`}
            disabled={busy}
            value={filters.reviewer}
            onChange={(e) => setFilter('reviewer', e.target.value)}
          >
            <option value="">All reviewers</option>
            {reviewers.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {snapshot ? (
        <p className="text-xs text-slate-600">
          {rows.length} paper cycles · Minimum {snapshot.minimumReviews} submitted review
          {snapshot.minimumReviews === 1 ? '' : 's'} per cycle · Updated{' '}
          {dateLabel(snapshot.observedAt)}. Dates use your local time zone. Attention counts cover
          current cycles.
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2 border-y py-3">
        <Button
          size="sm"
          variant="outline"
          disabled={busy || !eligible.length}
          onClick={() => {
            setSelected(new Set(eligible.slice(0, MAX_BATCH).map((a) => a.id)));
            setAction(null);
          }}
        >
          Select unfinished reviews
        </Button>
        <span className="text-sm text-slate-600">
          {selectedAssignments.length} selected
          {eligible.length > MAX_BATCH ? ` · up to ${MAX_BATCH} per batch` : ''}
        </span>
        <Button
          size="sm"
          variant="outline"
          disabled={busy || !selectedAssignments.length}
          onClick={() => void openAction('REMIND')}
        >
          Remind selected
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy || !selectedAssignments.length}
          onClick={() => void openAction('EXTEND')}
        >
          Extend selected
        </Button>
        {selectedAssignments.length ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => {
              setSelected(new Set());
              setAction(null);
            }}
          >
            Clear selection
          </Button>
        ) : null}
      </div>
      {action && selectedAssignments.length ? (
        <form
          onSubmit={runAction}
          className="space-y-4 rounded-md border bg-white p-5"
          aria-label="Review action preview"
        >
          <h2
            ref={actionHeading}
            tabIndex={-1}
            className="text-lg font-semibold focus-visible:outline-none"
          >
            {action === 'REMIND'
              ? 'Preview reminders'
              : action === 'EXTEND'
                ? 'Extend review deadlines'
                : 'Replace reviewer'}
          </h2>
          <p className="max-w-3xl text-sm text-slate-600">
            {action === 'REMIND'
              ? 'Each recipient receives the review reminder with their current deadline and review link. Repeated requests on the same day are deduplicated.'
              : action === 'EXTEND'
                ? 'The new date must be later than every selected deadline. It overrides the normal conference deadline for these assignments.'
                : 'The original assignment and private draft are preserved. The new reviewer receives a fresh assignment with the deadline you choose below.'}
          </p>
          <ul className="max-h-48 space-y-2 overflow-auto text-sm">
            {selectedAssignments.map((a) => (
              <li key={a.id}>
                <span className="font-medium">{a.reviewerName}</span> · {a.reviewerEmail} ·{' '}
                {snapshot?.data.find((p) => p.cycleId === a.roundId)?.submissionNumber ?? 'Paper'} ·
                Due {dateLabel(a.dueAt)}
              </li>
            ))}
          </ul>
          {action === 'EXTEND' || action === 'REPLACE' ? (
            <label className="block space-y-1 text-sm">
              <span>New deadline (local time)</span>
              <input
                required
                type="datetime-local"
                className={controlClass}
                value={dueAt}
                disabled={busy}
                min={localDateTimeInput(
                  new Date(
                    (action === 'EXTEND'
                      ? Math.max(
                          Date.now(),
                          ...selectedAssignments.map((a) => new Date(a.dueAt ?? 0).getTime()),
                        )
                      : Date.now()) + 60_000,
                  ).toISOString(),
                )}
                onChange={(e) => setDueAt(e.target.value)}
              />
            </label>
          ) : null}
          {action === 'REPLACE' ? (
            <label className="block space-y-1 text-sm">
              <span id="replacement-reviewer-label">Replacement reviewer</span>
              <select
                aria-labelledby="replacement-reviewer-label"
                required
                className={`${controlClass} w-full max-w-lg`}
                value={reviewerId}
                disabled={busy}
                onChange={(e) => setReviewerId(e.target.value)}
              >
                <option value="">Choose a conference reviewer</option>
                {availableReviewers.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.name} · {m.email}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-600">
                Already assigned reviewers are excluded. Conflict checks run before replacement.
              </p>
              {membersError ? (
                <p role="alert" className="text-rose-700">
                  {membersError}
                </p>
              ) : null}
            </label>
          ) : null}
          {action !== 'REMIND' ? (
            <label className="block space-y-1 text-sm">
              <span>Reason (recorded in the audit log)</span>
              <textarea
                required
                maxLength={1000}
                className={`${controlClass} w-full max-w-3xl`}
                value={reason}
                disabled={busy}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
          ) : null}
          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={
                busy ||
                (action === 'REPLACE' && !reviewerId) ||
                (action !== 'REMIND' && !reason.trim())
              }
            >
              {busy
                ? `Processing ${results.length}/${selectedAssignments.length}…`
                : action === 'REMIND'
                  ? `Queue ${selectedAssignments.length} reminder${selectedAssignments.length === 1 ? '' : 's'}`
                  : action === 'EXTEND'
                    ? `Extend ${selectedAssignments.length} deadline${selectedAssignments.length === 1 ? '' : 's'}`
                    : 'Confirm replacement'}
            </Button>
            <Button variant="outline" type="button" disabled={busy} onClick={() => setAction(null)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
      {results.length ? (
        <section aria-live="polite" className="space-y-2">
          <h2 className="font-semibold">
            Action results · {results.filter((r) => r.success).length} succeeded,{' '}
            {results.filter((r) => !r.success).length} failed
          </h2>
          <ul className="space-y-2 text-sm">
            {results.map((r) => (
              <li key={r.id} className={r.success ? 'text-slate-700' : 'text-rose-700'}>
                <span className="font-medium">{r.label}: </span>
                {r.message}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {loading ? (
        <p role="status" className="py-8 text-sm text-slate-600">
          Loading paper review cycles…
        </p>
      ) : !snapshot ? null : rows.length === 0 ? (
        <div className="border-y py-10">
          <h2 className="font-medium">
            {snapshot.data.length ? 'No cycles match these filters' : 'No submitted papers yet'}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {snapshot.data.length
              ? 'Change the history or attention filter to see more papers.'
              : 'Submitted papers will appear here even before reviewers are assigned.'}
          </p>
        </div>
      ) : (
        <>
          <p className="text-xs text-slate-600 lg:hidden">
            Scroll the table sideways to see deadlines, blockers and actions.
          </p>
          <DataTable>
            <DataTableHeader>
              <DataTableRow>
                <DataTableHead>Paper / track</DataTableHead>
                <DataTableHead>Cycle / stage</DataTableHead>
                <DataTableHead>Coverage</DataTableHead>
                <DataTableHead>Deadline / blockers</DataTableHead>
                <DataTableHead>Actions</DataTableHead>
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {pageRows.map((row) => {
                const key = ledgerKey(row);
                const isExpanded = expanded.has(key);
                const unfinished = actionableAssignments(row);
                return (
                  <Fragment key={key}>
                    <DataTableRow>
                      <DataTableCell>
                        <p className="max-w-sm font-medium text-slate-900">{row.paperTitle}</p>
                        <p className="mt-1 text-xs text-slate-600">
                          {row.submissionNumber ?? 'Unnumbered'} · {row.trackName}
                        </p>
                      </DataTableCell>
                      <DataTableCell>
                        <p>
                          {row.roundNumber ? `Cycle ${row.roundNumber}` : 'Awaiting assignment'}
                          {!row.isCurrentCycle ? ' · Historical' : ''}
                        </p>
                        <p className="mt-1 text-xs text-slate-600">
                          {reviewStageLabel(row.reviewStage)}
                        </p>
                      </DataTableCell>
                      <DataTableCell>
                        <p className="tabular-nums">
                          {row.submittedReviewCount}/{snapshot.minimumReviews} submitted
                        </p>
                        <p className="mt-1 text-xs text-slate-600">
                          {row.assignmentCount} assigned
                        </p>
                      </DataTableCell>
                      <DataTableCell>
                        <p className="text-sm">{dateLabel(row.reviewDueAt)}</p>
                        {row.needsReviewers ? (
                          <p className="mt-1 text-xs font-medium text-amber-800">
                            Needs {Math.max(snapshot.minimumReviews - row.assignmentCount, 0)} more
                            reviewer(s)
                          </p>
                        ) : null}
                        {row.overdueReviewCount ? (
                          <p className="mt-1 text-xs font-medium text-rose-700">
                            {row.overdueReviewCount} overdue review(s)
                          </p>
                        ) : null}
                        {row.readyForDecision ? (
                          <p className="mt-1 text-xs font-medium text-emerald-800">
                            Ready for chair decision
                          </p>
                        ) : row.warning && !row.needsReviewers ? (
                          <p className="mt-1 text-xs text-slate-600">{row.warning}</p>
                        ) : null}
                      </DataTableCell>
                      <DataTableCell>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            aria-expanded={isExpanded}
                            aria-controls={`assignments-${key}`}
                            onClick={() =>
                              setExpanded((old) => {
                                const next = new Set(old);
                                if (next.has(key)) next.delete(key);
                                else next.add(key);
                                return next;
                              })
                            }
                          >
                            {isExpanded
                              ? 'Hide reviewers'
                              : `Reviewers (${row.assignments.length})`}
                          </Button>
                          {row.isCurrentCycle ? (
                            <Button asChild size="sm" variant="outline">
                              <Link
                                href={`/dashboard/conferences/${conferenceId}/reviews/decisions/pending?paper=${row.paperId}`}
                              >
                                {row.readyForDecision ? 'Make decision' : 'Read reviews'}
                              </Link>
                            </Button>
                          ) : (
                            <Button asChild size="sm" variant="outline">
                              <Link
                                href={`/dashboard/conferences/${conferenceId}/submissions/${row.paperId}?section=reviews&round=${row.cycleId}`}
                              >
                                Paper history
                              </Link>
                            </Button>
                          )}
                          {row.canIntervene && row.submittedReviewCount > 0 ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy}
                              onClick={() => void handleRelease(row)}
                            >
                              Release reviews
                            </Button>
                          ) : null}
                        </div>
                      </DataTableCell>
                    </DataTableRow>
                    {isExpanded ? (
                      <DataTableRow>
                        <DataTableCell colSpan={5}>
                          <div id={`assignments-${key}`} className="space-y-3 py-3">
                            {!row.isCurrentCycle ? (
                              <p className="text-xs text-slate-600">
                                Historical cycle · available for reference. Review actions apply to
                                the current cycle.
                              </p>
                            ) : null}
                            {row.assignments.length ? (
                              row.assignments.map((a) => (
                                <div
                                  key={a.id}
                                  className="flex flex-wrap items-center justify-between gap-3 border-b pb-3 last:border-0"
                                >
                                  <div className="flex items-start gap-3">
                                    {unfinished.some((u) => u.id === a.id) ? (
                                      <input
                                        type="checkbox"
                                        className="mt-1 h-4 w-4 accent-blue-700"
                                        aria-label={`Select ${a.reviewerName} for ${row.submissionNumber ?? row.paperTitle}`}
                                        checked={selected.has(a.id)}
                                        disabled={
                                          busy ||
                                          (!selected.has(a.id) && selected.size >= MAX_BATCH)
                                        }
                                        onChange={() => toggleAssignment(a.id)}
                                      />
                                    ) : null}
                                    <div>
                                      <p className="text-sm font-medium">
                                        {a.reviewerName}{' '}
                                        <span className="font-normal text-slate-600">
                                          ·{' '}
                                          {a.status === 'REPLACED'
                                            ? 'Replaced · retained for history'
                                            : a.status === 'DECLINED'
                                              ? 'Declined'
                                              : a.reviewProgress === 'NOT_STARTED'
                                                ? 'Not started'
                                                : a.reviewProgress === 'DRAFT'
                                                  ? 'Draft saved'
                                                  : 'Submitted'}
                                        </span>
                                      </p>
                                      <p
                                        className={`mt-1 text-xs ${a.overdue ? 'text-rose-700' : 'text-slate-600'}`}
                                      >
                                        {a.reviewerEmail} · Due {dateLabel(a.dueAt)}
                                        {a.overdue ? ' · Overdue' : ''}
                                      </p>
                                    </div>
                                  </div>
                                  {unfinished.some((u) => u.id === a.id) ? (
                                    <div className="flex flex-wrap gap-2">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={busy}
                                        onClick={() => void openAction('REMIND', a)}
                                      >
                                        Remind
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={busy}
                                        onClick={() => void openAction('EXTEND', a)}
                                      >
                                        Extend deadline
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={busy}
                                        onClick={() => void openAction('REPLACE', a)}
                                      >
                                        Replace reviewer
                                      </Button>
                                    </div>
                                  ) : null}
                                </div>
                              ))
                            ) : (
                              <p className="text-sm text-slate-600">
                                No active reviewers assigned in this cycle.
                              </p>
                            )}
                            {row.canIntervene ? (
                              <Button asChild size="sm" variant="outline">
                                <Link
                                  href={`/dashboard/conferences/${conferenceId}/reviews/assignments/manual?paper=${row.paperId}`}
                                >
                                  Add reviewer
                                </Link>
                              </Button>
                            ) : null}
                          </div>
                        </DataTableCell>
                      </DataTableRow>
                    ) : null}
                  </Fragment>
                );
              })}
            </DataTableBody>
          </DataTable>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span>
              Page {currentPage} of {pages} · {rows.length} cycles
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1 || busy}
                onClick={() => setPage(currentPage - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === pages || busy}
                onClick={() => setPage(currentPage + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
