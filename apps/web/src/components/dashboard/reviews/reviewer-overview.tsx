'use client';
import Link from 'next/link';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ChevronDown, ChevronRight } from 'lucide-react';
import {
  DIGEST_MAX_ASSIGNMENTS,
  DIGEST_MAX_ITEMS,
  DIGEST_MAX_REVIEWERS,
  reviewerOverviewQuerySchema,
  type ReviewerOverview,
  type ReviewerWorkload,
  type ReviewerWorkAssignment,
  type ReviewerDigestPreview,
  type AssignmentInterventionInput,
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
  fetchReviewerOverview,
  previewReviewerDigest,
  sendReviewerDigest,
  interveneReviewerAssignment,
} from '@/lib/api-client';
import { localDateTimeInput } from '@/lib/review-ledger';
import { ReviewViewSwitch } from './review-view-switch';

const control =
  'min-h-10 rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const date = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—';
const queues = {
  ALL: 'All reviewers',
  OVERDUE: 'Overdue',
  REMAINING: 'Has remaining',
  DUE_SOON: 'Due within 72 hours',
  SUBMITTED: 'All submitted',
  UNASSIGNED: 'No assignments',
};
const labels = {
  SUBMITTED: 'Submitted',
  NOT_STARTED: 'Not started',
  DRAFT: 'Draft saved',
  CLOSED: 'Closed incomplete',
  RETIRED: 'Retired / withdrawn',
  INCONSISTENT: 'Needs data check',
};
const eligible = (r: ReviewerWorkload) =>
  r.hasReviewerRole && !r.inconsistent && (!r.digestToday || r.digestToday.status === 'CANCELLED');
type Draft = {
  reviewer: ReviewerWorkload;
  assignments: ReviewerWorkAssignment[];
  requestId: string;
  preview?: ReviewerDigestPreview;
  error?: string;
  result?: string;
  success?: boolean;
};

