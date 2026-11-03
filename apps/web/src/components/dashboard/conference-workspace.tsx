'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { effectiveConferenceStatus } from '@openconferences/schemas';
import { fetchConference, fetchConferences } from '@/lib/api-client';
import type { Conference } from '@/lib/conference-types';
import { DashboardShell } from './dashboard-shell';
import { ConferenceSidebar } from './conference-sidebar';

type ConferenceWorkspaceContextValue = {
  conferenceId: string;
  conference: Conference | null;
  conferences: Conference[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const ConferenceWorkspaceContext = createContext<ConferenceWorkspaceContextValue | null>(null);

export function useConferenceWorkspace() {
  const context = useContext(ConferenceWorkspaceContext);
  if (!context) {
    throw new Error('useConferenceWorkspace must be used within ConferenceWorkspaceProvider');
  }
  return context;
}

export function ConferenceWorkspaceProvider({
  conferenceId,
  children,
}: {
  conferenceId: string;
  children: React.ReactNode;
}) {
  const [clock, setClock] = useState(Date.now);
  const [conference, setConference] = useState<Conference | null>(null);
  const [conferences, setConferences] = useState<Conference[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [conf, list] = await Promise.all([fetchConference(conferenceId), fetchConferences()]);
    setClock(Date.now());
    setConference(conf);
    setConferences(list.data);
    setError(null);
  }, [conferenceId]);

  useEffect(() => {
    setLoading(true);
    refresh()
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load conference'))
      .finally(() => setLoading(false));
  }, [refresh]);

  useEffect(() => {
    if (!conference || !['DRAFT', 'CFP_OPEN'].includes(conference.status)) return;
    const next = [conference.cfpOpensAt, conference.cfpClosesAt]
      .filter((value): value is string => Boolean(value))
      .map((value) => new Date(value).getTime())
      .filter((time) => time > clock)
      .sort((a, b) => a - b)[0];
    if (next === undefined) return;
    const timer = window.setTimeout(
      () => {
        setClock(Date.now());
        void refresh().catch(() => undefined);
      },
      Math.min(Math.max(next - Date.now(), 1), 2_147_483_647),
    );
    return () => window.clearTimeout(timer);
  }, [conference, clock, refresh]);

  const visibleConference = conference
    ? { ...conference, status: effectiveConferenceStatus(conference, new Date(clock)) }
    : null;
  const value: ConferenceWorkspaceContextValue = {
    conferenceId,
    conference: visibleConference,
    conferences: conferences.map((item) => ({
      ...item,
      status: effectiveConferenceStatus(item, new Date(clock)),
    })),
    loading,
    error,
    refresh,
  };

  return (
    <ConferenceWorkspaceContext.Provider value={value}>
      <DashboardShell
        sidebar={<ConferenceSidebar />}
        mobileTitle={conference?.name ?? 'Conference'}
        conferenceId={conferenceId}
        conferenceName={conference?.name}
        roles={conference?.myRoles ?? []}
      >
        {loading ? (
          <div className="space-y-4">
            <div className="h-10 w-64 animate-pulse rounded-md bg-slate-200/80" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((key) => (
                <div
                  key={key}
                  className="h-28 animate-pulse rounded-xl border border-slate-200 bg-white"
                />
              ))}
            </div>
          </div>
        ) : error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}
        <div className={loading || error ? 'hidden' : undefined}>{children}</div>
      </DashboardShell>
    </ConferenceWorkspaceContext.Provider>
  );
}
