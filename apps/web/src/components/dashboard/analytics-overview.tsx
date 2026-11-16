'use client';

import { useEffect, useRef, useState } from 'react';
import { ClipboardCheck, FileText, RefreshCw, Users, Wallet } from 'lucide-react';
import type { ConferenceAnalyticsOverview } from '@openconferences/schemas';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchAnalyticsOverview } from '@/lib/api-client';
import { activitySeries, formatAnalyticsMoney, formatAnalyticsNumber } from '@/lib/analytics';
import { decisionOutcomeLabel } from '@/lib/review-types';
import { cn } from '@/lib/utils';
import './analytics/analytics.css';
import { chartColors, type ChartPoint } from './analytics/analytics-card';
import {
  AttentionTile,
  KpiTile,
  MiniStack,
  ProgressRing,
  Sparkline,
} from './analytics/analytics-kpis';
import { FinanceTab, PapersTab, PeopleTab, ReviewsTab } from './analytics/analytics-tabs';

const number = formatAnalyticsNumber;

const TABS = [
  { id: 'papers', label: 'Papers', icon: FileText },
  { id: 'reviews', label: 'Reviews & decisions', icon: ClipboardCheck },
  { id: 'people', label: 'People', icon: Users },
  { id: 'finance', label: 'Finance', icon: Wallet },
] as const;
type TabId = (typeof TABS)[number]['id'];
// Links to the previous single-page layout still land on the matching tab.
const LEGACY_HASH: Record<string, TabId> = {
  'submission-activity': 'papers',
  'review-health': 'reviews',
  participation: 'people',
  'registration-finance': 'finance',
};
const OUTCOME_ORDER = ['ACCEPT', 'MINOR_REVISION', 'MAJOR_REVISION', 'REJECT'] as const;
const OUTCOME_COLOR: Record<(typeof OUTCOME_ORDER)[number], string> = {
  ACCEPT: chartColors.good,
  MINOR_REVISION: chartColors.sky,
  MAJOR_REVISION: chartColors.warning,
  REJECT: chartColors.critical,
};

