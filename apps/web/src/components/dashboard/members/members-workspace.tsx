'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { fetchMembers } from '@/lib/api-client';
import type { Member } from '@/lib/conference-types';

type MembersWorkspaceValue = {
  conferenceId: string;
  members: Member[];
  error: string | null;
  setError: (error: string | null) => void;
  revokingKey: string | null;
  setRevokingKey: (key: string | null) => void;
  refresh: () => Promise<void>;
  setMembers: React.Dispatch<React.SetStateAction<Member[]>>;
  loading: boolean;
};

const MembersWorkspaceContext = createContext<MembersWorkspaceValue | null>(null);

export function useMembersWorkspace() {
  const context = useContext(MembersWorkspaceContext);
  if (!context) {
    throw new Error('useMembersWorkspace must be used within MembersWorkspaceProvider');
  }
  return context;
}

export function MembersWorkspaceProvider({
  conferenceId,
  children,
}: {
  conferenceId: string;
  children: React.ReactNode;
}) {
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [revokingKey, setRevokingKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const data = await fetchMembers(conferenceId);
    setMembers(data);
    setError(null);
  }, [conferenceId]);

  useEffect(() => {
    refresh()
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [refresh]);

  return (
    <MembersWorkspaceContext.Provider
      value={{
        conferenceId,
        members,
        error,
        setError,
        revokingKey,
        setRevokingKey,
        refresh,
        setMembers,
        loading,
      }}
    >
      {children}
    </MembersWorkspaceContext.Provider>
  );
}
