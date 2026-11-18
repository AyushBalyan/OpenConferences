'use client';

import { useSyncExternalStore } from 'react';

const DESKTOP_QUERY = '(min-width: 768px)';

/** True from tablet width up, where a data table has room; narrower screens get cards. */
export function useIsDesktop() {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(DESKTOP_QUERY);
      query.addEventListener('change', onChange);
      return () => query.removeEventListener('change', onChange);
    },
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => true,
  );
}
