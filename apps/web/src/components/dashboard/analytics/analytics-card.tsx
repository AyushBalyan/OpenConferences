'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Download, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Chart colours. Series hues were checked for colour-blind separation as a set. */
export const chartColors = {
  accent: '#4f46e5',
  accentSoft: '#e0e7ff',
  sky: '#0ea5e9',
  good: '#059669',
  warning: '#f59e0b',
  critical: '#e11d48',
  neutral: '#64748b',
  track: '#f1f5f9',
};

export type ChartPoint = { name: string; value: number; color?: string; id?: string };

const ICON_BUTTON =
  'inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40';

/** Save rows as a CSV file. Values containing commas, quotes or line breaks are quoted. */
export function downloadCsv(filename: string, rows: Array<Array<string | number>>) {
  const cell = (value: string | number) => {
    const text = String(value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const csv = rows.map((row) => row.map(cell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function CsvButton({
  title,
  disabled,
  onExport,
}: {
  title: string;
  disabled?: boolean;
  onExport: () => void;
}) {
  return (
    <button
      type="button"
      className={ICON_BUTTON}
      aria-label={`Export ${title} as CSV`}
      title="Export CSV"
      disabled={disabled}
      onClick={onExport}
    >
      <Download className="size-4" aria-hidden />
    </button>
  );
}

/** Keeps counting rules one click away instead of printing them under every title. */
export function InfoTip({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        className={cn(ICON_BUTTON, open ? 'bg-slate-100 text-slate-900' : '')}
        aria-label={`About ${title}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
      >
        <Info className="size-4" aria-hidden />
      </button>
      <div
        id={panelId}
        role="note"
        hidden={!open}
        className="absolute right-0 top-full z-30 mt-2 w-72 max-w-[calc(100vw-3rem)] rounded-xl border border-slate-200 bg-white p-4 text-left text-xs leading-relaxed text-slate-600 shadow-lg shadow-slate-900/5 motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95"
      >
        {children}
      </div>
    </div>
  );
}

/**
 * The frame every analytics module shares: title, an info popover for counting
 * rules, a slot for controls, the body and an optional footer.
 */
export function ModuleCard({
  title,
  subtitle,
  info,
  actions,
  footer,
  children,
  className,
  delay = 0,
}: {
  title: string;
  subtitle?: ReactNode;
  info?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Stagger position, so a grid of modules settles in order. */
  delay?: number;
}) {
  return (
    <section
      style={{ animationDelay: `${delay * 60}ms` }}
      className={cn(
        'analytics-module flex min-w-0 flex-col rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgb(15_23_42/0.04)] transition-shadow duration-300 hover:shadow-[0_8px_24px_-12px_rgb(15_23_42/0.18)]',
        className,
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 px-5 pt-5 sm:px-6">
        <div className="min-w-0 flex-1 basis-44">
          <h3 className="text-[15px] font-semibold tracking-tight text-slate-900">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p> : null}
        </div>
        {actions || info ? (
          <div className="-mr-1.5 -mt-1 flex shrink-0 items-center gap-0.5">
            {actions}
            {info ? <InfoTip title={title}>{info}</InfoTip> : null}
          </div>
        ) : null}
      </header>
      <div className="min-w-0 flex-1 px-5 pb-5 pt-4 sm:px-6">{children}</div>
      {footer ? (
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 text-xs text-slate-500 sm:px-6">
          {footer}
        </footer>
      ) : null}
    </section>
  );
}

export function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: ReadonlyArray<readonly [T, string]>;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex max-w-full flex-wrap rounded-lg bg-slate-100 p-0.5"
    >
      {options.map(([option, text]) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
          className={cn(
            'min-h-7 whitespace-nowrap rounded-md px-2.5 text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            value === option
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900',
          )}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

export function EmptyChart({ children = 'No data in this scope yet.' }: { children?: ReactNode }) {
  return (
    <div className="flex min-h-32 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-5 text-center text-sm text-slate-500">
      {children}
    </div>
  );
}

const STAT_TONE = {
  neutral: 'text-slate-900',
  good: 'text-emerald-700',
  warning: 'text-amber-700',
  critical: 'text-rose-700',
} as const;

/** A single figure with its label, for counts that do not need a chart. */
export function StatTile({
  label,
  value,
  tone = 'neutral',
  href,
}: {
  label: string;
  value: string;
  tone?: keyof typeof STAT_TONE;
  /** Where the records behind the figure can be seen. */
  href?: string;
}) {
  return (
    <div
      className={cn(
        'relative flex flex-col-reverse justify-end rounded-xl bg-slate-50 p-4',
        href
          ? 'transition-colors focus-within:ring-2 focus-within:ring-ring hover:bg-slate-100'
          : '',
      )}
    >
      <dt className="mt-1 text-xs leading-snug text-slate-600">
        {href ? (
          <Link href={href} className="after:absolute after:inset-0 focus-visible:outline-none">
            {label}
          </Link>
        ) : (
          label
        )}
      </dt>
      <dd className={cn('text-2xl font-semibold tabular-nums tracking-tight', STAT_TONE[tone])}>
        {value}
      </dd>
    </div>
  );
}
