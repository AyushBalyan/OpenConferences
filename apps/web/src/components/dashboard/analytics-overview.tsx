'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchAnalyticsOverview } from '@/lib/api-client';

type AnalyticsOverviewProps = {
  conferenceId: string;
};

function formatMoney(minor: number, currency: string): string {
  return `${(minor / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })} ${currency}`;
}

export function AnalyticsOverview({ conferenceId }: AnalyticsOverviewProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [overview, setOverview] = useState<Awaited<
    ReturnType<typeof fetchAnalyticsOverview>
  > | null>(null);

  const load = useCallback(async () => {
    const data = await fetchAnalyticsOverview(conferenceId);
    setOverview(data);
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
      { stage: 'Registrations', count: overview.registrations.paid },
      {
        stage: 'Revenue',
        count: overview.revenueMinor / 100,
        isRevenue: true,
      },
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Conference funnel</CardTitle>
          <CardDescription>
            Pipeline from submissions through revenue. Revenue shown in {overview.currency}; other
            stages are counts. Updated {new Date(overview.computedAt).toLocaleString()}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="stage"
                  tick={{ fontSize: 12 }}
                  interval={0}
                  angle={-20}
                  textAnchor="end"
                  height={70}
                />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip
                  formatter={(value, _name, item) => {
                    const payload = item.payload as { isRevenue?: boolean };
                    if (payload.isRevenue) {
                      return [formatMoney(overview.revenueMinor, overview.currency), 'Revenue'];
                    }
                    return [value ?? 0, 'Count'];
                  }}
                />
                <Bar dataKey="count" fill="#4f46e5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Submissions" value={overview.submissions.total} />
        <MetricCard
          label="Reviews"
          value={`${overview.reviews.completed}/${overview.reviews.assigned}`}
          hint="Completed / assigned"
        />
        <MetricCard label="Decisions" value={overview.decisions.total} />
        <MetricCard
          label="Revenue"
          value={formatMoney(overview.revenueMinor, overview.currency)}
          hint={`${overview.registrations.paid} paid registrations`}
        />
      </div>
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
