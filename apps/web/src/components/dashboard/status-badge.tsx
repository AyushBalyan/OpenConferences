import { cn } from '@/lib/utils';
import type { WorkflowTone } from './workflow-badge';

const STATUS_TONE: Record<string, WorkflowTone> = {
  DRAFT: 'info',
  CFP_OPEN: 'success',
  REVIEWING: 'pending',
  DECISIONS: 'pending',
  FINALIZATION: 'pending',
  COMPLETED: 'success',
  ARCHIVED: 'neutral',
};

const STATUS_STYLES: Record<WorkflowTone, string> = {
  success: 'bg-emerald-100 text-emerald-700',
  pending: 'bg-amber-100 text-amber-700',
  danger: 'bg-rose-100 text-rose-700',
  info: 'bg-blue-100 text-blue-700',
  neutral: 'bg-slate-100 text-slate-600',
};

export function StatusBadge({ status }: { status: string }) {
  const tone = STATUS_TONE[status] ?? 'neutral';
  const label = status.replace(/_/g, ' ');

  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium',
        STATUS_STYLES[tone],
      )}
    >
      {label}
    </span>
  );
}
