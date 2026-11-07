'use client';
import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Brush,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Download } from 'lucide-react';
import { activitySeries, formatAnalyticsNumber, type ActivityPoint } from '@/lib/analytics';

export type ChartPoint = { name: string; value: number; color?: string; id?: string };
export const chartColors = {
  accent: '#016a6a',
  teal: '#0f766e',
  amber: '#b45309',
  rose: '#be123c',
  slate: '#64748b',
};
const number = formatAnalyticsNumber;
export function EmptyChart({
  children = 'No data in this scope yet.',
}: {
  children?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-32 items-center justify-center rounded-lg bg-slate-50 px-5 text-center text-sm text-slate-600">
      {children}
    </div>
  );
}
// HTML labels keep long names, exact values and screen-reader output aligned with their bars.
export function CategoryChart({
  data,
  unit = 'papers',
  money,
  empty,
  expandable = false,
}: {
  data: ChartPoint[];
  unit?: string;
  money?: (n: number) => string;
  empty?: string;
  expandable?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [share, setShare] = useState(false);
  const total = data.reduce((sum, p) => sum + p.value, 0);
  const canShare = !money && total > 0 && data.every((p) => p.value >= 0);
  const shown = expandable && !expanded ? data.slice(0, 6) : data;
  if (!data.length || data.every((p) => p.value === 0)) return <EmptyChart>{empty}</EmptyChart>;
  const max = Math.max(1, ...data.map((p) => Math.abs(p.value)));
  const diverging = data.some((p) => p.value < 0);
  return (
    <div className="space-y-4">
      {canShare && (
        <div className="flex justify-end gap-1" role="group" aria-label={`${unit} display`}>
          <button
            className="analytics-toggle"
            aria-pressed={!share}
            onClick={() => setShare(false)}
          >
            Count
          </button>
          <button className="analytics-toggle" aria-pressed={share} onClick={() => setShare(true)}>
            Share
          </button>
        </div>
      )}
      <ul className="space-y-4" aria-label={`${unit} by category`}>
        {shown.map((p, i) => (
          <li key={p.id ?? `${p.name}-${i}`} className="space-y-1.5">
            <div className="flex items-start justify-between gap-4 text-sm">
              <span className="min-w-0 break-words text-slate-700">{p.name}</span>
              <span className="shrink-0 font-semibold tabular-nums text-slate-900">
                {money
                  ? money(p.value)
                  : share
                    ? `${((p.value / total) * 100).toFixed(1)}%`
                    : number(p.value)}
                <span className="sr-only"> {unit}</span>
              </span>
            </div>
            <div
              className="relative h-2 overflow-hidden rounded-sm bg-slate-100"
              aria-hidden="true"
            >
              {diverging && <span className="absolute inset-y-0 left-1/2 w-px bg-slate-400" />}
              <span
                className="absolute inset-y-0 rounded-sm"
                style={{
                  backgroundColor: p.color ?? chartColors.accent,
                  width: `${(Math.abs(p.value) / max) * (diverging ? 50 : 100)}%`,
                  left: diverging
                    ? `${p.value < 0 ? 50 - (Math.abs(p.value) / max) * 50 : 50}%`
                    : '0%',
                }}
              />
            </div>
          </li>
        ))}
      </ul>
      {canShare && share && (
        <p className="text-xs text-slate-600">
          Share of the {number(total)} {unit} in this breakdown.
        </p>
      )}
      {expandable && data.length > 6 && (
        <button className="analytics-text-action" onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Show top 6' : `Show all ${data.length}`}
        </button>
      )}
    </div>
  );
}
export function ReviewProgressChart({ data, total }: { data: ChartPoint[]; total: number }) {
  if (!total) return <EmptyChart>No review assignments in the latest cycles yet.</EmptyChart>;
  return (
    <div className="space-y-5">
      <div className="flex h-6 overflow-hidden rounded-md bg-slate-100" aria-hidden="true">
        {data
          .filter((p) => p.value > 0)
          .map((p) => (
            <span
              key={p.name}
              style={{ width: `${(p.value / total) * 100}%`, backgroundColor: p.color }}
            />
          ))}
      </div>
      <ul className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
        {data.map((p) => (
          <li key={p.name} className="text-sm">
            <span className="flex items-center gap-2 text-slate-600">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: p.color }}
                aria-hidden="true"
              />
              {p.name}
            </span>
            <span className="mt-1 block pl-[18px] text-lg font-semibold tabular-nums text-slate-900">
              {number(p.value)}{' '}
              <span className="text-xs font-normal text-slate-600">
                {Math.round((p.value / total) * 100)}%
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
function TrendTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: ActivityPoint; value?: number | string }>;
}) {
  const p = payload?.[0]?.payload;
  if (!active || !p) return null;
  return (
    <div className="max-w-64 rounded-lg border border-slate-200 bg-white p-3 text-sm shadow-sm">
      <p className="text-slate-600">{p.label}</p>
      <p className="mt-1 font-semibold text-slate-900">
        {number(Number(payload?.[0]?.value ?? 0))} papers
      </p>
    </div>
  );
}
export function SubmissionTrend({ data }: { data: { date: string; count: number }[] }) {
  const [mode, setMode] = useState<'period' | 'cumulative'>('period');
  const [range, setRange] = useState('all');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const series = useMemo(() => activitySeries(data), [data]);
  // Window bounds must use original dates, never the start of an aggregated week/month.
  const dates = useMemo(
    () =>
      data
        .map((p) => p.date)
        .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)))
        .sort(),
    [data],
  );
  const last = dates.at(-1) ?? '';
  const first = dates[0] ?? '';
  const rangeStart =
    !last || range === 'all'
      ? first
      : range === 'custom'
        ? start || first
        : new Date(Date.parse(last) - (Number(range) - 1) * 86400000).toISOString().slice(0, 10);
  const rangeEnd = range === 'custom' ? end || last : last;
  // Filter original daily records before bucketing, so short windows stay daily even on long histories.
  const filtered = useMemo(() => {
    if (!rangeStart || !rangeEnd || rangeStart > rangeEnd) return activitySeries([]);
    const rows = data.filter((p) => p.date >= rangeStart && p.date <= rangeEnd);
    return activitySeries([{ date: rangeStart, count: 0 }, ...rows, { date: rangeEnd, count: 0 }]);
  }, [data, rangeStart, rangeEnd]);
  const prior = data.filter((p) => p.date < rangeStart).reduce((sum, p) => sum + p.count, 0);
  const points = filtered.points.map((p) => ({ ...p, cumulative: p.cumulative + prior }));
  const interval = filtered.interval;
  const total = points.reduce((sum, p) => sum + p.count, 0);
  const peak = points.reduce<ActivityPoint | null>(
    (best, p) => (!best || p.count > best.count ? p : best),
    null,
  );
  const mean = points.length ? total / points.length : 0;
  if (!series.points.length) return <EmptyChart>No included papers to plot yet.</EmptyChart>;
  const exportData = () => {
    const csv = [
      'Period (UTC),Papers,Cumulative',
      ...points.map((p) => `${p.date},${p.count},${p.cumulative}`),
    ].join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `paper-activity-${rangeStart}-${rangeEnd}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const common = {
    data: points,
    margin: { top: 12, right: 8, left: -18, bottom: 0 },
    accessibilityLayer: true,
  };
  const grid = <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="3 5" />;
  const x = (
    <XAxis
      dataKey="shortLabel"
      axisLine={false}
      tickLine={false}
      minTickGap={36}
      tick={{ fill: '#475569', fontSize: 12 }}
      height={36}
      tickMargin={12}
    />
  );
  const y = (
    <YAxis
      allowDecimals={false}
      axisLine={false}
      tickLine={false}
      tick={{ fill: '#475569', fontSize: 12 }}
      tickFormatter={number}
      width={56}
    />
  );
  const tooltip = <Tooltip content={<TrendTooltip />} cursor={{ fill: '#edf5f4' }} />;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="activity-range">
            Paper activity date range
          </label>
          <select
            id="activity-range"
            className="analytics-select"
            value={range}
            onChange={(e) => setRange(e.target.value)}
          >
            <option value="all">All activity</option>
            <option value="7">Latest 7 days</option>
            <option value="30">Latest 30 days</option>
            <option value="custom">Custom dates</option>
          </select>
          <span className="text-xs text-slate-600">{interval} · UTC</span>
        </div>
        <div className="analytics-segment" role="group" aria-label="Activity chart mode">
          <button
            className="analytics-toggle"
            aria-pressed={mode === 'period'}
            onClick={() => setMode('period')}
          >
            Per period
          </button>
          <button
            className="analytics-toggle"
            aria-pressed={mode === 'cumulative'}
            onClick={() => setMode('cumulative')}
          >
            Cumulative
          </button>
        </div>
      </div>
      {range === 'custom' && (
        <div className="flex flex-wrap gap-3">
          <label className="text-xs text-slate-600">
            From
            <input
              aria-label="Activity start date"
              type="date"
              className="analytics-select ml-2"
              min={first}
              max={end || last}
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
          <label className="text-xs text-slate-600">
            To
            <input
              aria-label="Activity end date"
              type="date"
              className="analytics-select ml-2"
              min={start || first}
              max={last}
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </label>
        </div>
      )}
      <div
        className="flex flex-wrap items-baseline gap-x-6 gap-y-2 text-xs text-slate-600"
        aria-live="polite"
      >
        <span>
          <strong className="mr-1 text-2xl font-semibold tabular-nums text-slate-900">
            {number(total)}
          </strong>{' '}
          papers in range
        </span>
        <span>
          Peak{' '}
          <strong className="font-medium text-slate-900">
            {peak ? `${peak.count} · ${peak.shortLabel}` : '—'}
          </strong>
        </span>
      </div>
      {!points.length && (
        <EmptyChart>No paper activity in this date range. Choose another range.</EmptyChart>
      )}
      <div className="h-52 min-w-0" data-testid="submission-trend">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          {mode === 'period' ? (
            <BarChart {...common}>
              {grid}
              {x}
              {y}
              {tooltip}
              <ReferenceLine y={mean} stroke="#94a3b8" strokeDasharray="4 4" />
              {points.length > 8 && (
                <Brush
                  dataKey="shortLabel"
                  height={22}
                  stroke="#94a3b8"
                  fill="#f8fafc"
                  travellerWidth={8}
                  tickFormatter={() => ''}
                />
              )}
              <Bar
                name="Papers"
                dataKey="count"
                fill={chartColors.accent}
                maxBarSize={28}
                radius={[3, 3, 0, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          ) : (
            <AreaChart {...common}>
              {grid}
              {x}
              {y}
              {tooltip}
              {points.length > 8 && (
                <Brush
                  dataKey="shortLabel"
                  height={22}
                  stroke="#94a3b8"
                  fill="#f8fafc"
                  travellerWidth={8}
                  tickFormatter={() => ''}
                />
              )}
              <Area
                name="Papers"
                type="stepAfter"
                dataKey="cumulative"
                stroke={chartColors.accent}
                strokeWidth={2}
                fill="#e5f0ef"
                isAnimationActive={false}
              />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
        <p className="text-xs text-slate-600">
          {rangeStart} – {rangeEnd}
          {mode === 'period'
            ? ' · Dashed line: period average'
            : ' · Running total from first paper'}
        </p>
        <button
          className="analytics-text-action inline-flex items-center gap-1.5"
          disabled={!points.length}
          onClick={exportData}
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          Export CSV
        </button>
      </div>
      {points.length > 8 && (
        <p className="text-xs text-slate-600">
          Drag the handles below the chart to zoom. Summary and export cover the selected date
          range.
        </p>
      )}
      <details className="text-sm">
        <summary className="w-fit cursor-pointer rounded-sm py-1 text-slate-600 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700">
          View activity data
        </summary>
        <div className="mt-3 max-h-64 overflow-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Included papers by creation period, UTC</caption>
            <thead className="sticky top-0 bg-white text-left text-slate-600">
              <tr>
                <th className="py-2 font-medium" scope="col">
                  Period
                </th>
                <th className="py-2 text-right font-medium" scope="col">
                  Papers
                </th>
                <th className="py-2 text-right font-medium" scope="col">
                  Cumulative
                </th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.date} className="border-t border-slate-100">
                  <th scope="row" className="py-2 text-left font-normal text-slate-700">
                    {p.label}
                  </th>
                  <td className="py-2 text-right tabular-nums">{number(p.count)}</td>
                  <td className="py-2 text-right tabular-nums">{number(p.cumulative)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
