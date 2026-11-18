'use client';

import { useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Search } from 'lucide-react';
import type { ConferenceAnalyticsOverview } from '@openconferences/schemas';
import { Button } from '@/components/ui/button';
import { formatAnalyticsMoney, formatAnalyticsNumber } from '@/lib/analytics';
import { paperStatusLabel } from '@/lib/submission-types';
import {
  chartColors,
  CsvButton,
  downloadCsv,
  EmptyChart,
  ModuleCard,
  StatTile,
  type ChartPoint,
} from './analytics-card';
import { PipelineCard, RankedBarsCard, StackedBar, SubmissionTrendCard } from './analytics-charts';

const number = formatAnalyticsNumber;
const words = (s: string) =>
  s
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

export type TabProps = {
  overview: ConferenceAnalyticsOverview;
  base: string;
  money: (minor: number) => string;
};

const GRID = 'grid gap-4 lg:grid-cols-12 lg:gap-5';

function ModuleLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 rounded text-xs font-medium text-indigo-700 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {children}
      <ArrowUpRight className="size-3.5" aria-hidden />
    </Link>
  );
}

export function PapersTab({ overview, base }: TabProps) {
  const statuses = overview.submissions.byStatus.map((p) => ({
    name: paperStatusLabel(p.status),
    value: p.count,
  }));
  return (
    <div className={GRID}>
      <SubmissionTrendCard
        className="lg:col-span-8"
        title="Paper activity"
        subtitle="When currently included papers were created"
        info="Creation dates of currently included papers, in UTC; not submission timestamps. The summary, table and export all cover the selected date range."
        data={overview.submissions.byDay}
      />
      <PipelineCard
        className="lg:col-span-4"
        delay={1}
        title="Submissions by status"
        subtitle={`${number(overview.submissions.total)} included papers`}
        info="A snapshot of each paper’s current stage. Draft and withdrawn papers are excluded."
        data={statuses}
        empty="No included papers yet."
        footer={<ModuleLink href={`${base}/submissions`}>Open submissions</ModuleLink>}
      />
    </div>
  );
}

export function ReviewsTab({
  overview,
  base,
  progress,
  decisions,
  accepted,
}: TabProps & { progress: ChartPoint[]; decisions: ChartPoint[]; accepted: number }) {
  const r = overview.reviews;
  const d = overview.decisions;
  return (
    <div className={GRID}>
      <ModuleCard
        className="lg:col-span-8"
        title="Review progress"
        subtitle={`${number(r.assigned)} assignments in the latest cycles`}
        info="Each assignment appears in one segment. Overdue reviews are included within draft or not-started work. Submitted reviews stay submitted while edits are pending."
        actions={
          <CsvButton
            title="Review progress"
            disabled={!r.assigned}
            onExport={() =>
              downloadCsv('review-progress.csv', [
                ['State', 'Assignments'],
                ...progress.map((p) => [p.name, p.value]),
              ])
            }
          />
        }
      >
        {r.assigned ? (
          <StackedBar data={progress} total={r.assigned} label="Assignments by state" />
        ) : (
          <EmptyChart>No review assignments in the latest cycles yet.</EmptyChart>
        )}
      </ModuleCard>
      <ModuleCard
        className="lg:col-span-4"
        delay={1}
        title="Review follow-up"
        subtitle="Work that is late or short of reviews"
        info="Coverage counts papers still open for review with fewer submitted reviews than required. Released or decided cycles are closed."
        footer={
          <>
            <ModuleLink href={`${base}/reviews/rounds?queue=OVERDUE`}>Review queue</ModuleLink>
            <ModuleLink href={`${base}/reviews/reviewers`}>Open reviewer overview</ModuleLink>
          </>
        }
      >
        <dl className="grid grid-cols-2 gap-3">
          <StatTile
            label="Reviews past their deadline"
            value={number(r.overdue)}
            tone={r.overdue ? 'critical' : 'neutral'}
          />
          <StatTile
            label="Papers below the review minimum"
            value={number(r.underCoveredPapers)}
            tone={r.underCoveredPapers ? 'warning' : 'neutral'}
          />
        </dl>
        {r.inconsistent > 0 && (
          <p className="mt-3 rounded-xl bg-rose-50 p-3 text-xs leading-relaxed text-rose-800">
            {number(r.inconsistent)} completed assignments have no submitted review. Check the paper
            ledger.
          </p>
        )}
      </ModuleCard>
      <ModuleCard
        className="lg:col-span-12"
        delay={2}
        title="Decision outcomes"
        subtitle={`${number(d.total)} decisions in the latest cycles`}
        info="Latest-cycle decisions only. Revision outcomes count as decisions, not acceptances. Papers without a current decision are not in the acceptance denominator."
        actions={
          <CsvButton
            title="Decision outcomes"
            disabled={!d.total}
            onExport={() =>
              downloadCsv('decision-outcomes.csv', [
                ['Outcome', 'Decisions'],
                ...decisions.map((p) => [p.name, p.value]),
              ])
            }
          />
        }
        footer={<ModuleLink href={`${base}/reviews/decisions`}>Open decisions</ModuleLink>}
      >
        <div className="grid gap-6 lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] lg:gap-8">
          <div>
            {d.total ? (
              <p className="text-slate-900">
                <span className="text-4xl font-semibold tabular-nums tracking-tight">
                  {Math.round(d.acceptRate * 100)}%
                </span>{' '}
                <span className="text-sm font-medium">acceptance share</span>
              </p>
            ) : (
              <p className="text-base font-semibold text-slate-900">Acceptance share unavailable</p>
            )}
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              {d.total
                ? `${number(accepted)} accepted out of ${number(d.total)} current decisions.`
                : 'An acceptance share will appear after a decision is recorded in a current cycle.'}
            </p>
          </div>
          {d.total ? (
            <StackedBar
              data={decisions}
              total={d.total}
              label="Decisions by outcome"
              columns="grid-cols-2 sm:grid-cols-4"
            />
          ) : (
            <EmptyChart>No decisions in the latest cycles yet.</EmptyChart>
          )}
        </div>
      </ModuleCard>
    </div>
  );
}

