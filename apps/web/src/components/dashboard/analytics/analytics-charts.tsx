'use client';

import { useId, useMemo, useState, type ReactNode } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { activitySeries, formatAnalyticsNumber, type ActivityPoint } from '@/lib/analytics';
import { cn } from '@/lib/utils';
import {
  chartColors,
  CsvButton,
  downloadCsv,
  EmptyChart,
  ModuleCard,
  Segmented,
  type ChartPoint,
} from './analytics-card';

const number = formatAnalyticsNumber;
const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
const percent = (value: number, total: number) => `${((value / total) * 100).toFixed(1)}%`;
const DISPLAY = [
  ['count', 'Count'],
  ['share', 'Share'],
] as const;

type CardFrame = {
  title: string;
  subtitle?: ReactNode;
  info?: ReactNode;
  footer?: ReactNode;
  className?: string;
  delay?: number;
};

/**
 * A ranked list of categories with one bar each. HTML rows keep long names,
 * exact values and screen-reader output aligned with their bars.
 */
export function RankedBarsCard({
  data,
  unit = 'papers',
  money,
  currency,
  empty,
  expandable = false,
  ...frame
}: CardFrame & {
  data: ChartPoint[];
  unit?: string;
  money?: (n: number) => string;
  /** Adds a currency column to the export when the values are money. */
  currency?: string;
  empty?: string;
  expandable?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [display, setDisplay] = useState<'count' | 'share'>('count');
  const total = data.reduce((sum, p) => sum + p.value, 0);
  const hasData = data.length > 0 && data.some((p) => p.value !== 0);
  const canShare = hasData && !money && total > 0 && data.every((p) => p.value >= 0);
  const share = canShare && display === 'share';
  const shown = expandable && !expanded ? data.slice(0, 6) : data;
  const max = Math.max(1, ...data.map((p) => Math.abs(p.value)));
  const diverging = data.some((p) => p.value < 0);

  return (
    <ModuleCard
      {...frame}
      actions={
        <>
          {canShare ? (
            <Segmented
              label={`${frame.title} display`}
              value={display}
              onChange={setDisplay}
              options={DISPLAY}
            />
          ) : null}
          <CsvButton
            title={frame.title}
            disabled={!hasData}
            onExport={() =>
              downloadCsv(`${slug(frame.title)}.csv`, [
                money ? ['Category', 'Amount', 'Currency'] : ['Category', unit, 'Share'],
                ...data.map((p) =>
                  money
                    ? [p.name, (p.value / 100).toFixed(2), currency ?? '']
                    : [p.name, p.value, total ? percent(p.value, total) : ''],
                ),
              ])
            }
          />
        </>
      }
    >
      {!hasData ? (
        <EmptyChart>{empty}</EmptyChart>
      ) : (
        <div className="space-y-4">
          <ul className="space-y-3.5" aria-label={`${unit} by category`}>
            {shown.map((p, i) => (
              <li key={p.id ?? `${p.name}-${i}`} className="group space-y-1.5">
                <div className="flex items-start justify-between gap-4 text-sm">
                  <span className="min-w-0 break-words text-slate-700 group-hover:text-slate-900">
                    {p.name}
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums text-slate-900">
                    {money ? money(p.value) : share ? percent(p.value, total) : number(p.value)}
                    <span className="sr-only"> {unit}</span>
                  </span>
                </div>
                <div
                  className="relative h-2 overflow-hidden rounded-full bg-slate-100"
                  aria-hidden="true"
                >
                  {diverging && <span className="absolute inset-y-0 left-1/2 w-px bg-slate-400" />}
                  <span
                    className="analytics-bar absolute inset-y-0 rounded-full opacity-90 transition-opacity group-hover:opacity-100"
                    style={{
                      animationDelay: `${i * 40}ms`,
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
          {share && (
            <p className="text-xs text-slate-500">
              Share of the {number(total)} {unit} in this breakdown.
            </p>
          )}
          {expandable && data.length > 6 && (
            <button
              type="button"
              className="rounded text-xs font-medium text-indigo-700 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? 'Show top 6' : `Show all ${data.length}`}
            </button>
          )}
        </div>
      )}
    </ModuleCard>
  );
}

/** Ordered stages shown as a stepper, so the list reads as a pipeline rather than a ranking. */
export function PipelineCard({
  data,
  unit = 'papers',
  empty,
  ...frame
}: CardFrame & { data: ChartPoint[]; unit?: string; empty?: string }) {
  const [display, setDisplay] = useState<'count' | 'share'>('count');
  const total = data.reduce((sum, p) => sum + p.value, 0);
  const hasData = total > 0;
  const max = Math.max(1, ...data.map((p) => p.value));
  return (
    <ModuleCard
      {...frame}
      actions={
        <>
          {hasData ? (
            <Segmented
              label={`${frame.title} display`}
              value={display}
              onChange={setDisplay}
              options={DISPLAY}
            />
          ) : null}
          <CsvButton
            title={frame.title}
            disabled={!hasData}
            onExport={() =>
              downloadCsv(`${slug(frame.title)}.csv`, [
                ['Stage', unit, 'Share'],
                ...data.map((p) => [p.name, p.value, percent(p.value, total)]),
              ])
            }
          />
        </>
      }
    >
      {!hasData ? (
        <EmptyChart>{empty}</EmptyChart>
      ) : (
        <ol aria-label={`${unit} by stage`}>
          {data.map((p, i) => (
            <li key={p.name} className="group relative flex gap-3.5 pb-5 last:pb-0">
              {i < data.length - 1 ? (
                <span
                  className="absolute bottom-0 left-[13px] top-7 w-px bg-slate-200"
                  aria-hidden
                />
              ) : null}
              <span
                className="relative mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-semibold tabular-nums text-indigo-700 ring-1 ring-inset ring-indigo-100 transition-colors group-hover:bg-indigo-600 group-hover:text-white group-hover:ring-indigo-600"
                aria-hidden
              >
                {i + 1}
              </span>
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 break-words text-slate-700">{p.name}</span>
                  <span className="shrink-0 font-semibold tabular-nums text-slate-900">
                    {display === 'share' ? percent(p.value, total) : number(p.value)}
                    <span className="sr-only"> {unit}</span>
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden>
                  <span
                    className="analytics-bar block h-full rounded-full"
                    style={{
                      animationDelay: `${i * 60}ms`,
                      width: `${(p.value / max) * 100}%`,
                      backgroundColor: chartColors.accent,
                    }}
                  />
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </ModuleCard>
  );
}

/**
 * Parts of one whole in a single bar. Hovering a segment or its legend entry
 * highlights the pair; every value is also printed in the legend.
 */
export function StackedBar({
  data,
  total,
  label,
  columns = 'grid-cols-2 sm:grid-cols-3',
}: {
  data: ChartPoint[];
  total: number;
  label: string;
  columns?: string;
}) {
  const [active, setActive] = useState<string | null>(null);
  const segments = data.filter((p) => p.value > 0);
  return (
    <div className="space-y-5">
      <div className="flex h-7 gap-0.5" aria-hidden="true">
        {segments.map((p, i) => (
          <span
            key={p.name}
            title={`${p.name}: ${number(p.value)} (${percent(p.value, total)})`}
            onMouseEnter={() => setActive(p.name)}
            onMouseLeave={() => setActive(null)}
            className={cn(
              'analytics-bar min-w-1 transition-opacity duration-200',
              i === 0 ? 'rounded-l-md' : '',
              i === segments.length - 1 ? 'rounded-r-md' : '',
              active && active !== p.name ? 'opacity-30' : '',
            )}
            style={{
              animationDelay: `${i * 70}ms`,
              flexGrow: p.value,
              flexBasis: 0,
              backgroundColor: p.color,
            }}
          />
        ))}
      </div>
      <ul className={cn('grid gap-x-6 gap-y-4', columns)} aria-label={label}>
        {data.map((p) => (
          <li
            key={p.name}
            onMouseEnter={() => setActive(p.name)}
            onMouseLeave={() => setActive(null)}
            className={cn(
              'text-sm transition-opacity duration-200',
              active && active !== p.name ? 'opacity-40' : '',
            )}
          >
            <span className="flex items-center gap-2 text-slate-600">
              <span
                className="size-2.5 shrink-0 rounded-[3px]"
                style={{ backgroundColor: p.color }}
                aria-hidden="true"
              />
              {p.name}
            </span>
            <span className="mt-1 block pl-[18px] text-lg font-semibold tabular-nums text-slate-900">
              {number(p.value)}{' '}
              <span className="text-xs font-normal text-slate-500">
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
  cumulative,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: ActivityPoint; value?: number | string }>;
  cumulative?: boolean;
}) {
  const p = payload?.[0]?.payload;
  if (!active || !p) return null;
  return (
    <div className="max-w-64 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-lg shadow-slate-900/5">
      <p className="text-xs text-slate-500">{p.label}</p>
      <p className="mt-0.5 font-semibold tabular-nums text-slate-900">
        {number(Number(payload?.[0]?.value ?? 0))}{' '}
        <span className="font-normal text-slate-600">
          {cumulative ? 'papers so far' : 'papers'}
        </span>
      </p>
    </div>
  );
}

const RANGES = [
  ['all', 'All'],
  ['7', '7 days'],
  ['30', '30 days'],
  ['custom', 'Custom'],
] as const;
const MODES = [
  ['period', 'Per period'],
  ['cumulative', 'Cumulative'],
] as const;
const DATE_INPUT =
  'ml-2 min-h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

export function SubmissionTrendCard({
  data,
  ...frame
}: CardFrame & { data: { date: string; count: number }[] }) {
  const gradientId = useId();
  const [mode, setMode] = useState<'period' | 'cumulative'>('period');
  const [range, setRange] = useState<(typeof RANGES)[number][0]>('all');
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
  const total = points.reduce((sum, p) => sum + p.count, 0);
  const peak = points.reduce<ActivityPoint | null>(
    (best, p) => (!best || p.count > best.count ? p : best),
    null,
  );
  const mean = points.length ? total / points.length : 0;
  const hasData = series.points.length > 0;

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
      tick={{ fill: '#64748b', fontSize: 12 }}
      height={36}
      tickMargin={12}
    />
  );
  const y = (
    <YAxis
      allowDecimals={false}
      axisLine={false}
      tickLine={false}
      tick={{ fill: '#64748b', fontSize: 12 }}
      tickFormatter={number}
      width={56}
    />
  );

  return (
    <ModuleCard
      {...frame}
      actions={
        <>
          {hasData ? (
            <Segmented
              label="Activity chart mode"
              value={mode}
              onChange={setMode}
              options={MODES}
            />
          ) : null}
          <CsvButton
            title={frame.title}
            disabled={!points.length}
            onExport={() =>
              downloadCsv(`paper-activity-${rangeStart}-${rangeEnd}.csv`, [
                ['Period (UTC)', 'Papers', 'Cumulative'],
                ...points.map((p) => [p.date, p.count, p.cumulative]),
              ])
            }
          />
        </>
      }
      footer={
        hasData ? (
          <>
            <span>
              {rangeStart} – {rangeEnd} · {filtered.interval} · UTC
            </span>
            <span>
              {mode === 'period'
                ? 'Dashed line: period average'
                : 'Running total from the first paper'}
            </span>
          </>
        ) : undefined
      }
    >
      {!hasData ? (
        <EmptyChart>No included papers to plot yet.</EmptyChart>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
            <div
              className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-xs text-slate-500"
              aria-live="polite"
            >
              <span>
                <strong className="mr-1.5 text-3xl font-semibold tabular-nums tracking-tight text-slate-900">
                  {number(total)}
                </strong>
                papers in range
              </span>
              <span>
                Peak{' '}
                <strong className="font-medium text-slate-900">
                  {peak ? `${peak.count} · ${peak.shortLabel}` : '—'}
                </strong>
              </span>
            </div>
            <Segmented
              label="Paper activity date range"
              value={range}
              onChange={setRange}
              options={RANGES}
            />
          </div>
          {range === 'custom' && (
            <div className="flex flex-wrap gap-3 motion-safe:animate-in motion-safe:fade-in">
              <label className="text-xs text-slate-600">
                From
                <input
                  aria-label="Activity start date"
                  type="date"
                  className={DATE_INPUT}
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
                  className={DATE_INPUT}
                  min={start || first}
                  max={last}
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                />
              </label>
            </div>
          )}
          {!points.length && (
            <EmptyChart>No paper activity in this date range. Choose another range.</EmptyChart>
          )}
          <div className="h-64 min-w-0 sm:h-72" data-testid="submission-trend">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              {mode === 'period' ? (
                <BarChart {...common}>
                  {grid}
                  {x}
                  {y}
                  <Tooltip content={<TrendTooltip />} cursor={{ fill: '#eef2ff' }} />
                  <ReferenceLine y={mean} stroke="#94a3b8" strokeDasharray="4 4" />
                  <Bar
                    name="Papers"
                    dataKey="count"
                    fill={chartColors.accent}
                    maxBarSize={32}
                    radius={[4, 4, 0, 0]}
                    // Recharts can leave marks at zero height when its container resizes mid-animation.
                    isAnimationActive={false}
                  />
                </BarChart>
              ) : (
                <AreaChart {...common}>
                  <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={chartColors.accent} stopOpacity={0.28} />
                      <stop offset="100%" stopColor={chartColors.accent} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  {grid}
                  {x}
                  {y}
                  <Tooltip
                    content={<TrendTooltip cumulative />}
                    cursor={{ stroke: '#94a3b8', strokeDasharray: '4 4' }}
                  />
                  <Area
                    name="Papers"
                    type="stepAfter"
                    dataKey="cumulative"
                    stroke={chartColors.accent}
                    strokeWidth={2}
                    fill={`url(#${gradientId})`}
                    activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }}
                    // Recharts can leave marks at zero height when its container resizes mid-animation.
                    isAnimationActive={false}
                  />
                </AreaChart>
              )}
            </ResponsiveContainer>
          </div>
          <details className="text-sm">
            <summary className="w-fit cursor-pointer rounded py-1 text-xs font-medium text-indigo-700 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              View activity data
            </summary>
            <div className="mt-3 max-h-64 overflow-auto rounded-xl border border-slate-100">
              <table className="w-full text-sm">
                <caption className="sr-only">Included papers by creation period, UTC</caption>
                <thead className="sticky top-0 bg-slate-50 text-left text-xs text-slate-600">
                  <tr>
                    <th className="px-3 py-2 font-medium" scope="col">
                      Period
                    </th>
                    <th className="px-3 py-2 text-right font-medium" scope="col">
                      Papers
                    </th>
                    <th className="px-3 py-2 text-right font-medium" scope="col">
                      Cumulative
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {points.map((p) => (
                    <tr key={p.date} className="border-t border-slate-100">
                      <th scope="row" className="px-3 py-2 text-left font-normal text-slate-700">
                        {p.label}
                      </th>
                      <td className="px-3 py-2 text-right tabular-nums">{number(p.count)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{number(p.cumulative)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      )}
    </ModuleCard>
  );
}
