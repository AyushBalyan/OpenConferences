'use client';

import { useCallback, useEffect, useState } from 'react';

function storageKeyFor(conferenceId: string, listKey: string): string {
  return `${conferenceId}:${listKey}`;
}

function readStored<T extends Record<string, unknown>>(key: string, defaults: T): T {
  if (typeof window === 'undefined') return defaults;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaults;
    return { ...defaults, ...(JSON.parse(raw) as Partial<T>) };
  } catch {
    return defaults;
  }
}

export function useSavedFilter<T extends Record<string, unknown>>(
  conferenceId: string,
  listKey: string,
  defaults: T,
): [T, (update: Partial<T> | ((prev: T) => T)) => void, () => void] {
  const storageKey = storageKeyFor(conferenceId, listKey);
  const [filter, setFilterState] = useState<T>(defaults);

  useEffect(() => {
    setFilterState(readStored(storageKey, defaults));
  }, [storageKey]);

  const setFilter = useCallback(
    (update: Partial<T> | ((prev: T) => T)) => {
      setFilterState((prev) => {
        const next = typeof update === 'function' ? update(prev) : { ...prev, ...update };
        try {
          localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {
          // Ignore quota or privacy mode errors.
        }
        return next;
      });
    },
    [storageKey],
  );

  const resetFilter = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // Ignore storage errors.
    }
    setFilterState(defaults);
  }, [defaults, storageKey]);

  return [filter, setFilter, resetFilter];
}
