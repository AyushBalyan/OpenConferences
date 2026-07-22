'use client';

import { BID_OPTIONS, type BidValue } from '@/lib/review-types';
import { cn } from '@/lib/utils';

type BidSelectorProps = {
  value?: BidValue | null;
  disabled?: boolean;
  onSelect: (value: BidValue) => void;
  className?: string;
};

export function BidSelector({ value, disabled, onSelect, className }: BidSelectorProps) {
  return (
    <div
      role="group"
      aria-label="Place bid"
      className={cn(
        'inline-flex max-w-full flex-nowrap overflow-x-auto rounded-md border border-slate-200 bg-white shadow-sm',
        className,
      )}
    >
      {BID_OPTIONS.map((opt, index) => {
        const selected = value === opt.value;
        const isConflict = opt.value === 'CONFLICT';

        return (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            aria-pressed={selected}
            title={opt.label}
            onClick={() => onSelect(opt.value)}
            className={cn(
              'shrink-0 px-2.5 py-1.5 text-xs font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1',
              'disabled:pointer-events-none disabled:opacity-50',
              index > 0 && 'border-l border-slate-200',
              selected
                ? isConflict
                  ? 'bg-rose-600 text-white'
                  : 'bg-indigo-600 text-white'
                : isConflict
                  ? 'text-rose-700 hover:bg-rose-50'
                  : 'text-slate-700 hover:bg-slate-50',
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
