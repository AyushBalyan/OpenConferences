'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { fetchCoiList, fetchConference, fetchPapers } from '@/lib/api-client';
import type { ConflictOfInterestDto } from '@/lib/review-types';

type CoiWorkspaceValue = {
  conferenceId: string;
  conferenceName: string;
  cois: (ConflictOfInterestDto & { userName?: string; paperTitle?: string | null })[];
  papers: { id: string; title: string }[];
  error: string | null;
  setError: (error: string | null) => void;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  refresh: () => Promise<void>;
  loading: boolean;
};

const CoiWorkspaceContext = createContext<CoiWorkspaceValue | null>(null);

export function useCoiWorkspace() {
  const context = useContext(CoiWorkspaceContext);
  if (!context) {
    throw new Error('useCoiWorkspace must be used within CoiWorkspaceProvider');
  }
  return context;
}

export function CoiWorkspaceProvider({
  conferenceId,
  children,
}: {
  conferenceId: string;
  children: React.ReactNode;
}) {
  const [conferenceName, setConferenceName] = useState('');
  const [cois, setCois] = useState<
    (ConflictOfInterestDto & { userName?: string; paperTitle?: string | null })[]
  >([]);
  const [papers, setPapers] = useState<{ id: string; title: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [conference, list, paperList] = await Promise.all([
      fetchConference(conferenceId),
      fetchCoiList(conferenceId),
      fetchPapers(conferenceId),
    ]);
    setConferenceName(conference.name);
    setCois(list);
    setPapers(paperList.data.map((p) => ({ id: p.id, title: p.title })));
    setError(null);
  }, [conferenceId]);

  useEffect(() => {
    refresh()
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [refresh]);

  return (
    <CoiWorkspaceContext.Provider
      value={{
        conferenceId,
        conferenceName,
        cois,
        papers,
        error,
        setError,
        busy,
        setBusy,
        refresh,
        loading,
      }}
    >
      {children}
    </CoiWorkspaceContext.Provider>
  );
}
