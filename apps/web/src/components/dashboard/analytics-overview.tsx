'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchAnalyticsOverview } from '@/lib/api-client';
import { decisionOutcomeLabel } from '@/lib/review-types';
import { paperStatusLabel } from '@/lib/submission-types';

type AnalyticsOverviewProps = {
  conferenceId: string;
};

type CountPoint = { name: string; count: number };
type MoneyPoint = { name: string; amountMinor: number };

function formatMoney(minor: number, currency: string): string {
  return `${(minor / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })} ${currency}`;
}

function words(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function shortDate(value: string): string {
  const [year, month, day] = value.split('-');
  if (!year || !month || !day) return value;
  return `${month}/${day}`;
}

type AnalyticsOverviewData = NonNullable<Awaited<ReturnType<typeof fetchAnalyticsOverview>>>;

function asList<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function normalizeOverview(data: AnalyticsOverviewData): AnalyticsOverviewData {
  return {
    ...data,
    submissions: {
      total: data.submissions?.total ?? 0,
      byStatus: asList(data.submissions?.byStatus),
      byDay: asList(data.submissions?.byDay),
    },
    reviews: {
      assigned: data.reviews?.assigned ?? 0,
      completed: data.reviews?.completed ?? 0,
      notStarted: data.reviews?.notStarted ?? 0,
      draft: data.reviews?.draft ?? 0,
      submitted: data.reviews?.submitted ?? 0,
      overdue: data.reviews?.overdue ?? 0,
      underCoveredPapers: data.reviews?.underCoveredPapers ?? 0,
      reviewerLoad: asList(data.reviews?.reviewerLoad),
    },
    decisions: {
      total: data.decisions?.total ?? 0,
      acceptRate: data.decisions?.acceptRate ?? 0,
      byOutcome: asList(data.decisions?.byOutcome),
    },
    registrations: {
      total: data.registrations?.total ?? 0,
      paid: data.registrations?.paid ?? 0,
      unpaid: data.registrations?.unpaid ?? 0,
      atRisk: data.registrations?.atRisk ?? 0,
      byStatus: asList(data.registrations?.byStatus),
    },
    revenueByTiming: asList(data.revenueByTiming),
    revenueByAudience: asList(data.revenueByAudience),
    unpaidAccepted: data.unpaidAccepted ?? 0,
    authors: asList(data.authors),
    institutions: asList(data.institutions),
  };
}

export function AnalyticsOverview({ conferenceId }: AnalyticsOverviewProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [overview, setOverview] = useState<Awaited<
    ReturnType<typeof fetchAnalyticsOverview>
  > | null>(null);

  const load = useCallback(async () => {
    const data = await fetchAnalyticsOverview(conferenceId);
    setOverview(normalizeOverview(data));
    setError(null);
  }, [conferenceId]);

  useEffect(() => {
    setLoading(true);
    load()
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load analytics'))
      .finally(() => setLoading(false));
  }, [load]);

  const chartData = useMemo(() => {
    if (!overview) return [];
    return [
      { stage: 'Submissions', count: overview.submissions.total },
      { stage: 'Reviews completed', count: overview.reviews.completed },
      { stage: 'Decisions', count: overview.decisions.total },
      { stage: 'Paid registrations', count: overview.registrations.paid },
    ];
  }, [overview]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-72 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Conference funnel</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-rose-600">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!overview) return null;

  const acceptPercent = Math.round(overview.decisions.acceptRate * 100);
  const statusData = overview.submissions.byStatus.map((row) => ({
    name: paperStatusLabel(row.status),
    count: row.count,
  }));
  const outcomeData = overview.decisions.byOutcome.map((row) => ({
    name: decisionOutcomeLabel(row.outcome),
    count: row.count,
  }));
  const reviewProgress: CountPoint[] = [
    { name: 'Not started', count: overview.reviews.notStarted },
    { name: 'Draft', count: overview.reviews.draft },
    { name: 'Submitted', count: overview.reviews.submitted },
    { name: 'Overdue', count: overview.reviews.overdue },
  ];
  const dayData = overview.submissions.byDay.map((row) => ({
    name: shortDate(row.date),
    count: row.count,
  }));
  const registrationData = overview.registrations.byStatus.map((row) => ({
    name: words(row.status),
    count: row.count,
  }));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Conference funnel</CardTitle>
          <CardDescription>
            Counts at each stage. Updated {new Date(overview.computedAt).toLocaleString()}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CountChart data={chartData.map((row) => ({ name: row.stage, count: row.count }))} />
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Submissions" value={overview.submissions.total} />
        <MetricCard
          label="Reviews"
          value={`${overview.reviews.completed}/${overview.reviews.assigned}`}
          hint={`${overview.reviews.overdue} overdue · ${overview.reviews.underCoveredPapers} papers below the minimum`}
        />
        <MetricCard
          label="Accept rate"
          value={`${acceptPercent}%`}
          hint={`${overview.decisions.total} decisions`}
        />
        <MetricCard
          label="Revenue"
          value={formatMoney(overview.revenueMinor, overview.currency)}
          hint={`${overview.registrations.paid} paid registrations`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Submissions by status" description="Includes drafts.">
          <CountChart data={statusData} />
        </ChartCard>
        <ChartCard title="Decisions" description="Recorded outcomes, including revisions.">
          <CountChart data={outcomeData} />
        </ChartCard>
        <ChartCard
          title="Review progress"
          description="Open assignments. Overdue is also counted in not started or draft."
        >
          <CountChart data={reviewProgress} />
        </ChartCard>
        <ChartCard
          title="Submissions over time"
          description="Non-draft papers by the day they were created."
        >
          <CountChart data={dayData} />
        </ChartCard>
        <ChartCard
          title="Corresponding authors"
          description={`${overview.authors.length} corresponding authors. Co-authors are not listed. Withdrawn papers are excluded. Papers with the same title count once.`}
          className="lg:col-span-2"
        >
          <AuthorList authors={overview.authors} />
        </ChartCard>
        <ChartCard
          title="Institutions"
          description="Top 12 affiliations by paper count. Drafts are excluded. Blank affiliations are Unspecified."
        >
          <NameChart data={overview.institutions} unit="Papers" />
        </ChartCard>
        <ChartCard
          title="Reviewer load"
          description="Top 12 reviewers by open assignments that are not yet submitted."
        >
          <NameChart data={overview.reviews.reviewerLoad} unit="Assignments" />
        </ChartCard>
        <ChartCard
          title="Registrations"
          description={`${overview.registrations.unpaid} unpaid, ${overview.registrations.atRisk} due within 7 days, ${overview.unpaidAccepted} accepted without a paid registration.`}
        >
          <CountChart data={registrationData} />
        </ChartCard>
        <ChartCard title="Revenue by timing" description={`Amounts in ${overview.currency}.`}>
          <MoneyChart data={overview.revenueByTiming} currency={overview.currency} />
        </ChartCard>
        <ChartCard title="Revenue by audience" description={`Amounts in ${overview.currency}.`}>
          <MoneyChart data={overview.revenueByAudience} currency={overview.currency} />
        </ChartCard>
      </div>
    </div>
  );
}

function ChartCard({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function AuthorList({ authors }: { authors: CountPoint[] | undefined }) {
  const rows = asList(authors);
  if (rows.length === 0) {
    return <p className="text-sm text-slate-500">No data yet.</p>;
  }
  return (
    <div className="max-h-96 overflow-auto rounded-xl border border-slate-200">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 border-b border-slate-200 bg-slate-50">
          <tr>
            <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
              Corresponding author
            </th>
            <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
              Submissions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((author) => (
            <tr key={author.name}>
              <td className="px-4 py-2.5 text-slate-900">{author.name}</td>
              <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-700">
                {author.count}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CountChart({ data }: { data: CountPoint[] | undefined }) {
  const points = asList(data);
  if (points.length === 0 || points.every((row) => row.count === 0)) {
    return <p className="text-sm text-slate-500">No data yet.</p>;
  }
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 12 }}
            interval={0}
            angle={-20}
            textAnchor="end"
            height={70}
          />
          <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
          <Tooltip formatter={(value) => [value ?? 0, 'Count']} />
          <Bar dataKey="count" fill="#4f46e5" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function NameChart({ data, unit }: { data: CountPoint[] | undefined; unit: string }) {
  const points = asList(data);
  if (points.length === 0) {
    return <p className="text-sm text-slate-500">No data yet.</p>;
  }
  return (
    <div className="w-full" style={{ height: Math.max(220, points.length * 36) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={points}
          layout="vertical"
          margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
          <YAxis
            type="category"
            dataKey="name"
            width={150}
            tick={{ fontSize: 12 }}
            tickFormatter={(value: string) =>
              value.length > 22 ? `${value.slice(0, 20)}…` : value
            }
          />
          <Tooltip formatter={(value) => [value ?? 0, unit]} />
          <Bar dataKey="count" fill="#4f46e5" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function MoneyChart({ data, currency }: { data: MoneyPoint[] | undefined; currency: string }) {
  const points = asList(data).map((row) => ({
    name: words(row.name),
    amountMinor: row.amountMinor,
  }));
  if (points.length === 0) {
    return <p className="text-sm text-slate-500">No payments yet.</p>;
  }
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis
            tick={{ fontSize: 12 }}
            tickFormatter={(value: number) => (value / 100).toLocaleString()}
          />
          <Tooltip formatter={(value) => [formatMoney(Number(value ?? 0), currency), 'Revenue']} />
          <Bar dataKey="amountMinor" fill="#0f766e" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <p className="mt-1 font-mono text-2xl font-semibold text-slate-900">{value}</p>
        {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}
