import { cn } from '@/lib/utils';

export type WorkflowTone = 'success' | 'pending' | 'danger' | 'info' | 'neutral';

const TONE_STYLES: Record<WorkflowTone, string> = {
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 before:bg-emerald-500',
  pending: 'bg-amber-50 text-amber-800 ring-amber-600/20 before:bg-amber-500',
  danger: 'bg-rose-50 text-rose-700 ring-rose-600/20 before:bg-rose-500',
  info: 'bg-sky-50 text-sky-700 ring-sky-600/20 before:bg-sky-500',
  neutral: 'bg-slate-50 text-slate-600 ring-slate-500/20 before:bg-slate-400',
};

type WorkflowBadgeProps = {
  label: string;
  tone?: WorkflowTone;
  className?: string;
};

export function WorkflowBadge({ label, tone = 'neutral', className }: WorkflowBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset before:size-1.5 before:rounded-full before:content-['']",
        TONE_STYLES[tone],
        className,
      )}
    >
      {label}
    </span>
  );
}
