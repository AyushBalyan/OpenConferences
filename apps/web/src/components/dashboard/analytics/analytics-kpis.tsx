'use client';

import { useId, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowUpRight, CheckCircle2 } from 'lucide-react';
import { formatAnalyticsNumber } from '@/lib/analytics';
import { cn } from '@/lib/utils';
import { chartColors, type ChartPoint } from './analytics-card';

const number = formatAnalyticsNumber;
const TILE =
  'analytics-module group relative flex min-w-0 flex-col rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 text-left shadow-[0_1px_2px_rgb(15_23_42/0.04)]';

/** A headline figure. Selecting it opens the tab that explains the number. */
export function KpiTile({
  label,
  value,
  suffix,
  detail,
  visual,
  opens,
  onOpen,
  delay = 0,
}: {
  label: string;
  value: string;
  /** Smaller text after the value, such as the denominator of a ratio. */
  suffix?: string;
  detail: ReactNode;
  visual?: ReactNode;
  /** Name of the tab this tile opens, used in its accessible description. */
  opens: string;
  onOpen: () => void;
  delay?: number;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      title={`Open ${opens}`}
      style={{ animationDelay: `${delay * 60}ms` }}
      className={cn(
        TILE,
        'h-full w-full transition-[box-shadow,transform,border-color] duration-300 hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-[0_12px_28px_-14px_rgb(79_70_229/0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      )}
    >
      <span className="flex min-h-[52px] items-start justify-between gap-3">
        <span className="pt-0.5 text-xs font-medium text-slate-500">{label}</span>
        {/* Always rendered: toggling display would restart the entry animations. */}
        <span className="shrink-0">
          {visual ?? (
            <ArrowUpRight
              className="size-4 text-slate-300 transition-colors group-hover:text-indigo-600"
              aria-hidden
            />
          )}
        </span>
      </span>
      <span
        className={cn(
          'mt-1 block min-w-0 break-words font-semibold leading-tight tracking-tight text-slate-900 tabular-nums',
          // Long money amounts step down in size so they stay on one line.
          value.length > 13
            ? 'text-base sm:text-lg'
            : value.length > 9
              ? 'text-lg sm:text-xl'
              : 'text-2xl sm:text-[1.7rem]',
        )}
      >
        {value}
        {suffix ? (
          <span className="ml-1 whitespace-nowrap text-base font-medium text-slate-400">
            {suffix}
          </span>
        ) : null}
      </span>
      <span className="mt-3 block text-xs leading-relaxed text-slate-500">{detail}</span>
    </button>
  );
}

/** Share of a whole as a ring. The percentage is printed in the centre. */
export function ProgressRing({ value }: { value: number | null }) {
  const size = 52;
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const length = 2 * Math.PI * radius;
  const share = value === null ? 0 : Math.min(Math.max(value, 0), 1);
  return (
    <span className="relative block" style={{ width: size, height: size }} aria-hidden>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={chartColors.track}
          strokeWidth={stroke}
        />
        {share > 0 ? (
          <circle
            className="analytics-ring"
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={chartColors.accent}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={length}
            strokeDashoffset={length * (1 - share)}
            style={{ ['--ring-length' as string]: length }}
          />
        ) : null}
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold tabular-nums text-slate-700">
        {value === null ? '—' : `${Math.round(share * 100)}%`}
      </span>
    </span>
  );
}

/** The shape of a series at a glance. Exact values live in the full chart. */
export function Sparkline({ values }: { values: number[] }) {
  const gradientId = useId();
  if (values.length < 2) return null;
  const width = 88;
  const height = 36;
  const max = Math.max(1, ...values);
  const step = width / (values.length - 1);
  const points = values.map(
    (value, index) => [index * step, height - 3 - (value / max) * (height - 6)] as const,
  );
  const line = points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={chartColors.accent} stopOpacity={0.25} />
          <stop offset="100%" stopColor={chartColors.accent} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon points={`0,${height} ${line} ${width},${height}`} fill={`url(#${gradientId})`} />
      <polyline
        points={line}
        fill="none"
        stroke={chartColors.accent}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** A small parts-of-a-whole bar for a tile. */
export function MiniStack({ data }: { data: ChartPoint[] }) {
  const segments = data.filter((p) => p.value > 0);
  if (!segments.length) return null;
  return (
    <span className="mt-1.5 flex h-2 w-20 gap-0.5" aria-hidden>
      {segments.map((p, i) => (
        <span
          key={p.name}
          className={cn(
            'analytics-bar min-w-0.5',
            i === 0 ? 'rounded-l-full' : '',
            i === segments.length - 1 ? 'rounded-r-full' : '',
          )}
          style={{ flexGrow: p.value, flexBasis: 0, backgroundColor: p.color }}
        />
      ))}
    </span>
  );
}

/** Work that is late or under-covered, with a direct link to each queue. */
export function AttentionTile({
  items,
  delay = 0,
}: {
  items: Array<{ value: number; label: string; href: string; tone: 'critical' | 'warning' }>;
  delay?: number;
}) {
  const open = items.filter((item) => item.value > 0);
  return (
    <div
      style={{ animationDelay: `${delay * 60}ms` }}
      className={cn(
        TILE,
        'h-full',
        open.length
          ? 'border-amber-200/80 bg-gradient-to-br from-amber-50/80 to-white'
          : 'border-emerald-200/80 bg-gradient-to-br from-emerald-50/70 to-white',
      )}
    >
      <p className="text-xs font-medium text-slate-600">Needs attention</p>
      {open.length === 0 ? (
        <p className="mt-3 flex items-center gap-2 text-sm font-medium text-emerald-800">
          <CheckCircle2 className="size-5 shrink-0" aria-hidden />
          No overdue or under-covered reviews.
        </p>
      ) : null}
      <ul className={cn('mt-2 space-y-0.5', open.length ? '' : 'hidden')}>
        {items.map((item) => (
          <li key={item.label}>
            <Link
              href={item.href}
              className="group/link -mx-2 flex min-h-10 items-center justify-between gap-3 rounded-lg px-2 text-sm text-slate-700 transition-colors hover:bg-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span>
                <strong
                  className={cn(
                    'mr-1 text-lg font-semibold tabular-nums',
                    item.value === 0
                      ? 'text-slate-400'
                      : item.tone === 'critical'
                        ? 'text-rose-700'
                        : 'text-amber-700',
                  )}
                >
                  {number(item.value)}
                </strong>{' '}
                {item.label}
              </span>
              <ArrowUpRight
                className="size-4 shrink-0 text-slate-400 transition-colors group-hover/link:text-indigo-600"
                aria-hidden
              />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
