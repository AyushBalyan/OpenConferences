import { cn } from '@/lib/utils';

type DataTableProps = {
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
};

export function DataTable({ children, footer, className }: DataTableProps) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm',
        className,
      )}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">{children}</table>
      </div>
      {footer}
    </div>
  );
}

export function DataTableHeader({ children }: { children: React.ReactNode }) {
  return (
    <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 backdrop-blur">
      {children}
    </thead>
  );
}

export function DataTableBody({ children }: { children: React.ReactNode }) {
  return <tbody className="divide-y divide-slate-100">{children}</tbody>;
}

export function DataTableRow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <tr className={cn('transition-colors hover:bg-slate-50', className)}>{children}</tr>;
}

export function DataTableHead({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={cn(
        'px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500',
        className,
      )}
    >
      {children}
    </th>
  );
}

export function DataTableCell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={cn('px-4 py-3 text-slate-700', className)}>{children}</td>;
}

export function DataTableFooter({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-end border-t border-slate-200 bg-white px-4 py-3 text-sm text-slate-500',
        className,
      )}
    >
      {children}
    </div>
  );
}
