'use client';

import { CursorLoadMore } from '@/components/dashboard/cursor-load-more';

type DataTablePaginationProps = {
  nextCursor: string | null;
  onLoadMore: () => void;
  loading?: boolean;
  countLabel?: string;
};

export function DataTablePagination({
  nextCursor,
  onLoadMore,
  loading,
  countLabel,
}: DataTablePaginationProps) {
  return (
    <div className="space-y-2">
      {countLabel ? <p className="text-sm text-slate-500">{countLabel}</p> : null}
      <CursorLoadMore nextCursor={nextCursor} onLoadMore={onLoadMore} loading={loading} />
    </div>
  );
}
