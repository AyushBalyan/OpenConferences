import { cn } from '@/lib/utils';

export type WorkflowTone = 'success' | 'pending' | 'danger' | 'info' | 'neutral';

const TONE_STYLES: Record<WorkflowTone, string> = {
  success: 'bg-emerald-100 text-emerald-700',
  pending: 'bg-amber-100 text-amber-700',
  danger: 'bg-rose-100 text-rose-700',
  info: 'bg-blue-100 text-blue-700',
  neutral: 'bg-slate-100 text-slate-600',
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
        'inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium',
        TONE_STYLES[tone],
        className,
      )}
    >
      {label}
    </span>
  );
}
