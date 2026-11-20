'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Download, Search, X } from 'lucide-react';
import type { RegistrationListDto } from '@openconferences/schemas';
import { SubmissionDate } from '@/components/dashboard/submission-date';
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableFooter,
  DataTableHead,
  DataTableHeader,
  DataTablePagination,
  DataTableRow,
  DataTableSkeleton,
} from '@/components/dashboard/data-table';
import { downloadCsv } from '@/components/dashboard/analytics/analytics-card';
import { EarlyBirdDialog } from '@/components/dashboard/registrations/early-bird-dialog';
import { WorkflowBadge } from '@/components/dashboard/workflow-badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { useCursorList } from '@/hooks/dashboard/use-cursor-list';
import { useIsDesktop } from '@/hooks/dashboard/use-is-desktop';
import {
  extendEarlyBird,
  fetchRegistrations,
  type RegistrationListStatusFilter,
} from '@/lib/api-client';
import {
  audienceLabel,
  earlyBirdNote,
  formatRegistrationMoney,
  isPaidAwaitingStudentApproval,
  isUnpaidRegistration,
  REGISTRATION_STATUS,
  registrationDeadlineState,
  registrationStatusView,
} from '@/lib/registrations';
import { cn } from '@/lib/utils';

type RegistrationRow = RegistrationListDto['data'][number];
type Summary = NonNullable<RegistrationListDto['summary']>;

/** Grouped views with a live count. They use the same definitions as Analytics. */
const VIEWS = [
  { status: '', label: 'All', count: 'total', tone: 'text-slate-900' },
  { status: 'unpaid', label: 'Unpaid', count: 'unpaid', tone: 'text-slate-900' },
  { status: 'overdue', label: 'Past deadline', count: 'overdue', tone: 'text-rose-700' },
  { status: 'at-risk', label: 'Due within 7 days', count: 'atRisk', tone: 'text-amber-700' },
  { status: 'paid', label: 'Paid', count: 'paid', tone: 'text-emerald-700' },
  {
    status: 'AWAITING_VERIFICATION',
    label: 'Paid, student not approved',
    count: 'awaitingVerification',
    tone: 'text-sky-700',
  },
] as const;
const VIEW_STATUSES = new Set<string>(VIEWS.map((view) => view.status));
const STATUS_VALUES = new Set<string>([
  ...VIEWS.map((view) => view.status),
  ...Object.keys(REGISTRATION_STATUS),
]);
const CONTROL =
  'min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const DEADLINE_TONE = {
  overdue: 'text-rose-700',
  soon: 'text-amber-700',
  ok: 'text-slate-500',
} as const;

function displayDate(value: string) {
  return Number.isNaN(Date.parse(value))
    ? 'Date unavailable'
    : new Date(value).toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
}