export function ReviewerOverviewTab({ conferenceId }: { conferenceId: string }) {
  const params = useSearchParams(),
    router = useRouter(),
    pathname = usePathname();
  const paramsRef = useRef(params);
  paramsRef.current = params;
  const parsed = reviewerOverviewQuerySchema.safeParse({
    history: params.get('history') ?? 'CURRENT',
    track: params.get('track') || undefined,
    cycle: params.get('cycle') || undefined,
    paperSearch: params.get('paperSearch') || undefined,
  });
  const scope = parsed.success ? parsed.data : { history: 'CURRENT' as const };
  const scopeKey = JSON.stringify(scope);
  const queue = params.get('queue') ?? 'ALL',
    sort = params.get('sort') ?? 'attention',
    reviewerSearch = params.get('reviewerSearch') ?? '';
  const pageParam = Number(params.get('page') ?? '1');
  const page = Number.isSafeInteger(pageParam) && pageParam > 0 ? pageParam : 1;
  const [paperText, setPaperText] = useState(scope.paperSearch ?? '');
  const [reviewerText, setReviewerText] = useState(reviewerSearch);
  const patch = useCallback(
    (changes: Record<string, string>) => {
      const next = new URLSearchParams(paramsRef.current.toString());
      if (Object.keys(changes).some((key) => key !== 'page')) next.delete('page');
      for (const [k, v] of Object.entries(changes)) {
        if (v) next.set(k, v);
        else next.delete(k);
      }
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [router, pathname],
  );
  useEffect(() => {
    setPaperText(scope.paperSearch ?? '');
  }, [scope.paperSearch]);
  useEffect(() => {
    setReviewerText(reviewerSearch);
  }, [reviewerSearch]);
  useEffect(() => {
    if (paperText === (scope.paperSearch ?? '')) return;
    const timer = setTimeout(() => patch({ paperSearch: paperText }), 300);
    return () => clearTimeout(timer);
  }, [paperText, scope.paperSearch, patch]);
  useEffect(() => {
    if (reviewerText === reviewerSearch) return;
    const timer = setTimeout(() => patch({ reviewerSearch: reviewerText }), 300);
    return () => clearTimeout(timer);
  }, [reviewerText, reviewerSearch, patch]);
  const [snapshot, setSnapshot] = useState<ReviewerOverview | null>(null);
  const [loadedKey, setLoadedKey] = useState('');
  const [loading, setLoading] = useState(true),
    [error, setError] = useState<string | null>(null),
    [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0),
    [expanded, setExpanded] = useState(new Set<string>()),
    [selected, setSelected] = useState(new Set<string>());
  const [drafts, setDrafts] = useState<Draft[]>([]),
    [stage, setStage] = useState<'choose' | 'preview' | 'results' | null>(null);
  const [action, setAction] = useState<{
    assignment: ReviewerWorkAssignment;
    kind: 'EXTEND' | 'REPLACE';
  } | null>(null);
  const [singleReminder, setSingleReminder] = useState<ReviewerWorkAssignment | null>(null);
  const [reason, setReason] = useState(''),
    [dueAt, setDueAt] = useState(''),
    [replacement, setReplacement] = useState(''),
    [actionMessage, setActionMessage] = useState<string | null>(null);
  const panelHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    setSelected(new Set());
    setStage(null);
    setAction(null);
    setSingleReminder(null);
    const query = JSON.parse(scopeKey);
    fetchReviewerOverview(conferenceId, query)
      .then((data) => {
        if (alive) {
          setSnapshot(data);
          setLoadedKey(scopeKey);
        }
      })
      .catch((err) => {
        if (alive)
          setError(
            err instanceof Error
              ? err.message
              : 'Could not load reviewer overview. Refresh to try again.',
          );
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [conferenceId, scopeKey, revision]);
  useEffect(() => {
    setSelected(new Set());
    setStage(null);
    setAction(null);
    setSingleReminder(null);
  }, [queue, sort, reviewerText, scopeKey, page]);
  useEffect(() => {
    if (stage || action || singleReminder) {
      panelHeading.current?.focus();
      panelHeading.current?.scrollIntoView({ block: 'nearest' });
    }
  }, [stage, action, singleReminder]);
  const stale =
    loading || loadedKey !== scopeKey || !!error || paperText !== (scope.paperSearch ?? '');
  const disabled = busy || stale;
  const rows = useMemo(() => {
    const search = reviewerText.trim().toLowerCase();
    return (snapshot?.data ?? [])
      .filter(
        (r) =>
          (!search || `${r.name} ${r.email}`.toLowerCase().includes(search)) &&
          (queue === 'REMAINING'
            ? !r.inconsistent && r.remaining > 0
            : queue === 'OVERDUE'
              ? !r.inconsistent && r.overdue > 0
              : queue === 'DUE_SOON'
                ? !r.inconsistent && r.dueSoon > 0
                : queue === 'SUBMITTED'
                  ? r.allSubmitted
                  : queue === 'UNASSIGNED'
                    ? r.assigned === 0
                    : true),
      )
      .sort((a, b) => {
        const identity = a.name.localeCompare(b.name) || a.userId.localeCompare(b.userId);
        const deadline = (a.earliestDeadline ?? 'z').localeCompare(b.earliestDeadline ?? 'z');
        if (sort === 'name') return identity;
        if (sort === 'assigned') return b.assigned - a.assigned || identity;
        if (sort === 'submitted') return b.submitted - a.submitted || identity;
        if (sort === 'remaining') return b.remaining - a.remaining || identity;
        if (sort === 'deadline') return deadline || identity;
        return b.overdue - a.overdue || b.remaining - a.remaining || deadline || identity;
      });
  }, [snapshot, reviewerText, queue, sort]);
  const pages = Math.max(1, Math.ceil(rows.length / 25)),
    currentPage = Math.min(page, pages),
    visible = rows.slice((currentPage - 1) * 25, currentPage * 25);
  const base = `/dashboard/conferences/${conferenceId}`;
  const candidateAssignments = (r: ReviewerWorkload) =>
    r.assignments.filter((a) => a.canIntervene && (queue !== 'OVERDUE' || a.overdue));
  function startDigest(reviewers: ReviewerWorkload[]) {
    setAction(null);
    setSingleReminder(null);
    setActionMessage(null);
    setError(null);
    const next = reviewers
      .filter(eligible)
      .map((reviewer) => ({
        reviewer,
        assignments: candidateAssignments(reviewer),
        requestId: crypto.randomUUID(),
      }))
      .filter((d) => d.assignments.length);
    if (
      next.length > DIGEST_MAX_REVIEWERS ||
      next.reduce((n, d) => n + d.assignments.length, 0) > DIGEST_MAX_ASSIGNMENTS ||
      next.some((d) => d.assignments.length > DIGEST_MAX_ITEMS)
    ) {
      setError(
        `Select at most ${DIGEST_MAX_REVIEWERS} reviewers, ${DIGEST_MAX_ASSIGNMENTS} assignments in total and ${DIGEST_MAX_ITEMS} per reviewer. Narrow the paper scope first.`,
      );
      return;
    }
    setDrafts(next);
    setStage('choose');
  }
  async function prepare() {
    setBusy(true);
    const next: Draft[] = [];
    for (const d of drafts) {
      if (!d.assignments.length) continue;
      try {
        const preview = await previewReviewerDigest(
          conferenceId,
          d.reviewer.userId,
          d.assignments.map((a) => ({ id: a.id, version: a.version })),
        );
        next.push({ ...d, preview, error: undefined });
      } catch (e) {
        next.push({
          ...d,
          preview: undefined,
          error: e instanceof Error ? e.message : 'Preview failed',
        });
      }
    }
    setDrafts(next);
    setStage('preview');
    setBusy(false);
  }
  async function send() {
    setBusy(true);
    setStage('results');
    const next = [...drafts];
    for (let i = 0; i < next.length; i++) {
      const d = next[i]!;
      if (!d.preview || d.success) continue;
      try {
        const result = await sendReviewerDigest(conferenceId, d.reviewer.userId, {
          assignments: d.assignments.map((a) => ({ id: a.id, version: a.version })),
          requestId: d.requestId,
          previewToken: d.preview.previewToken,
        });
        next[i] = {
          ...d,
          success: true,
          result: `${result.status}${result.alreadyRequested ? ' (already requested)' : ''}. ${result.message}`,
          error: undefined,
        };
      } catch (e) {
        next[i] = {
          ...d,
          success: false,
          error: e instanceof Error ? e.message : 'Request failed. Retry uses the same request ID.',
        };
      }
      setDrafts([...next]);
    }
    setSelected(new Set());
    setBusy(false);
  }
  function openAction(assignment: ReviewerWorkAssignment, kind: 'EXTEND' | 'REPLACE') {
    setStage(null);
    setSingleReminder(null);
    setAction({ assignment, kind });
    setReason('');
    setReplacement('');
    setActionMessage(null);
    setDueAt(
      localDateTimeInput(
        new Date(
          Math.max(Date.now(), new Date(assignment.dueAt!).getTime()) + 86400000,
        ).toISOString(),
      ),
    );
  }
  async function applyAction() {
    if (!action) return;
    setBusy(true);
    setActionMessage(null);
    try {
      const input: AssignmentInterventionInput = {
        action: action.kind,
        version: action.assignment.version,
        reason: reason.trim(),
        dueAt: new Date(dueAt).toISOString(),
        ...(action.kind === 'REPLACE' ? { reviewerUserId: replacement } : {}),
      };
      const result = await interveneReviewerAssignment(conferenceId, action.assignment.id, input);
      setActionMessage(
        `${result.message}${result.notificationWarning ? ` ${result.notificationWarning}` : ''}`,
      );
      setAction(null);
      setSingleReminder(null);
      setRevision((r) => r + 1);
    } catch (e) {
      setActionMessage(e instanceof Error ? e.message : 'Action failed. Refresh and try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-6">
      <PageHeader
        title="Reviewer overview"
        description="See each reviewer’s workload, outstanding reviews and individual deadlines."
        actions={
          <Button
            variant="outline"
            disabled={busy || loading}
            onClick={() => setRevision((r) => r + 1)}
          >
            Refresh
          </Button>
        }
      />
      <ReviewViewSwitch conferenceId={conferenceId} view="reviewers" />
      <p className="max-w-3xl text-sm text-slate-600">
        Counts are paper–cycle assignments. Submitted reviews stay submitted while edits are
        pending. Closed incomplete and retired assignments are separate from outstanding work.
      </p>
      <p className="text-sm text-slate-600">
        Dates are shown in your local time. Email deadlines are shown in UTC.
      </p>
      <nav aria-label="Reviewer attention queues" className="flex flex-wrap gap-2">
        {Object.entries(queues).map(([key, label]) => (
          <Button
            key={key}
            variant={queue === key ? 'default' : 'outline'}
            aria-pressed={queue === key}
            size="sm"
            disabled={busy}
            onClick={() => patch({ queue: key })}
          >
            {label}
            {snapshot && key !== 'ALL'
              ? ` (${key === 'REMAINING' ? snapshot.data.filter((r) => !r.inconsistent && r.remaining > 0).length : key === 'OVERDUE' ? snapshot.summary.overdue : key === 'DUE_SOON' ? snapshot.summary.dueSoon : key === 'SUBMITTED' ? snapshot.summary.allSubmitted : snapshot.summary.unassigned})`
              : ''}
          </Button>
        ))}
      </nav>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <label className="space-y-1 text-sm">
          <span>Find a reviewer</span>
          <input
            className={`${control} w-full`}
            type="search"
            placeholder="Name or email"
            maxLength={200}
            value={reviewerText}
            disabled={busy}
            onChange={(e) => setReviewerText(e.target.value)}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span>Paper scope</span>
          <input
            className={`${control} w-full`}
            type="search"
            placeholder="Title or submission number"
            maxLength={200}
            value={paperText}
            disabled={busy}
            onChange={(e) => setPaperText(e.target.value)}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span>Review cycles</span>
          <select
            aria-label="Review cycles"
            className={`${control} w-full`}
            value={scope.history}
            disabled={busy}
            onChange={(e) => patch({ history: e.target.value })}
          >
            <option value="CURRENT">Latest cycle per paper</option>
            <option value="ALL">All cycles</option>
            <option value="HISTORICAL">Historical cycles only (read only)</option>
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span>Track</span>
          <select
            aria-label="Track"
            className={`${control} w-full`}
            value={scope.track ?? ''}
            disabled={busy}
            onChange={(e) => patch({ track: e.target.value })}
          >
            <option value="">All tracks</option>
            {snapshot?.tracks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span>Cycle number</span>
          <select
            aria-label="Cycle number"
            className={`${control} w-full`}
            value={scope.cycle ?? ''}
            disabled={busy}
            onChange={(e) => patch({ cycle: e.target.value })}
          >
            <option value="">All cycle numbers</option>
            {snapshot?.cycles.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span>Sort reviewers</span>
          <select
            aria-label="Sort reviewers"
            className={`${control} w-full`}
            value={sort}
            disabled={busy}
            onChange={(e) => patch({ sort: e.target.value })}
          >
            <option value="attention">Overdue, then remaining</option>
            <option value="name">Reviewer name</option>
            <option value="remaining">Most remaining</option>
            <option value="assigned">Most assigned</option>
            <option value="submitted">Most submitted</option>
            <option value="deadline">Earliest deadline</option>
          </select>
        </label>
      </div>
      <p className="text-sm text-slate-600">
        {snapshot
          ? `Snapshot ${date(snapshot.observedAt)} · ${snapshot.data.length} reviewers in the selected paper scope. Summary counts are reviewers, before name and attention filters.`
          : loading
            ? 'Loading reviewer roster…'
            : 'Reviewer roster unavailable. Refresh to try again.'}
        {scope.history === 'HISTORICAL' ? ' Historical assignments are read only.' : ''}
      </p>
      {snapshot && stale ? (
        <p role="status" className="text-sm text-amber-800">
          Showing a previous snapshot. Actions are paused until the current view loads successfully.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-rose-700">
          {error}
        </p>
      ) : null}
      {actionMessage ? (
        <p role="status" className="text-sm">
          {actionMessage}
        </p>
      ) : null}
      {loading ? (
        <p role="status" className="text-sm">
          Loading reviewer overview…
        </p>
      ) : null}
      {snapshot && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">{selected.size} reviewers selected on this page</p>
            <Button
              disabled={disabled || !selected.size}
              onClick={() => startDigest(visible.filter((r) => selected.has(r.userId)))}
            >
              Prepare reminders
            </Button>
          </div>
          <div aria-busy={loading} className={stale ? 'opacity-60' : ''}>
            <p className="mb-2 text-xs text-slate-600 xl:hidden">
              Scroll the table horizontally to see review counts, deadlines and actions.
            </p>
            <DataTable>
              <DataTableHeader>
                <DataTableRow>
                  <DataTableHead>
                    <input
                      aria-label="Select eligible reviewers on this page"
                      type="checkbox"
                      disabled={
                        disabled ||
                        !visible.some((r) => eligible(r) && candidateAssignments(r).length)
                      }
                      checked={
                        visible.filter((r) => eligible(r) && candidateAssignments(r).length)
                          .length > 0 &&
                        visible
                          .filter((r) => eligible(r) && candidateAssignments(r).length)
                          .every((r) => selected.has(r.userId))
                      }
                      onChange={(e) =>
                        setSelected(
                          new Set(
                            e.target.checked
                              ? visible
                                  .filter((r) => eligible(r) && candidateAssignments(r).length)
                                  .map((r) => r.userId)
                              : [],
                          ),
                        )
                      }
                    />
                  </DataTableHead>
                  <DataTableHead>Reviewer</DataTableHead>
                  <DataTableHead>Assigned</DataTableHead>
                  <DataTableHead>Submitted</DataTableHead>
                  <DataTableHead>Remaining</DataTableHead>
                  <DataTableHead>Overdue</DataTableHead>
                  <DataTableHead>Due soon</DataTableHead>
                  <DataTableHead>Earliest outstanding</DataTableHead>
                  <DataTableHead>Actions</DataTableHead>
                </DataTableRow>
              </DataTableHeader>
              <DataTableBody>
                {!rows.length && (
                  <DataTableRow>
                    <DataTableCell colSpan={9}>
                      <div className="space-y-2 py-8">
                        <p className="font-medium">
                          {snapshot.data.length || snapshot.roster.length || scope.paperSearch
                            ? 'No reviewers match these filters.'
                            : 'No reviewers or assignments yet.'}
                        </p>
                        <p className="text-sm text-slate-600">
                          {snapshot.data.length || snapshot.roster.length || scope.paperSearch
                            ? 'Clear the reviewer or paper search, or choose another attention queue.'
                            : 'Add reviewers to this conference to start assigning papers.'}
                        </p>
                        {!snapshot.data.length && !snapshot.roster.length && !scope.paperSearch && (
                          <Link
                            className="underline underline-offset-4"
                            href={`${base}/reviews/assignments/invites`}
                          >
                            Manage reviewer invitations
                          </Link>
                        )}
                      </div>
                    </DataTableCell>
                  </DataTableRow>
                )}
                {visible.map((r) => (
                  <Fragment key={r.userId}>
                    <DataTableRow>
                      <DataTableCell>
                        <input
                          aria-label={`Select ${r.name}`}
                          type="checkbox"
                          checked={selected.has(r.userId)}
                          disabled={disabled || !eligible(r) || !candidateAssignments(r).length}
                          onChange={(e) =>
                            setSelected((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(r.userId);
                              else next.delete(r.userId);
                              return next;
                            })
                          }
                        />
                      </DataTableCell>
                      <DataTableCell>
                        <button
                          aria-expanded={expanded.has(r.userId)}
                          aria-controls={`assignments-${r.userId}`}
                          className="flex min-h-11 items-center gap-2 text-left font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          onClick={() =>
                            setExpanded((prev) => {
                              const next = new Set(prev);
                              if (next.has(r.userId)) next.delete(r.userId);
                              else next.add(r.userId);
                              return next;
                            })
                          }
                        >
                          {expanded.has(r.userId) ? (
                            <ChevronDown className="h-4 w-4 shrink-0" />
                          ) : (
                            <ChevronRight className="h-4 w-4 shrink-0" />
                          )}
                          {r.name}
                        </button>
                        <p className="break-all text-xs text-slate-600">{r.email}</p>
                        <p className="mt-1 max-w-64 text-xs text-slate-600">
                          {(() => {
                            const papers = [
                              ...new Map(
                                r.assignments.map((a) => [
                                  a.paperId,
                                  a.submissionNumber ?? a.paperTitle,
                                ]),
                              ).values(),
                            ];
                            return papers.length
                              ? `${papers.slice(0, 3).join(' · ')}${papers.length > 3 ? ` +${papers.length - 3} more` : ''}`
                              : 'No assignments in this scope';
                          })()}
                        </p>
                        {!r.hasReviewerRole && (
                          <p className="mt-1 text-xs text-amber-800">
                            Reviewer role removed · replace outstanding work
                          </p>
                        )}
                        {r.inconsistent && (
                          <p className="mt-1 text-xs text-rose-700">
                            Data needs checking · totals unavailable
                          </p>
                        )}
                        {r.digestToday && (
                          <p className="mt-1 text-xs text-slate-600">
                            Today’s digest: {r.digestToday.status.toLowerCase()}
                          </p>
                        )}
                      </DataTableCell>
                      <DataTableCell className="tabular-nums">
                        {r.inconsistent ? '—' : r.assigned}
                      </DataTableCell>
                      <DataTableCell className="tabular-nums">
                        {r.inconsistent ? '—' : r.submitted}
                      </DataTableCell>
                      <DataTableCell className="tabular-nums">
                        {r.inconsistent ? (
                          '—'
                        ) : (
                          <>
                            <span className="font-medium">{r.remaining}</span>
                            <p className="whitespace-nowrap text-xs text-slate-600">
                              {r.notStarted} not started · {r.drafts} drafts
                            </p>
                            {r.closedIncomplete > 0 && (
                              <p className="text-xs text-slate-600">
                                {r.closedIncomplete} closed incomplete
                              </p>
                            )}
                          </>
                        )}
                      </DataTableCell>
                      <DataTableCell
                        className={
                          r.overdue ? 'font-medium tabular-nums text-rose-700' : 'tabular-nums'
                        }
                      >
                        {r.inconsistent ? '—' : r.overdue}
                      </DataTableCell>
                      <DataTableCell className="tabular-nums">
                        {r.inconsistent ? '—' : r.dueSoon}
                      </DataTableCell>
                      <DataTableCell className="min-w-40 text-sm">
                        {r.inconsistent ? '—' : date(r.earliestDeadline)}
                        {!r.inconsistent &&
                          r.remaining > 0 &&
                          r.earliestDeadline &&
                          r.earliestDeadline < snapshot.observedAt && (
                            <p className="text-xs font-medium text-rose-700">Overdue</p>
                          )}
                      </DataTableCell>
                      <DataTableCell>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={disabled || !eligible(r) || !candidateAssignments(r).length}
                            onClick={() => startDigest([r])}
                          >
                            Remind
                          </Button>
                          {r.hasReviewerRole && scope.history !== 'HISTORICAL' && (
                            <Button size="sm" variant="ghost" asChild>
                              <Link
                                href={`${base}/reviews/assignments/manual?reviewer=${r.userId}`}
                              >
                                Assign paper
                              </Link>
                            </Button>
                          )}
                        </div>
                      </DataTableCell>
                    </DataTableRow>
                    {expanded.has(r.userId) && (
                      <DataTableRow>
                        <DataTableCell colSpan={9}>
                          <div
                            id={`assignments-${r.userId}`}
                            className="w-[calc(100vw-4.25rem)] space-y-3 py-3 lg:w-auto"
                          >
                            <p className="text-sm font-medium">Assignments for {r.name}</p>
                            {!r.assignments.length ? (
                              <p className="text-sm text-slate-600">
                                No assignments in this paper and cycle scope.
                              </p>
                            ) : (
                              r.assignments.map((a) => (
                                <div
                                  key={a.id}
                                  className="flex flex-col items-start justify-between gap-3 border-t border-slate-200 pt-3 sm:flex-row sm:flex-wrap"
                                >
                                  <div className="min-w-0 max-w-xl space-y-1 break-words">
                                    <Link
                                      href={`${base}/submissions/${a.paperId}?section=reviews&round=${a.roundId}`}
                                      className="font-medium underline underline-offset-4"
                                    >
                                      {a.submissionNumber ?? 'Unnumbered'} · {a.paperTitle}
                                    </Link>
                                    <p className="text-sm text-slate-600">
                                      {a.trackName} · Cycle {a.roundNumber}
                                      {a.isCurrentCycle ? '' : ' · Historical'} ·{' '}
                                      {labels[a.workState]}
                                      {a.workState === 'RETIRED'
                                        ? ` (${a.status.toLowerCase()})`
                                        : ''}
                                    </p>
                                    <p
                                      className={`text-sm ${a.overdue ? 'text-rose-700' : 'text-slate-600'}`}
                                    >
                                      Deadline {date(a.dueAt)}
                                      {a.overdue
                                        ? ' · Overdue'
                                        : a.dueSoon
                                          ? ' · Due within 72 hours'
                                          : ''}
                                    </p>
                                  </div>
                                  {a.canIntervene && !r.inconsistent && (
                                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
                                      {r.hasReviewerRole && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          disabled={disabled}
                                          onClick={() => {
                                            setAction(null);
                                            setStage(null);
                                            setActionMessage(null);
                                            setSingleReminder(a);
                                          }}
                                        >
                                          Remind assignment
                                        </Button>
                                      )}
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={disabled}
                                        onClick={() => openAction(a, 'EXTEND')}
                                      >
                                        Extend deadline
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={disabled}
                                        onClick={() => openAction(a, 'REPLACE')}
                                      >
                                        Replace reviewer
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                        </DataTableCell>
                      </DataTableRow>
                    )}
                  </Fragment>
                ))}
              </DataTableBody>
            </DataTable>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <p>
              {rows.length} of {snapshot.data.length} reviewers · Page {currentPage} of {pages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={busy || currentPage === 1}
                onClick={() => {
                  patch({ page: String(currentPage - 1) });
                  setSelected(new Set());
                }}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={busy || currentPage === pages}
                onClick={() => {
                  patch({ page: String(currentPage + 1) });
                  setSelected(new Set());
                }}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
      {stage && (
        <section
          aria-labelledby="digest-heading"
          className="space-y-4 rounded-lg border border-slate-200 p-4 sm:p-6"
        >
          <h2
            id="digest-heading"
            ref={panelHeading}
            tabIndex={-1}
            className="text-lg font-semibold"
          >
            {stage === 'choose'
              ? 'Choose reminder assignments'
              : stage === 'preview'
                ? 'Review reminder emails'
                : 'Reminder request results'}
          </h2>
          <p className="max-w-3xl text-sm text-slate-600">
            One consolidated email per reviewer. Each selected paper includes its saved individual
            deadline in UTC. Limit: one manual digest per reviewer per conference per UTC day;
            individual and scheduled reminders are separate.
          </p>
          <p className="text-sm font-medium">
            {drafts.length} reminder {drafts.length === 1 ? 'email' : 'emails'} ·{' '}
            {drafts.reduce((n, d) => n + (d.preview?.items.length ?? d.assignments.length), 0)}{' '}
            assignments
          </p>
          {drafts.map((d) => (
            <div key={d.reviewer.userId} className="space-y-3 border-t border-slate-200 pt-4">
              <h3 className="font-medium">
                {d.preview?.reviewerName ?? d.reviewer.name}{' '}
                <span className="break-all font-normal text-slate-600">
                  ({d.preview?.recipient ?? d.reviewer.email})
                </span>
              </h3>
              {stage === 'choose'
                ? d.reviewer.assignments
                    .filter((a) => a.canIntervene)
                    .map((a) => (
                      <label key={a.id} className="flex min-h-11 items-start gap-3 text-sm">
                        <input
                          className="mt-1"
                          type="checkbox"
                          checked={d.assignments.some((i) => i.id === a.id)}
                          disabled={busy}
                          onChange={(e) =>
                            setDrafts((prev) =>
                              prev.map((old) =>
                                old.reviewer.userId === d.reviewer.userId
                                  ? {
                                      ...old,
                                      preview: undefined,
                                      assignments: e.target.checked
                                        ? [...old.assignments, a]
                                        : old.assignments.filter((i) => i.id !== a.id),
                                    }
                                  : old,
                              ),
                            )
                          }
                        />
                        <span>
                          {a.submissionNumber ?? 'Unnumbered'} · {a.paperTitle}
                          <span className="block text-slate-600">
                            Cycle {a.roundNumber} · Deadline {date(a.dueAt)}
                            {a.overdue ? ' · Overdue' : ''}
                          </span>
                        </span>
                      </label>
                    ))
                : null}
              {stage !== 'choose' && (
                <div className="space-y-2 text-sm">
                  <p className="font-medium">
                    {d.preview?.items.length ?? d.assignments.length} selected assignments
                  </p>
                  <ul className="space-y-2">
                    {(d.preview?.items ?? d.assignments).map((a) => (
                      <li key={a.id}>
                        {a.submissionNumber ?? 'Unnumbered'} · {a.paperTitle}
                        <span className="block text-slate-600">
                          Cycle {a.roundNumber} · Deadline {date(a.dueAt)}
                          {a.overdue ? ' · Overdue' : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {d.preview && stage === 'preview' && (
                <>
                  <p className="text-sm">
                    <span className="font-medium">Subject:</span> {d.preview.subject}
                  </p>
                  <details>
                    <summary className="min-h-11 cursor-pointer py-2 text-sm underline underline-offset-4">
                      Show exact email preview
                    </summary>
                    <iframe
                      title={`Email preview for ${d.preview.reviewerName}`}
                      sandbox=""
                      srcDoc={d.preview.html}
                      className="h-96 w-full rounded-md border border-slate-200 bg-white"
                    />
                    <pre className="mt-3 whitespace-pre-wrap break-words text-sm">
                      {d.preview.text}
                    </pre>
                  </details>
                </>
              )}
              {d.error && (
                <p role="alert" className="text-sm text-rose-700">
                  {d.error}
                </p>
              )}
              {d.result && (
                <p role="status" className="text-sm">
                  {d.result}
                </p>
              )}
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            {stage === 'choose' && (
              <Button
                disabled={
                  disabled ||
                  !drafts.some((d) => d.assignments.length) ||
                  drafts.reduce((n, d) => n + d.assignments.length, 0) > DIGEST_MAX_ASSIGNMENTS ||
                  drafts.some((d) => d.assignments.length > DIGEST_MAX_ITEMS)
                }
                onClick={() => void prepare()}
              >
                {busy ? 'Preparing previews…' : 'Preview emails'}
              </Button>
            )}
            {stage === 'preview' && (
              <>
                <Button
                  disabled={disabled || drafts.some((d) => !d.preview) || !drafts.length}
                  onClick={() => void send()}
                >
                  Confirm {drafts.length} reminder {drafts.length === 1 ? 'email' : 'emails'}
                </Button>
                <Button variant="outline" disabled={busy} onClick={() => setStage('choose')}>
                  Change selection
                </Button>
              </>
            )}
            {stage === 'results' && drafts.some((d) => d.preview && !d.success) && (
              <Button disabled={disabled} onClick={() => void send()}>
                Retry unsuccessful requests
              </Button>
            )}
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                setStage(null);
                if (stage === 'results') setRevision((r) => r + 1);
              }}
            >
              Close{stage === 'results' ? ' and refresh' : ''}
            </Button>
          </div>
        </section>
      )}
      {singleReminder && (
        <section
          aria-labelledby="single-reminder-heading"
          className="space-y-4 rounded-lg border border-slate-200 p-4 sm:p-6"
        >
          <h2
            id="single-reminder-heading"
            ref={panelHeading}
            tabIndex={-1}
            className="text-lg font-semibold"
          >
            Confirm individual reminder
          </h2>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="font-medium">Recipient</dt>
              <dd className="break-all">
                {singleReminder.reviewerName} · {singleReminder.reviewerEmail}
              </dd>
            </div>
            <div>
              <dt className="font-medium">Assignment</dt>
              <dd>
                {singleReminder.submissionNumber ?? 'Unnumbered'} · {singleReminder.paperTitle} ·
                Cycle {singleReminder.roundNumber}
              </dd>
            </div>
            <div>
              <dt className="font-medium">Current individual deadline</dt>
              <dd>{date(singleReminder.dueAt)}</dd>
            </div>
          </dl>
          <p className="text-sm text-slate-600">
            Send one reminder for this assignment using the existing individual reminder policy.
            Consolidated reviewer reminders have a separate daily limit.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={disabled}
              onClick={async () => {
                setBusy(true);
                setActionMessage(null);
                try {
                  const result = await interveneReviewerAssignment(
                    conferenceId,
                    singleReminder.id,
                    { action: 'REMIND', version: singleReminder.version },
                  );
                  setActionMessage(result.message);
                  setSingleReminder(null);
                  setRevision((r) => r + 1);
                } catch (e) {
                  setActionMessage(
                    e instanceof Error ? e.message : 'Reminder failed. Refresh and try again.',
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? 'Requesting…' : 'Confirm individual reminder'}
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => setSingleReminder(null)}>
              Cancel
            </Button>
          </div>
        </section>
      )}
      {action && (
        <section
          aria-labelledby="assignment-action-heading"
          className="space-y-4 rounded-lg border border-slate-200 p-4 sm:p-6"
        >
          <h2
            id="assignment-action-heading"
            ref={panelHeading}
            tabIndex={-1}
            className="text-lg font-semibold"
          >
            {action.kind === 'EXTEND' ? 'Extend reviewer deadline' : 'Replace reviewer'}
          </h2>
          <p className="text-sm">
            {action.assignment.reviewerName} · {action.assignment.paperTitle} · Cycle{' '}
            {action.assignment.roundNumber}
          </p>
          <p className="text-sm text-slate-600">
            Current deadline: {date(action.assignment.dueAt)}
            {action.kind === 'REPLACE'
              ? '. The original assignment and any draft will be preserved.'
              : ''}
          </p>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void applyAction();
            }}
          >
            {action.kind === 'REPLACE' && (
              <label className="block space-y-1 text-sm">
                <span>Replacement reviewer</span>
                <select
                  className={`${control} w-full`}
                  required
                  value={replacement}
                  disabled={busy}
                  onChange={(e) => setReplacement(e.target.value)}
                >
                  <option value="">Choose a reviewer</option>
                  {snapshot?.roster
                    .filter((r) => r.userId !== action.assignment.reviewerUserId)
                    .map((r) => (
                      <option key={r.userId} value={r.userId}>
                        {r.name} · {r.email}
                      </option>
                    ))}
                </select>
              </label>
            )}
            <label className="block space-y-1 text-sm">
              <span>New individual deadline (your local time)</span>
              <input
                className={`${control} w-full sm:max-w-sm`}
                type="datetime-local"
                required
                value={dueAt}
                disabled={busy}
                min={localDateTimeInput(
                  new Date(
                    Math.max(
                      Date.now(),
                      action.kind === 'EXTEND' ? new Date(action.assignment.dueAt!).getTime() : 0,
                    ) + 60000,
                  ).toISOString(),
                )}
                onChange={(e) => setDueAt(e.target.value)}
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span>Reason (required)</span>
              <textarea
                className={`${control} w-full`}
                required
                maxLength={1000}
                value={reason}
                disabled={busy}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={
                  disabled ||
                  !reason.trim() ||
                  !dueAt ||
                  (action.kind === 'REPLACE' && !replacement)
                }
                type="submit"
              >
                {busy
                  ? 'Saving…'
                  : action.kind === 'EXTEND'
                    ? 'Confirm extension'
                    : 'Confirm replacement'}
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                type="button"
                onClick={() => setAction(null)}
              >
                Cancel
              </Button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}
