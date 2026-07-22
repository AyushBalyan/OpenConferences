import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

type KpiCardProps = {
  label: string;
  value: string | number;
  hint?: string;
  tone?: 'default' | 'warning' | 'success';
  loading?: boolean;
  footer?: React.ReactNode;
  className?: string;
};

export function KpiCard({
  label,
  value,
  hint,
  tone = 'default',
  loading,
  footer,
  className,
}: KpiCardProps) {
  const valueTone =
    tone === 'warning'
      ? 'text-amber-700'
      : tone === 'success'
        ? 'text-emerald-700'
        : 'text-slate-900';

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardContent className="p-5">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        {loading ? (
          <Skeleton className="mt-2 h-8 w-20" />
        ) : (
          <p className={cn('mt-1 font-mono text-3xl font-semibold tracking-tight', valueTone)}>
            {value}
          </p>
        )}
        {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
        {footer ? <div className="mt-3">{footer}</div> : null}
      </CardContent>
    </Card>
  );
}

export function KpiGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-3', className)}>{children}</div>
  );
}
