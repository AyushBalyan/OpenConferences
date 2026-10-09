'use client';
import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { activitySeries, type ActivityPoint } from '@/lib/analytics';

export type ChartPoint = { name: string; value: number; color?: string; id?: string };
export const chartColors = {
  indigo: '#4f46e5',
  teal: '#0f766e',
  amber: '#b45309',
  rose: '#be123c',
  slate: '#64748b',
};
const number = (n: number) => n.toLocaleString();
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
}: {
  data: ChartPoint[];
  unit?: string;
  money?: (n: number) => string;
  empty?: string;
}) {
  if (!data.length || data.every((p) => p.value === 0)) return <EmptyChart>{empty}</EmptyChart>;
  const max = Math.max(1, ...data.map((p) => Math.abs(p.value)));
  const diverging = data.some((p) => p.value < 0);
  return (
    <ul className="space-y-4" aria-label={`${unit} by category`}>
      {data.map((p, i) => (
        <li key={p.id ?? `${p.name}-${i}`} className="space-y-1.5">
          <div className="flex items-start justify-between gap-4 text-sm">
            <span className="min-w-0 break-words text-slate-700">{p.name}</span>
            <span className="shrink-0 font-semibold tabular-nums text-slate-900">
              {money ? money(p.value) : number(p.value)}
              <span className="sr-only"> {unit}</span>
            </span>
          </div>
          <div className="relative h-2 overflow-hidden rounded-sm bg-slate-100" aria-hidden="true">
            {diverging && <span className="absolute inset-y-0 left-1/2 w-px bg-slate-400" />}
            <span
              className="absolute inset-y-0 rounded-sm"
              style={{
                backgroundColor: p.color ?? chartColors.indigo,
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
        {Number(payload?.[0]?.value ?? 0).toLocaleString()} papers
      </p>
    </div>
  );
}
export function SubmissionTrend({ data }: { data: { date: string; count: number }[] }) {
  const [mode, setMode] = useState<'period' | 'cumulative'>('period');
  const { points, interval } = useMemo(() => activitySeries(data), [data]);
  if (!points.length) return <EmptyChart>No included papers to plot yet.</EmptyChart>;
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
  const tooltip = <Tooltip content={<TrendTooltip />} cursor={{ fill: '#eef2ff' }} />;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-600">{interval} · UTC</p>
        <div className="flex gap-1" role="group" aria-label="Activity chart mode">
          <Button
            size="sm"
            variant={mode === 'period' ? 'default' : 'ghost'}
            aria-pressed={mode === 'period'}
            onClick={() => setMode('period')}
          >
            Per period
          </Button>
          <Button
            size="sm"
            variant={mode === 'cumulative' ? 'default' : 'ghost'}
            aria-pressed={mode === 'cumulative'}
            onClick={() => setMode('cumulative')}
          >
            Cumulative
          </Button>
        </div>
      </div>
      <div className="h-60 min-w-0" data-testid="submission-trend">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          {mode === 'period' ? (
            <BarChart {...common}>
              {grid}
              {x}
              {y}
              {tooltip}
              <Bar
                name="Papers"
                dataKey="count"
                fill={chartColors.indigo}
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
              <Area
                name="Papers"
                type="stepAfter"
                dataKey="cumulative"
                stroke={chartColors.indigo}
                strokeWidth={2}
                fill="#e0e7ff"
                isAnimationActive={false}
              />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
      <details className="text-sm">
        <summary className="w-fit cursor-pointer rounded-sm py-1 text-slate-600 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600">
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