export function AnalyticsOverview({
  conferenceId,
  preview,
}: {
  conferenceId: string;
  preview?: ConferenceAnalyticsOverview;
}) {
  const [snapshot, setSnapshot] = useState<ConferenceAnalyticsOverview | null>(preview ?? null);
  const [loadedId, setLoadedId] = useState(preview ? conferenceId : '');
  const [loading, setLoading] = useState(!preview);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [currencyChoice, setCurrencyChoice] = useState({ conferenceId, currency: '' });
  const [tab, setTab] = useState<TabId>('papers');
  const tabList = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (preview) return;
    let alive = true;
    setLoading(true);
    setError(null);
    fetchAnalyticsOverview(conferenceId)
      .then((data) => {
        if (alive) {
          setSnapshot(data);
          setLoadedId(conferenceId);
        }
      })
      .catch((e) => {
        if (alive) setError(e instanceof Error ? e.message : 'Analytics could not be loaded.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [conferenceId, revision, preview]);

  // The tab lives in the URL hash so a view can be linked or reloaded.
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    const fromHash = TABS.find((item) => item.id === hash)?.id ?? LEGACY_HASH[hash];
    if (fromHash) setTab(fromHash);
  }, []);
  function openTab(next: TabId, reveal = false) {
    setTab(next);
    window.history.replaceState(null, '', `#${next}`);
    if (reveal) tabList.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  function onTabKeyDown(event: React.KeyboardEvent) {
    const index = TABS.findIndex((item) => item.id === tab);
    const next =
      event.key === 'ArrowRight'
        ? TABS[(index + 1) % TABS.length]
        : event.key === 'ArrowLeft'
          ? TABS[(index - 1 + TABS.length) % TABS.length]
          : event.key === 'Home'
            ? TABS[0]
            : event.key === 'End'
              ? TABS[TABS.length - 1]
              : undefined;
    if (!next) return;
    event.preventDefault();
    openTab(next.id);
    document.getElementById(`analytics-tab-${next.id}`)?.focus();
  }

  const currentSnapshot = loadedId === conferenceId ? snapshot : null;
  const selectedReport =
    currencyChoice.conferenceId === conferenceId
      ? currentSnapshot?.currencyReports?.find(
          (report) => report.currency === currencyChoice.currency,
        )
      : undefined;
  const overview = currentSnapshot ? { ...currentSnapshot, ...selectedReport } : null;
  const base = `/dashboard/conferences/${conferenceId}`;

  const toolbar = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="flex items-center gap-2 text-xs text-slate-500">
        {overview ? (
          <>
            <span className="relative flex size-2" aria-hidden>
              <span
                className={cn(
                  'absolute inline-flex size-full rounded-full opacity-60',
                  loading ? 'bg-amber-400 motion-safe:animate-ping' : 'bg-emerald-400',
                )}
              />
              <span
                className={cn(
                  'relative inline-flex size-2 rounded-full',
                  loading ? 'bg-amber-500' : 'bg-emerald-500',
                )}
              />
            </span>
            <span>
              Updated <LocalTime value={overview.computedAt} /> · your local time
            </span>
          </>
        ) : (
          'Conference analytics'
        )}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {overview && (
          <label className="flex items-center gap-2 text-xs text-slate-500">
            Reporting currency
            <select
              className="min-h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Reporting currency"
              value={overview.currency}
              onChange={(event) =>
                setCurrencyChoice({ conferenceId, currency: event.target.value })
              }
            >
              {(currentSnapshot?.currencyReports ?? [overview]).map((report) => (
                <option key={report.currency} value={report.currency}>
                  {report.currency === 'USD'
                    ? 'USD · US dollar'
                    : report.currency === 'INR'
                      ? 'INR · Indian rupee'
                      : report.currency}
                </option>
              ))}
            </select>
          </label>
        )}
        <Button
          variant="outline"
          size="sm"
          className="bg-white"
          disabled={loading}
          onClick={() =>
            preview
              ? setSnapshot({ ...preview, computedAt: new Date().toISOString() })
              : setRevision((n) => n + 1)
          }
        >
          <RefreshCw
            className={`mr-2 h-3.5 w-3.5 ${loading ? 'motion-safe:animate-spin' : ''}`}
            aria-hidden="true"
          />
          {loading ? 'Refreshing…' : 'Refresh analytics'}
        </Button>
      </div>
    </div>
  );

  if (!overview)
    return (
      <div className="space-y-6">
        {toolbar}
        {error ? (
          <div role="alert" className="rounded-2xl border border-rose-200 bg-white p-6">
            <p className="font-medium text-slate-900">Analytics could not be loaded</p>
            <p className="mt-1 text-sm text-slate-600">
              Refresh to try again. Counts are unavailable while loading fails.
            </p>
          </div>
        ) : (
          <div role="status" aria-label="Loading analytics" className="space-y-6">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-5">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton
                  key={i}
                  className="h-[8.5rem] rounded-2xl last:col-span-2 xl:last:col-span-1"
                />
              ))}
            </div>
            <Skeleton className="h-11 w-full max-w-xl rounded-xl" />
            <div className="grid gap-4 lg:grid-cols-12 lg:gap-5">
              <Skeleton className="h-96 rounded-2xl lg:col-span-8" />
              <Skeleton className="h-96 rounded-2xl lg:col-span-4" />
            </div>
          </div>
        )}
      </div>
    );

  const r = overview.reviews;
  const progress: ChartPoint[] = [
    { name: 'Submitted', value: r.submitted, color: chartColors.accent },
    { name: 'Draft saved', value: r.draft, color: chartColors.sky },
    { name: 'Not started', value: r.notStarted, color: chartColors.warning },
    { name: 'Closed incomplete', value: r.closedIncomplete ?? 0, color: chartColors.neutral },
    { name: 'Needs data check', value: r.inconsistent ?? 0, color: chartColors.critical },
  ];
  // A fixed order keeps each outcome's colour and position stable between refreshes.
  const decisions: ChartPoint[] = OUTCOME_ORDER.map((outcome) => ({
    name: decisionOutcomeLabel(outcome),
    value: overview.decisions.byOutcome.find((p) => p.outcome === outcome)?.count ?? 0,
    color: OUTCOME_COLOR[outcome],
  }));
  const accepted = overview.decisions.byOutcome.find((p) => p.outcome === 'ACCEPT')?.count ?? 0;
  const excluded = overview.submissions.excluded ?? { draft: 0, withdrawn: 0 };
  const money = (minor: number) => formatAnalyticsMoney(minor, overview.currency);
  const activity = activitySeries(overview.submissions.byDay).points.map((p) => p.count);
  const conversion = overview.revenueConversion;
  const tabProps = { overview, base, money };

  return (
    <div className="space-y-6" aria-busy={loading}>
      {toolbar}
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
        >
          Refresh failed. Showing the previous snapshot from{' '}
          <LocalTime value={overview.computedAt} />. Refresh to try again.
        </p>
      )}

      <section
        aria-label="Headline figures"
        className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-[repeat(4,minmax(0,1fr))_minmax(0,1.3fr)]"
      >
        <KpiTile
          label="Included papers"
          value={number(overview.submissions.total)}
          detail="Across all submitted stages"
          visual={<Sparkline values={activity} />}
          opens="Papers"
          onOpen={() => openTab('papers', true)}
        />
        <KpiTile
          delay={1}
          label="Reviews submitted"
          value={number(r.submitted)}
          suffix={`/ ${number(r.assigned)}`}
          detail="Assignments in latest cycles"
          visual={<ProgressRing value={r.assigned ? r.submitted / r.assigned : null} />}
          opens="Reviews & decisions"
          onOpen={() => openTab('reviews', true)}
        />
        <KpiTile
          delay={2}
          label="Accepted decisions"
          value={number(accepted)}
          suffix={`/ ${number(overview.decisions.total)}`}
          detail={
            overview.decisions.total
              ? `${Math.round(overview.decisions.acceptRate * 100)}% of latest decisions, including revisions`
              : 'Latest decisions, including revisions'
          }
          visual={<MiniStack data={decisions} />}
          opens="Reviews & decisions"
          onOpen={() => openTab('reviews', true)}
        />
        <KpiTile
          delay={3}
          label={`Net receipts · ${overview.currency}`}
          value={money(overview.revenueMinor)}
          detail={
            conversion
              ? `${money(conversion.capturedMinor)} captured · ${money(conversion.refundedMinor)} refunded`
              : 'Captured receipts less refunds'
          }
          opens="Finance"
          onOpen={() => openTab('finance', true)}
        />
        <div className="col-span-2 flex xl:col-span-1 [&>*]:w-full">
          <AttentionTile
            delay={4}
            items={[
              {
                value: r.overdue,
                label: 'reviews past their deadline',
                href: `${base}/reviews/rounds?queue=OVERDUE`,
                tone: 'critical',
              },
              {
                value: r.underCoveredPapers,
                label: 'papers below the review minimum',
                href: `${base}/reviews/rounds`,
                tone: 'warning',
              },
            ]}
          />
        </div>
      </section>

      <div
        ref={tabList}
        className="sticky top-0 z-20 -mx-2 scroll-mt-2 bg-slate-50/80 px-2 py-2 backdrop-blur-md"
      >
        <div
          role="tablist"
          aria-label="Analytics sections"
          onKeyDown={onTabKeyDown}
          className="inline-flex max-w-full gap-1 overflow-x-auto rounded-xl border border-slate-200/80 bg-white p-1 shadow-[0_1px_2px_rgb(15_23_42/0.04)]"
        >
          {TABS.map(({ id, label, icon: Icon }) => {
            const selected = tab === id;
            return (
              <button
                key={id}
                id={`analytics-tab-${id}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls="analytics-tabpanel"
                tabIndex={selected ? 0 : -1}
                onClick={() => openTab(id)}
                className={cn(
                  'inline-flex min-h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  selected
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                )}
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div
        id="analytics-tabpanel"
        role="tabpanel"
        aria-labelledby={`analytics-tab-${tab}`}
        tabIndex={-1}
        className="focus:outline-none"
      >
        {/* The key remounts the grid so each tab's modules animate in. */}
        {tab === 'papers' ? (
          <PapersTab key="papers" {...tabProps} />
        ) : tab === 'reviews' ? (
          <ReviewsTab
            key="reviews"
            {...tabProps}
            progress={progress}
            decisions={decisions}
            accepted={accepted}
          />
        ) : tab === 'people' ? (
          <PeopleTab key="people" {...tabProps} />
        ) : (
          <FinanceTab key="finance" {...tabProps} />
        )}
      </div>

      <div className="space-y-2 border-t border-slate-200 pt-5 text-xs">
        <p className="text-slate-600">
          <strong className="font-semibold text-slate-900">
            {number(overview.submissions.total)} included papers.
          </strong>{' '}
          {number(excluded.draft)} drafts and {number(excluded.withdrawn)} withdrawn papers excluded
          from paper metrics.
        </p>
        <details>
          <summary className="w-fit cursor-pointer rounded text-slate-600 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            How these numbers are counted
          </summary>
          <ul className="mt-3 max-w-3xl list-disc space-y-2 pl-5 leading-relaxed text-slate-600">
            <li>
              Submissions, authors, institutions, reviews, decisions and registrations exclude draft
              papers and both withdrawal statuses.
            </li>
            <li>
              Reviews and decisions use only the latest review cycle for each paper. Submitted
              reviews stay submitted while edits are pending. Overdue work is a subset of drafts and
              not-started reviews.
            </li>
            <li>
              Coverage counts papers still open for review with fewer submitted reviews than
              required. Released or decided cycles are closed.
            </li>
            <li>
              Activity uses paper creation dates in UTC. The system does not store a dedicated
              first-submission timestamp.
            </li>
            <li>
              Net receipts are captured payments minus refund records in {overview.currency},
              including money received for subsequently withdrawn papers. USD and INR are converted
              using the current INR-per-USD rate in the fee schedule. Currencies without an
              applicable rate remain visible separately.
            </li>
          </ul>
        </details>
      </div>
    </div>
  );
}

function LocalTime({ value }: { value: string }) {
  const [label, setLabel] = useState(value.replace('T', ' ').replace('.000Z', ' UTC'));
  useEffect(() => setLabel(new Date(value).toLocaleString()), [value]);
  return <time dateTime={value}>{label}</time>;
}