export default function RegistrationsAllPage() {
  const conferenceId = useParams<{ id: string }>().id;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const toast = useToast();
  const isDesktop = useIsDesktop();

  // Filters live in the URL so a view can be linked from Analytics or shared.
  const statusParam = searchParams.get('status') ?? '';
  const status = STATUS_VALUES.has(statusParam) ? statusParam : '';
  const audienceParam = searchParams.get('audience');
  const audience: '' | 'REGULAR' | 'STUDENT' =
    audienceParam === 'REGULAR' || audienceParam === 'STUDENT' ? audienceParam : '';
  const search = searchParams.get('q') ?? '';
  const [searchText, setSearchText] = useState(search);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [exporting, setExporting] = useState(false);
  const [conferenceEarlyBirdEndsAt, setConferenceEarlyBirdEndsAt] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [extending, setExtending] = useState(false);
  const [saving, setSaving] = useState(false);

  const setFilter = useCallback(
    (patch: Record<string, string>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  // Typing updates the URL after a short pause, so each keystroke is not a request.
  useEffect(() => setSearchText(search), [search]);
  useEffect(() => {
    if (searchText.trim() === search) return;
    const timer = window.setTimeout(() => setFilter({ q: searchText.trim() }), 300);
    return () => window.clearTimeout(timer);
  }, [searchText, search, setFilter]);

  const filters = useCallback(
    () => ({
      ...(status ? { status: status as RegistrationListStatusFilter } : {}),
      ...(audience ? { audience } : {}),
      ...(search ? { search } : {}),
    }),
    [status, audience, search],
  );
  const fetchPage = useCallback(
    async (cursor?: string) => {
      const result = await fetchRegistrations(conferenceId, {
        limit: 50,
        ...filters(),
        ...(cursor ? { cursor } : {}),
      });
      if (result.summary) setSummary(result.summary);
      if (result.earlyBirdEndsAt !== undefined)
        setConferenceEarlyBirdEndsAt(result.earlyBirdEndsAt);
      return { data: result.data, nextCursor: result.nextCursor };
    },
    [conferenceId, filters],
  );
  const { items, nextCursor, loading, loadingMore, error, loadMore, refresh } =
    useCursorList<RegistrationRow>({ fetchPage });
  useEffect(() => {
    // A new view shows other rows, so a selection made in the old one is dropped.
    setSelected(new Set());
    void refresh();
  }, [refresh]);

  // The early-bird rate can only still change for papers that have not paid.
  const selectableRows = items.filter((row) => row.status === 'PENDING');
  const chosen = selectableRows.filter((row) => selected.has(row.id));
  const allChosen = selectableRows.length > 0 && chosen.length === selectableRows.length;
  function toggleSelected(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function saveEarlyBird(earlyBirdEndsAt: string | null) {
    setSaving(true);
    try {
      const result = await extendEarlyBird(conferenceId, {
        registrationIds: chosen.map((row) => row.id),
        earlyBirdEndsAt,
      });
      const papers = (count: number) => `${count} paper${count === 1 ? '' : 's'}`;
      const skipped = result.skipped.length
        ? ` ${papers(result.skipped.length)} left unchanged: ${[
            ...new Set(result.skipped.map((item) => item.reason.toLowerCase())),
          ].join('; ')}.`
        : '';
      const message = `${
        earlyBirdEndsAt
          ? `Early-bird rate extended for ${papers(result.updated.length)}.`
          : `Early-bird extension removed for ${papers(result.updated.length)}.`
      }${skipped}`;
      if (result.updated.length > 0) toast.success(message);
      else toast.error(message);
      setExtending(false);
      setSelected(new Set());
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not change the early-bird date.');
    } finally {
      setSaving(false);
    }
  }

  const filtered = Boolean(status || audience || search);
  // Only the grouped views have a count; an exact status is chosen from the menu.
  const exactStatus = status in REGISTRATION_STATUS && !VIEW_STATUSES.has(status) ? status : '';

  async function exportCsv() {
    setExporting(true);
    try {
      const rows: RegistrationRow[] = [];
      let cursor: string | undefined;
      do {
        const page = await fetchRegistrations(conferenceId, {
          limit: 100,
          ...filters(),
          ...(cursor ? { cursor } : {}),
        });
        rows.push(...page.data);
        cursor = page.nextCursor ?? undefined;
      } while (cursor);
      downloadCsv(`registrations${status ? `-${status.toLowerCase()}` : ''}.csv`, [
        [
          'Paper code',
          'Paper',
          'Billing name',
          'Billing email',
          'Audience',
          'Status',
          'Amount',
          'Currency',
          'Deadline',
          'Early bird extended until',
          'Submitted',
        ],
        ...rows.map((row) => [
          row.submissionNumber ?? '',
          row.paperTitle ?? row.paperId,
          row.billingName ?? '',
          row.billingEmail ?? '',
          audienceLabel(row.audience),
          registrationStatusView(row.status).label,
          (row.amountDueMinor / 100).toFixed(2),
          row.currency,
          row.deadlineAt,
          row.earlyBirdExtendedUntil ?? '',
          row.paperSubmittedAt ?? '',
        ]),
      ]);
      toast.success(`Exported ${rows.length} registration${rows.length === 1 ? '' : 's'}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not export registrations.');
    } finally {
      setExporting(false);
    }
  }

  function paper(row: RegistrationRow) {
    const contact = [row.billingName, row.billingEmail].filter(Boolean).join(' · ');
    return (
      <>
        <Link
          href={`/dashboard/conferences/${conferenceId}/submissions/${row.paperId}?section=registration`}
          className="break-words font-medium text-slate-900 underline decoration-slate-300 underline-offset-4 hover:decoration-slate-500"
        >
          {row.paperTitle ?? row.paperId}
        </Link>
        {row.submissionNumber ? (
          <p className="mt-1 font-mono text-xs text-slate-500">{row.submissionNumber}</p>
        ) : null}
        <p className="mt-1 break-words text-xs text-slate-600">
          {contact || 'No billing contact yet'}
        </p>
      </>
    );
  }
  function statusBadge(row: RegistrationRow) {
    const view = registrationStatusView(row.status);
    const note = earlyBirdNote(row, conferenceEarlyBirdEndsAt);
    return (
      <>
        <WorkflowBadge label={view.label} tone={view.tone} />
        {note ? (
          <span
            className={cn(
              'mt-1.5 block text-xs',
              note.tone === 'active' ? 'font-medium text-emerald-700' : 'text-slate-500',
            )}
          >
            {note.label}
          </span>
        ) : null}
      </>
    );
  }
  function selectBox(row: RegistrationRow) {
    if (row.status !== 'PENDING') return null;
    return (
      <input
        type="checkbox"
        className="size-4 accent-slate-900"
        checked={selected.has(row.id)}
        disabled={saving}
        onChange={() => toggleSelected(row.id)}
        aria-label={`Select ${row.paperTitle ?? row.paperId}`}
      />
    );
  }
  function amount(row: RegistrationRow) {
    const awaitingApproval = isPaidAwaitingStudentApproval(row.status);
    const unpaid = isUnpaidRegistration(row.status);
    if (unpaid && row.amountDueMinor === 0)
      return <span className="text-xs text-slate-500">Fee not set yet</span>;
    return (
      <>
        <span className="font-medium tabular-nums text-slate-900">
          {formatRegistrationMoney(row.amountDueMinor, row.currency)}
        </span>
        <span className="mt-0.5 block text-xs text-slate-500">
          {row.status === 'PAID'
            ? 'Paid'
            : awaitingApproval
              ? 'Paid at student rate'
              : unpaid
                ? 'Due'
                : 'Registration fee'}
        </span>
      </>
    );
  }
  function deadline(row: RegistrationRow) {
    const state = registrationDeadlineState(row.status, row.deadlineAt);
    return (
      <>
        <time dateTime={row.deadlineAt} className="whitespace-nowrap tabular-nums text-slate-700">
          {displayDate(row.deadlineAt)}
        </time>
        {state ? (
          <span className={cn('mt-0.5 block text-xs font-medium', DEADLINE_TONE[state.tone])}>
            {state.label}
          </span>
        ) : null}
      </>
    );
  }

  const countLine = `${items.length}${nextCursor ? '+' : ''} registration${items.length === 1 ? '' : 's'} shown`;

  return (
    <div className="space-y-5">
      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"
        >
          {error}
        </p>
      ) : null}

      <div
        role="group"
        aria-label="Registration views"
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6"
      >
        {VIEWS.map((view) => {
          const pressed = status === view.status;
          return (
            <button
              key={view.label}
              type="button"
              aria-pressed={pressed}
              onClick={() => setFilter({ status: view.status })}
              className={cn(
                'rounded-2xl border bg-white p-4 text-left transition-[box-shadow,border-color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                pressed
                  ? 'border-slate-900 shadow-[0_0_0_1px_rgb(15_23_42)]'
                  : 'border-slate-200 hover:border-slate-300 hover:shadow-sm',
              )}
            >
              <span className="block text-xs font-medium text-slate-500">{view.label}</span>
              <span
                className={cn(
                  'mt-1 block text-2xl font-semibold tabular-nums tracking-tight',
                  summary ? view.tone : 'text-slate-300',
                )}
              >
                {summary ? summary[view.count].toLocaleString('en-US') : '—'}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="relative min-w-[14rem] flex-1">
          <span className="sr-only">Find a registration</span>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <input
            type="search"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Paper title, code, billing name or email"
            className={cn(CONTROL, 'w-full pl-9')}
          />
        </label>
        <select
          aria-label="Filter by exact status"
          className={CONTROL}
          value={exactStatus}
          onChange={(event) => setFilter({ status: event.target.value })}
        >
          <option value="">Any status</option>
          {Object.entries(REGISTRATION_STATUS).map(([value, view]) => (
            <option key={value} value={value}>
              {view.label}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by audience"
          className={CONTROL}
          value={audience}
          onChange={(event) => setFilter({ audience: event.target.value })}
        >
          <option value="">Any audience</option>
          <option value="REGULAR">Regular</option>
          <option value="STUDENT">Student</option>
        </select>
        {filtered ? (
          <Button
            variant="outline"
            onClick={() => {
              setSearchText('');
              setFilter({ status: '', audience: '', q: '' });
            }}
          >
            <X className="mr-1.5 size-4" aria-hidden />
            Clear filters
          </Button>
        ) : null}
        <Button
          variant="outline"
          className="bg-white"
          disabled={exporting || loading || items.length === 0}
          onClick={() => void exportCsv()}
        >
          <Download className="mr-1.5 size-4" aria-hidden />
          {exporting ? 'Exporting…' : 'Export CSV'}
        </Button>
      </div>

      {loading ? (
        <DataTableSkeleton rows={6} />
      ) : items.length === 0 ? (
        <div
          role="status"
          className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center"
        >
          <p className="font-medium text-slate-900">
            {filtered ? 'No registrations match these filters' : 'No registrations yet'}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {filtered
              ? 'Try another view, status or search term.'
              : 'A registration opens for each paper when it is accepted.'}
          </p>
        </div>
      ) : isDesktop ? (
        <DataTable footer={<DataTableFooter>{countLine}</DataTableFooter>}>
          <DataTableHeader>
            <tr>
              <DataTableHead className="w-10">
                <input
                  type="checkbox"
                  className="size-4 accent-slate-900"
                  checked={allChosen}
                  disabled={saving || selectableRows.length === 0}
                  onChange={(event) =>
                    setSelected(
                      event.target.checked
                        ? new Set(selectableRows.map((row) => row.id))
                        : new Set(),
                    )
                  }
                  aria-label="Select all unpaid registrations shown"
                />
              </DataTableHead>
              <DataTableHead>Paper</DataTableHead>
              <DataTableHead>Submission date</DataTableHead>
              <DataTableHead>Audience</DataTableHead>
              <DataTableHead>Status</DataTableHead>
              <DataTableHead>Amount</DataTableHead>
              <DataTableHead>Deadline</DataTableHead>
            </tr>
          </DataTableHeader>
          <DataTableBody>
            {items.map((row) => (
              <DataTableRow key={row.id} className="align-top">
                <DataTableCell>{selectBox(row)}</DataTableCell>
                <DataTableCell>{paper(row)}</DataTableCell>
                <DataTableCell>
                  <SubmissionDate value={row.paperSubmittedAt} />
                </DataTableCell>
                <DataTableCell>{audienceLabel(row.audience)}</DataTableCell>
                <DataTableCell>{statusBadge(row)}</DataTableCell>
                <DataTableCell>{amount(row)}</DataTableCell>
                <DataTableCell>{deadline(row)}</DataTableCell>
              </DataTableRow>
            ))}
          </DataTableBody>
        </DataTable>
      ) : (
        <div className="space-y-3">
          <ul className="space-y-3">
            {items.map((row) => (
              <li key={row.id} className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    {row.status === 'PENDING' ? (
                      <span className="pt-0.5">{selectBox(row)}</span>
                    ) : null}
                    <div className="min-w-0">{paper(row)}</div>
                  </div>
                  <div className="shrink-0 text-right">{statusBadge(row)}</div>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-slate-100 pt-3">
                  <div>
                    <dt className="text-xs text-slate-500">Amount</dt>
                    <dd className="mt-1">{amount(row)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Deadline</dt>
                    <dd className="mt-1">{deadline(row)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Audience</dt>
                    <dd className="mt-1 text-slate-700">{audienceLabel(row.audience)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Submission date</dt>
                    <dd className="mt-1">
                      <SubmissionDate value={row.paperSubmittedAt} />
                    </dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
          <p className="text-xs text-slate-500">{countLine}</p>
        </div>
      )}
      {!loading ? (
        <DataTablePagination nextCursor={nextCursor} onLoadMore={loadMore} loading={loadingMore} />
      ) : null}

      {chosen.length > 0 ? (
        <div className="sticky bottom-0 z-20">
          <div className="flex flex-wrap items-center gap-3 rounded-xl bg-slate-900 p-4 text-white">
            <span className="text-sm font-medium tabular-nums">{chosen.length} selected</span>
            <span className="h-5 w-px bg-white/20" />
            <Button
              size="sm"
              className="bg-white text-slate-900 hover:bg-slate-100"
              disabled={saving}
              onClick={() => setExtending(true)}
            >
              Extend early bird
            </Button>
            <button
              type="button"
              className="rounded-lg px-2 py-1.5 text-xs text-slate-300 hover:text-white"
              disabled={saving}
              onClick={() => setSelected(new Set())}
            >
              Clear
            </button>
          </div>
        </div>
      ) : null}

      {extending && chosen.length > 0 ? (
        <EarlyBirdDialog
          count={chosen.length}
          canRemove={chosen.some((row) => Boolean(row.earlyBirdExtendedUntil))}
          busy={saving}
          onSubmit={(earlyBirdEndsAt) => void saveEarlyBird(earlyBirdEndsAt)}
          onCancel={() => setExtending(false)}
        />
      ) : null}
    </div>
  );
}
