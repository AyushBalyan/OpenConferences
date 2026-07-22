import { cn } from '@/lib/utils';

type DataTableToolbarProps = {
  children?: React.ReactNode;
  className?: string;
};

export function DataTableToolbar({ children, className }: DataTableToolbarProps) {
  if (!children) return null;
  return (
    <div className={cn('mb-4 flex flex-col gap-3 sm:flex-row sm:items-center', className)}>
      {children}
    </div>
  );
}
