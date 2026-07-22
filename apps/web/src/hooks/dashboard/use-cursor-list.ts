'use client';

import { useCallback, useState } from 'react';

type CursorPage<T> = {
  data: T[];
  nextCursor: string | null;
};

type UseCursorListOptions<T> = {
  fetchPage: (cursor?: string) => Promise<CursorPage<T>>;
  initialLoad?: boolean;
};

export function useCursorList<T>({ fetchPage }: UseCursorListOptions<T>) {
  const [items, setItems] = useState<T[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (cursor?: string) => {
      const isMore = Boolean(cursor);
      if (isMore) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError(null);
      try {
        const page = await fetchPage(cursor);
        setItems((prev) => (isMore ? [...prev, ...page.data] : page.data));
        setNextCursor(page.nextCursor);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
        if (!isMore) {
          setItems([]);
          setNextCursor(null);
        }
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [fetchPage],
  );

  const refresh = useCallback(() => load(undefined), [load]);
  const loadMore = useCallback(() => {
    if (nextCursor && !loadingMore) {
      void load(nextCursor);
    }
  }, [load, loadingMore, nextCursor]);

  return {
    items,
    nextCursor,
    loading,
    loadingMore,
    error,
    refresh,
    loadMore,
    setItems,
  };
}