export function PeopleTab({ overview }: TabProps) {
  return (
    <div className={GRID}>
      <RankedBarsCard
        className="lg:col-span-7"
        title="Outstanding reviewer workload"
        subtitle="Unfinished assignments in open, current cycles"
        info="Top 12 reviewers by unfinished assignments in open, current cycles. Each reviewer is counted separately."
        expandable
        data={overview.reviews.reviewerLoad.map((p) => ({
          name: p.name,
          id: p.id,
          value: p.count,
        }))}
        unit="outstanding assignments"
        empty="No outstanding review assignments."
      />
      <AuthorsCard authors={overview.authors} />
      <RankedBarsCard
        className="lg:col-span-7"
        delay={2}
        title="Institutions"
        subtitle="Affiliations by distinct paper"
        info="Top 12 affiliations by distinct paper. A paper may have more than one institution; blank affiliations are Unspecified."
        expandable
        data={overview.institutions.map((p) => ({ name: p.name, value: p.count }))}
        empty="No institutions for included papers."
      />
    </div>
  );
}

function AuthorsCard({ authors }: { authors: ConferenceAnalyticsOverview['authors'] }) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const filtered = useMemo(
    () =>
      authors.filter((a) => a.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())),
    [authors, search],
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 10));
  const current = Math.min(page, pages);
  return (
    <ModuleCard
      className="lg:col-span-5 lg:row-span-2"
      delay={1}
      title="Corresponding authors"
      subtitle={`${number(authors.length)} authors, grouped by email`}
      info="Distinct paper IDs count once per author. Co-authors are not listed."
      actions={
        <CsvButton
          title="Corresponding authors"
          disabled={!authors.length}
          onExport={() =>
            downloadCsv('corresponding-authors.csv', [
              ['Corresponding author', 'Papers'],
              ...authors.map((a) => [a.name, a.count]),
            ])
          }
        />
      }
      footer={
        authors.length ? (
          <>
            <span>
              {number(filtered.length)} of {number(authors.length)} authors · Page {current} of{' '}
              {pages}
            </span>
            <span className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={current === 1}
                onClick={() => setPage(current - 1)}
                aria-label="Previous authors"
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={current === pages}
                onClick={() => setPage(current + 1)}
                aria-label="Next authors"
              >
                Next
              </Button>
            </span>
          </>
        ) : undefined
      }
    >
      {!authors.length ? (
        <EmptyChart>No corresponding authors for included papers.</EmptyChart>
      ) : (
        <div className="space-y-3">
          <label className="relative block">
            <span className="sr-only">Find a corresponding author</span>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search author name"
              className="min-h-10 w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-9 pr-3 text-sm placeholder:text-slate-500 focus-visible:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          <table className="w-full text-sm">
            <caption className="sr-only">
              Corresponding authors and distinct included papers
            </caption>
            <thead className="text-xs text-slate-500">
              <tr>
                <th scope="col" className="pb-2 text-left font-medium">
                  Corresponding author
                </th>
                <th scope="col" className="pb-2 text-right font-medium">
                  Papers
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice((current - 1) * 10, current * 10).map((a, i) => (
                <tr
                  key={`${a.name}-${i}`}
                  className="border-t border-slate-100 transition-colors hover:bg-slate-50/70"
                >
                  <th
                    scope="row"
                    className="break-words py-2.5 pr-3 text-left font-normal text-slate-700"
                  >
                    {a.name}
                  </th>
                  <td className="py-2.5 text-right font-semibold tabular-nums text-slate-900">
                    {number(a.count)}
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td colSpan={2} className="border-t border-slate-100 py-6 text-slate-600">
                    No matching authors. Clear the search to see everyone.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </ModuleCard>
  );
}

export function FinanceTab({ overview, base, money }: TabProps) {
  const reg = overview.registrations;
  const conversion = overview.revenueConversion;
  const currency = overview.currency;
  return (
    <div className={GRID}>
      <RankedBarsCard
        className="lg:col-span-5"
        title="Registration status"
        subtitle={`${number(reg.total)} records for included papers`}
        info="Registration workload follows included papers. Cancelled, refunded and discarded records are not unpaid work."
        data={reg.byStatus.map((p) => ({
          name: words(p.status),
          value: p.count,
          color: p.status === 'PAID' ? chartColors.good : '#94a3b8',
        }))}
        unit="registrations"
        empty="No registrations for included papers."
      />
      <ModuleCard
        className="lg:col-span-7"
        delay={1}
        title="Registration follow-up"
        subtitle="Unpaid and at-risk registrations"
        info="Unpaid work includes pending payment and additional-payment requests. Student registrations that are paid and awaiting approval are not counted."
        footer={<ModuleLink href={`${base}/registrations`}>Open registrations</ModuleLink>}
      >
        <dl className="grid grid-cols-2 gap-3">
          <StatTile
            label="Unpaid"
            href={`${base}/registrations/all?status=unpaid`}
            value={number(reg.unpaid)}
          />
          <StatTile
            label="Past the registration deadline"
            href={`${base}/registrations/all?status=overdue`}
            value={number(reg.overdue ?? 0)}
            tone={reg.overdue ? 'critical' : 'neutral'}
          />
          <StatTile
            label="Due within the next 7 days"
            href={`${base}/registrations/all?status=at-risk`}
            value={number(reg.atRisk)}
            tone={reg.atRisk ? 'warning' : 'neutral'}
          />
          <StatTile
            label="Accepted papers without paid registration"
            value={number(overview.unpaidAccepted)}
            tone={overview.unpaidAccepted ? 'warning' : 'neutral'}
          />
        </dl>
      </ModuleCard>
      {conversion && (
        <ModuleCard
          className="lg:col-span-12"
          delay={2}
          title="Payments across currencies"
          subtitle={
            conversion.inrPerUsd ? (
              <>
                1 USD ={' '}
                <strong className="font-semibold tabular-nums text-slate-700">
                  {number(conversion.inrPerUsd)}
                </strong>{' '}
                INR · Current fee-schedule rate
              </>
            ) : (
              'No USD / INR conversion rate configured in the fee schedule.'
            )
          }
          info={`All captured receipts and successful refunds, reported in ${currency}. Captured and refunded amounts stay in their original currencies. Converted totals use the current fee-schedule rate, rounded per transaction to the nearest minor unit; changing that rate changes this report. Payment records keep their original amounts.`}
          actions={
            <CsvButton
              title="Payments across currencies"
              disabled={!conversion.byCurrency.length}
              onExport={() =>
                downloadCsv('payments-by-currency.csv', [
                  [
                    'Original currency',
                    'Ledger records',
                    'Captured',
                    'Refunded',
                    `Net in ${currency}`,
                  ],
                  ...conversion.byCurrency.map((row) => [
                    row.currency,
                    row.paymentCount,
                    (row.capturedMinor / 100).toFixed(2),
                    (row.refundedMinor / 100).toFixed(2),
                    row.convertedMinor === null ? '' : (row.convertedMinor / 100).toFixed(2),
                  ]),
                ])
              }
            />
          }
        >
          <dl className="grid gap-3 sm:grid-cols-3">
            {[
              [
                `Captured · ${currency}`,
                money(conversion.capturedMinor),
                'Includes converted receipts',
              ],
              [
                `Refunded · ${currency}`,
                money(conversion.refundedMinor),
                'Successful refund records',
              ],
              [
                `Net receipts · ${currency}`,
                money(overview.revenueMinor),
                'Captured less refunded',
              ],
            ].map(([label, value, detail], index) => (
              <div
                key={label}
                className={
                  index === 2
                    ? 'rounded-xl bg-indigo-50/70 p-4 ring-1 ring-inset ring-indigo-100'
                    : 'rounded-xl bg-slate-50 p-4'
                }
              >
                <dt className="text-xs text-slate-600">{label}</dt>
                <dd className="mt-1 break-words text-2xl font-semibold tabular-nums tracking-tight text-slate-900">
                  {value}
                </dd>
                <p className="mt-1 text-xs text-slate-500">{detail}</p>
              </div>
            ))}
          </dl>
          <div className="mt-5">
            {conversion.byCurrency.length ? (
              <>
                <p className="mb-2 text-xs text-slate-500 sm:hidden">
                  Scroll the breakdown to see refunds and converted totals.
                </p>
                <div
                  className="overflow-x-auto rounded-xl border border-slate-100"
                  tabIndex={0}
                  role="region"
                  aria-label="Currency breakdown, scroll for all amounts"
                >
                  <table className="w-full min-w-[470px] text-sm">
                    <caption className="sr-only">
                      Captured payments and refunds by original currency
                    </caption>
                    <thead className="bg-slate-50 text-xs text-slate-600">
                      <tr>
                        <th scope="col" className="px-4 py-2.5 text-left font-medium">
                          Original currency
                        </th>
                        <th scope="col" className="px-4 py-2.5 text-right font-medium">
                          Captured
                        </th>
                        <th scope="col" className="px-4 py-2.5 text-right font-medium">
                          Refunded
                        </th>
                        <th scope="col" className="px-4 py-2.5 text-right font-medium">
                          Net in {currency}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {conversion.byCurrency.map((row) => (
                        <tr key={row.currency} className="border-t border-slate-100">
                          <th scope="row" className="px-4 py-3 text-left font-medium">
                            {row.currency}
                            <span className="mt-0.5 block text-xs font-normal text-slate-500">
                              {number(row.paymentCount)} ledger records
                            </span>
                          </th>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {formatAnalyticsMoney(row.capturedMinor, row.currency)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {formatAnalyticsMoney(row.refundedMinor, row.currency)}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold tabular-nums">
                            {row.convertedMinor === null ? (
                              <span className="font-medium text-amber-800">Rate unavailable</span>
                            ) : (
                              money(row.convertedMinor)
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <EmptyChart>No captured payments or successful refunds yet.</EmptyChart>
            )}
          </div>
        </ModuleCard>
      )}
      <RankedBarsCard
        className="lg:col-span-6"
        delay={3}
        title="Net receipts by fee timing"
        subtitle={`Receipts less refunds, in ${currency}`}
        info={`Actual receipts less refunds, in ${currency}. Unspecified timing is kept separate.`}
        data={overview.revenueByTiming.map((p) => ({ name: words(p.name), value: p.amountMinor }))}
        unit={currency}
        money={money}
        currency={currency}
        empty="No net receipts in this currency."
      />
      <RankedBarsCard
        className="lg:col-span-6"
        delay={4}
        title="Net receipts by audience"
        subtitle={`The same ${currency} receipts, grouped by registration audience.`}
        data={overview.revenueByAudience.map((p) => ({
          name: words(p.name),
          value: p.amountMinor,
        }))}
        unit={currency}
        money={money}
        currency={currency}
        empty="No net receipts in this currency."
      />
      {overview.excludedCurrencyPayments > 0 && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 lg:col-span-12">
          {number(overview.excludedCurrencyPayments)} payment or refund records are visible in the
          currency breakdown but excluded from converted totals because no applicable fee-schedule
          rate is available.
        </p>
      )}
    </div>
  );
}
