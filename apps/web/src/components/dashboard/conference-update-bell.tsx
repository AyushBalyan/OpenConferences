'use client';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { apiClient } from '@/lib/api-client';

export const UPDATES_READ_EVENT = 'conference-updates-read';
export function notifyUpdatesRead(conferenceId: string) {
  window.dispatchEvent(new CustomEvent(UPDATES_READ_EVENT, { detail: conferenceId }));
}
const ConferenceUpdatesContext = createContext<{ count: number | null; failed: boolean }>({
  count: null,
  failed: false,
});
export const useConferenceUpdates = () => useContext(ConferenceUpdatesContext);

export function ConferenceUpdatesProvider({
  conferenceId,
  enabled,
  children,
}: {
  conferenceId?: string;
  enabled: boolean;
  children: ReactNode;
}) {
  const [snapshot, setSnapshot] = useState<{ conferenceId: string; count: number } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!conferenceId || !enabled) return;
    const activeConferenceId = conferenceId;
    let alive = true,
      generation = 0;
    let timer: ReturnType<typeof setTimeout>;
    async function load() {
      const current = ++generation;
      clearTimeout(timer);
      try {
        const result = await apiClient.messaging.countConferenceUpdates({
          params: { id: activeConferenceId },
          query: {},
        });
        if (!alive || current !== generation) return;
        if (result.status !== 200) throw new Error('Unavailable');
        setSnapshot({ conferenceId: activeConferenceId, count: result.body.unreadCount });
        setFailed(false);
      } catch {
        if (alive && current === generation) setFailed(true);
      } finally {
        if (alive && current === generation) timer = setTimeout(refreshVisible, 30000);
      }
    }
    function refreshVisible() {
      clearTimeout(timer);
      if (!document.hidden) void load();
      else timer = setTimeout(refreshVisible, 30000);
    }
    function onRead(event: Event) {
      if ((event as CustomEvent<string>).detail === conferenceId) void load();
    }
    void load();
    window.addEventListener(UPDATES_READ_EVENT, onRead);
    window.addEventListener('focus', refreshVisible);
    document.addEventListener('visibilitychange', refreshVisible);
    return () => {
      alive = false;
      clearTimeout(timer);
      window.removeEventListener(UPDATES_READ_EVENT, onRead);
      window.removeEventListener('focus', refreshVisible);
      document.removeEventListener('visibilitychange', refreshVisible);
    };
  }, [conferenceId, enabled]);
  const count =
    enabled && snapshot && snapshot.conferenceId === conferenceId ? snapshot.count : null;
  return (
    <ConferenceUpdatesContext.Provider value={{ count, failed }}>
      {children}
    </ConferenceUpdatesContext.Provider>
  );
}

export function ConferenceUpdateBell({ conferenceId }: { conferenceId: string }) {
  const { count, failed } = useConferenceUpdates();
  const label = failed
    ? 'Updates. Unread count may be out of date.'
    : count === null
      ? 'Updates'
      : `Updates, ${count} unread`;
  return (
    <Link
      href={`/dashboard/conferences/${conferenceId}/inbox`}
      aria-label={label}
      title={label}
      className="relative flex h-9 min-w-9 items-center justify-center gap-1 rounded-md px-2 text-slate-600 hover:bg-slate-100 hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
    >
      <Bell className="h-5 w-5" aria-hidden="true" />
      {count !== null && count > 0 ? (
        <span
          aria-hidden="true"
          className="rounded-full bg-red-600 px-1.5 text-[11px] font-semibold leading-5 text-white tabular-nums"
        >
          {count > 99 ? '99+' : count}
        </span>
      ) : null}
    </Link>
  );
}
