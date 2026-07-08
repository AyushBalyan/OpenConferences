'use client';

import { Button } from '@/components/ui/button';

type CursorLoadMoreProps = {
  nextCursor: string | null | undefined;
  onLoadMore: () => void | Promise<void>;
  loading?: boolean;
};

export function CursorLoadMore({ nextCursor, onLoadMore, loading }: CursorLoadMoreProps) {
  if (!nextCursor) return null;

  return (
    <div className="flex justify-center pt-4">
      <Button type="button" variant="outline" onClick={() => void onLoadMore()} disabled={loading}>
        {loading ? 'Loading…' : 'Load more'}
      </Button>
    </div>
  );
}
