'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowUpRight, RefreshCw } from 'lucide-react';
import type { ConferenceAnalyticsOverview } from '@openconferences/schemas';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchAnalyticsOverview } from '@/lib/api-client';
import { decisionOutcomeLabel } from '@/lib/review-types';
import { paperStatusLabel } from '@/lib/submission-types';
import { formatAnalyticsMoney } from '@/lib/analytics';
import {
  CategoryChart,
  EmptyChart,
  ReviewProgressChart,
  SubmissionTrend,
  chartColors,
  type ChartPoint,
} from './analytics/analytics-charts';
const number = (n: number) => n.toLocaleString();
const words = (s: string) =>
  s
    .toLowerCase()
    .split('_')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');
const sections = [
  ['review-health', 'Review health'],
  ['submission-activity', 'Submissions & decisions'],
  ['participation', 'People & institutions'],
  ['registration-finance', 'Registration & finances'],
];
export function AnalyticsOverview({ conferenceId }: { conferenceId: string }) {
  const [snapshot, setSnapshot] = useState<ConferenceAnalyticsOverview | null>(null),
    [loadedId, setLoadedId] = useState(''),
    [loading, setLoading] = useState(true),
    [error, setError] = useState<string | null>(null),
    [revision, setRevision] = useState(0);
  useEffect(() => {
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
  }, [conferenceId, revision]);
  const overview = loadedId === conferenceId ? snapshot : null;
  const base = `/dashboard/conferences/${conferenceId}`;
  const toolbar = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-slate-600">
        {overview
          ? `Updated ${new Date(overview.computedAt).toLocaleString()} · your local time`
          : 'Conference analytics'}
      </p>
      <Button
        variant="outline"
        size="sm"
        disabled={loading}
        onClick={() => setRevision((n) => n + 1)}
      >
        <RefreshCw
          className={`mr-2 h-3.5 w-3.5 ${loading ? 'motion-safe:animate-spin' : ''}`}
          aria-hidden="true"
        />
        {loading ? 'Refreshing…' : 'Refresh analytics'}
      </Button>
    </div>
  );
  if (!overview)
    return (
      <div className="space-y-5">
        {toolbar}
        {error ? (
          <div role="alert" className="rounded-xl border border-rose-200 bg-white p-5">
            <p className="font-medium text-slate-900">Analytics could not be loaded</p>
            <p className="mt-1 text-sm text-slate-600">
              Refresh to try again. Counts are unavailable while loading fails.
            </p>
          </div>
        ) : (
          <div role="status" aria-label="Loading analytics" className="space-y-5">
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        )}
      </div>
    );
  const r = overview.reviews;
  const progress: ChartPoint[] = [
    { name: 'Submitted', value: r.submitted, color: chartColors.teal },
    { name: 'Draft saved', value: r.draft, color: chartColors.indigo },
    { name: 'Not started', value: r.notStarted, color: chartColors.amber },
    { name: 'Closed incomplete', value: r.closedIncomplete ?? 0, color: chartColors.slate },
    { name: 'Needs data check', value: r.inconsistent ?? 0, color: chartColors.rose },
  ];
  const statuses = overview.submissions.byStatus.map((p) => ({
    name: paperStatusLabel(p.status),
    value: p.count,
    color: p.status === 'UNDER_REVIEW' ? chartColors.indigo : chartColors.slate,
  }));
  const decisions = overview.decisions.byOutcome.map((p) => ({
    name: decisionOutcomeLabel(p.outcome),
    value: p.count,
    color:
      p.outcome === 'ACCEPT'
        ? chartColors.teal
        : p.outcome === 'REJECT'
          ? chartColors.rose
          : chartColors.amber,
  }));
  const accepted = overview.decisions.byOutcome.find((p) => p.outcome === 'ACCEPT')?.count ?? 0;
  const excluded = overview.submissions.excluded ?? { draft: 0, withdrawn: 0 };
  const money = (minor: number) => formatAnalyticsMoney(minor, overview.currency);
  return (
    <div className="space-y-7" aria-busy={loading}>
      {toolbar}
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
        >
          Refresh failed. Showing the previous snapshot from{' '}
          {new Date(overview.computedAt).toLocaleString()}. Refresh to try again.
        </p>
      )}
      <div className="space-y-3 rounded-xl border border-slate-200 bg-white px-5 py-4">
        <p className="text-sm text-slate-700">
          <strong className="font-semibold text-slate-900">
            {number(overview.submissions.total)} included papers.
          </strong>{' '}
          {number(excluded.draft)} drafts and {number(excluded.withdrawn)} withdrawn papers excluded
          from paper metrics.
        </p>
        <details className="text-sm">
          <summary className="w-fit cursor-pointer rounded-sm text-slate-600 underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-indigo-600">
            How these numbers are counted
          </summary>
          <ul className="mt-3 max-w-3xl list-disc space-y-2 pl-5 text-slate-600">
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
              including money received for subsequently withdrawn papers. Other currencies are never
              added together.
            </li>
          </ul>
        </details>
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-5 border-y border-slate-200 py-5 xl:grid-cols-4">
        <Summary
          label="Included papers"
          value={number(overview.submissions.total)}
          detail="Across all submitted stages"
        />
        <Summary
          label="Reviews submitted"
          value={`${number(r.submitted)} / ${number(r.assigned)}`}
          detail="Assignments in latest cycles"
        />
        <Summary
          label="Accepted decisions"
          value={`${number(accepted)} / ${number(overview.decisions.total)}`}
          detail="Latest decisions, including revisions"
        />
        <Summary
          label={`Net receipts · ${overview.currency}`}
          value={money(overview.revenueMinor)}
          detail="Captured receipts less refunds"
        />
      </dl>
      <nav aria-label="Analytics sections" className="flex flex-wrap gap-x-5 gap-y-3 text-sm">
        {sections.map(([id, label]) => (
          <a
            key={id}
            href={`#${id}`}
            className="rounded-sm text-slate-600 underline decoration-slate-300 underline-offset-4 hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
          >
            {label}
          </a>
        ))}
      </nav>
      <section
        id="review-health"
        className="scroll-mt-8 space-y-4"
        aria-labelledby="review-health-heading"
      >
        <SectionHeading
          id="review-health-heading"
          title="Review health"
          description="One current cycle per paper. See progress and where your attention is needed."
        />
        <div className="grid gap-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
          <div className="min-w-0 space-y-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-base font-semibold text-slate-900">Review progress</h3>
              <p className="text-sm text-slate-600">{number(r.assigned)} assignments</p>
            </div>
            <ReviewProgressChart data={progress} total={r.assigned} />
            <p className="text-xs leading-relaxed text-slate-600">
              Each assignment appears in one segment. Overdue reviews are included within draft or
              not-started work.
            </p>
          </div>
          <div className="min-w-0 space-y-4 border-t border-slate-200 pt-5 xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0">
            <h3 className="text-base font-semibold text-slate-900">Needs attention</h3>
            <Attention
              value={r.overdue}
              label="reviews past their deadline"
              href={`${base}/reviews/rounds?queue=OVERDUE`}
              color="text-rose-700"
            />
            <Attention
              value={r.underCoveredPapers}
              label="papers below the submitted-review minimum"
              href={`${base}/reviews/rounds`}
              color="text-amber-800"
            />
            {r.inconsistent > 0 && (
              <p className="text-xs text-rose-700">
                {number(r.inconsistent)} completed assignments have no submitted review. Check the
                paper ledger.
              </p>
            )}
            <Link
              href={`${base}/reviews/reviewers`}
              className="inline-flex min-h-10 items-center gap-2 text-sm font-medium text-indigo-700 underline underline-offset-4"
            >
              Open reviewer overview
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
      <section
        id="submission-activity"
        className="scroll-mt-8 space-y-4"
        aria-labelledby="submission-heading"
      >
        <SectionHeading
          id="submission-heading"
          title="Submissions & decisions"
          description="Understand the paper pipeline without mixing paper counts with review or payment counts."
        />
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <Panel
            title="Paper activity"
            description="Creation dates of currently included papers; not submission timestamps."
          >
            <SubmissionTrend data={overview.submissions.byDay} />
          </Panel>
          <Panel
            title="Submissions by status"
            description={`${number(overview.submissions.total)} included papers. Drafts and withdrawals excluded.`}
          >
            <CategoryChart data={statuses} />
          </Panel>
        </div>
        <Panel
          title="Decision outcomes"
          description={`${number(overview.decisions.total)} latest-cycle decisions. Revision outcomes count as decisions, not acceptances.`}
        >
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <CategoryChart
              data={decisions}
              unit="decisions"
              empty="No decisions in the latest cycles yet."
            />
            <div className="flex flex-col justify-center border-t border-slate-200 pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
              <p className="text-base font-semibold text-slate-900">
                {overview.decisions.total
                  ? `${Math.round(overview.decisions.acceptRate * 100)}% acceptance share`
                  : 'Acceptance share unavailable'}
              </p>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-600">
                {overview.decisions.total
                  ? `${number(accepted)} accepted out of ${number(overview.decisions.total)} current decisions. Papers without a current decision are not in this denominator.`
                  : 'An acceptance share will appear after a decision is recorded in a current cycle.'}
              </p>
              <Link
                href={`${base}/reviews/decisions`}
                className="mt-3 inline-flex min-h-10 items-center gap-2 text-sm font-medium text-indigo-700 underline underline-offset-4"
              >
                Open decisions
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </Panel>
      </section>
      <section
        id="participation"
        className="scroll-mt-8 space-y-4"
        aria-labelledby="participation-heading"
      >
        <SectionHeading
          id="participation-heading"
          title="People & institutions"
          description="Follow reviewer workload and the people contributing included papers."
        />
        <div className="grid items-start gap-5 lg:grid-cols-2">
          <Panel
            title="Outstanding reviewer workload"
            description="Top 12 reviewers by unfinished assignments in open, current cycles. Each reviewer is counted separately."
          >
            <CategoryChart
              data={r.reviewerLoad.map((p) => ({ name: p.name, id: p.id, value: p.count }))}
              unit="outstanding assignments"
              empty="No outstanding review assignments."
            />
          </Panel>
          <Panel
            title="Institutions"
            description="Top 12 affiliations by distinct paper. A paper may have more than one institution; blank affiliations are Unspecified."
          >
            <CategoryChart
              data={overview.institutions.map((p) => ({
                name: p.name,
                value: p.count,
                color: chartColors.teal,
              }))}
            />
          </Panel>
        </div>
        <Panel
          title="Corresponding authors"
          description={`${number(overview.authors.length)} authors, grouped by email. Distinct paper IDs count once; co-authors are not listed.`}
        >
          <AuthorList authors={overview.authors} />
        </Panel>
      </section>
      <section
        id="registration-finance"
        className="scroll-mt-8 space-y-4"
        aria-labelledby="finance-heading"
      >
        <SectionHeading
          id="finance-heading"
          title="Registration & finances"
          description="Registration workload follows included papers. Financial receipts retain the full conference payment history."
        />
        <div className="grid gap-5 lg:grid-cols-2">
          <Panel
            title="Registration status"
            description={`${number(overview.registrations.total)} records for included papers. Cancelled, refunded and discarded records are not unpaid work.`}
          >
            <CategoryChart
              data={overview.registrations.byStatus.map((p) => ({
                name: words(p.status),
                value: p.count,
                color: p.status === 'PAID' ? chartColors.teal : chartColors.slate,
              }))}
              unit="registrations"
              empty="No registrations for included papers."
            />
          </Panel>
          <Panel
            title="Registration follow-up"
            description="Unpaid work includes pending payment, verification and additional-payment requests."
          >
            <dl className="divide-y divide-slate-100">
              {[
                [overview.registrations.unpaid, 'Unpaid / awaiting verification'],
                [overview.registrations.overdue ?? 0, 'Past the registration deadline'],
                [overview.registrations.atRisk, 'Due within the next 7 days'],
                [overview.unpaidAccepted, 'Accepted papers without paid registration'],
              ].map(([n, label]) => (
                <div key={String(label)} className="flex justify-between gap-4 py-3 first:pt-0">
                  <dt className="max-w-xs text-sm text-slate-700">{label}</dt>
                  <dd className="font-semibold tabular-nums text-slate-900">{number(Number(n))}</dd>
                </div>
              ))}
            </dl>
            <Link
              href={`${base}/registrations`}
              className="mt-3 inline-flex min-h-10 items-center gap-2 text-sm font-medium text-indigo-700 underline underline-offset-4"
            >
              Open registrations
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Panel>
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <Panel
            title="Net receipts by fee timing"
            description={`Actual receipts less refunds, in ${overview.currency}. Unspecified timing is kept separate.`}
          >
            <CategoryChart
              data={overview.revenueByTiming.map((p) => ({
                name: words(p.name),
                value: p.amountMinor,
                color: chartColors.teal,
              }))}
              unit={overview.currency}
              money={money}
              empty="No net receipts in this currency."
            />
          </Panel>
          <Panel
            title="Net receipts by audience"
            description={`The same ${overview.currency} receipts, grouped by registration audience.`}
          >
            <CategoryChart
              data={overview.revenueByAudience.map((p) => ({
                name: words(p.name),
                value: p.amountMinor,
                color: chartColors.teal,
              }))}
              unit={overview.currency}
              money={money}
              empty="No net receipts in this currency."
            />
          </Panel>
        </div>
        {overview.excludedCurrencyPayments > 0 && (
          <p className="text-sm text-amber-800">
            {number(overview.excludedCurrencyPayments)} payment records in other currencies are
            excluded from these totals. No currency conversion is applied.
          </p>
        )}
      </section>
    </div>
  );
}
function Summary({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-sm text-slate-600">{label}</dt>
      <dd className="mt-1 break-words text-xl font-semibold tabular-nums tracking-tight text-slate-900 sm:text-2xl">
        {value}
      </dd>
      <p className="mt-1 text-xs leading-relaxed text-slate-600">{detail}</p>
    </div>
  );
}
function SectionHeading({
  id,
  title,
  description,
}: {
  id: string;
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-1">
      <h2 id={id} className="text-lg font-semibold tracking-tight text-slate-900">
        {title}
      </h2>
      <p className="max-w-3xl text-sm text-slate-600">{description}</p>
    </div>
  );
}
function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <p className="mb-5 mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">{description}</p>
      {children}
    </section>
  );
}
function Attention({
  value,
  label,
  href,
  color,
}: {
  value: number;
  label: string;
  href: string;
  color: string;
}) {
  return (
    <Link
      href={href}
      className="group flex min-h-11 items-center justify-between gap-4 rounded-md py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
    >
      <span className="text-sm text-slate-700">
        <strong className={`mr-2 text-lg tabular-nums ${color}`}>{number(value)}</strong> {label}
      </span>
      <ArrowUpRight
        className="h-4 w-4 shrink-0 text-slate-500 group-hover:text-indigo-700"
        aria-hidden="true"
      />
    </Link>
  );
}
function AuthorList({ authors }: { authors: ConferenceAnalyticsOverview['authors'] }) {
  const [search, setSearch] = useState(''),
    [page, setPage] = useState(1);
  const filtered = useMemo(
    () =>
      authors.filter((a) => a.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())),
    [authors, search],
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 10)),
    current = Math.min(page, pages);
  if (!authors.length)
    return <EmptyChart>No corresponding authors for included papers.</EmptyChart>;
  return (
    <div className="space-y-4">
      <label className="block max-w-sm space-y-1 text-sm text-slate-700">
        <span>Find a corresponding author</span>
        <input
          type="search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search author name"
          className="min-h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm placeholder:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
        />
      </label>
      <table className="w-full text-sm">
        <caption className="sr-only">Corresponding authors and distinct included papers</caption>
        <thead className="border-b border-slate-200 text-slate-600">
          <tr>
            <th scope="col" className="py-2 text-left font-medium">
              Corresponding author
            </th>
            <th scope="col" className="py-2 text-right font-medium">
              Papers
            </th>
          </tr>
        </thead>
        <tbody>
          {filtered.slice((current - 1) * 10, current * 10).map((a, i) => (
            <tr key={`${a.name}-${i}`} className="border-b border-slate-100">
              <th
                scope="row"
                className="break-words py-3 pr-3 text-left font-normal text-slate-700"
              >
                {a.name}
              </th>
              <td className="py-3 text-right font-medium tabular-nums text-slate-900">
                {number(a.count)}
              </td>
            </tr>
          ))}
          {!filtered.length && (
            <tr>
              <td colSpan={2} className="py-6 text-slate-600">
                No matching authors. Clear the search to see everyone.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <p className="text-slate-600">
          {number(filtered.length)} of {number(authors.length)} authors · Page {current} of {pages}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={current === 1}
            onClick={() => setPage(current - 1)}
          >
            Previous authors
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={current === pages}
            onClick={() => setPage(current + 1)}
          >
            Next authors
          </Button>
        </div>
      </div>
    </div>
  );
}
