'use client';

import { createContext, useContext, useMemo } from 'react';

type RegistrationsWorkspaceContextValue = {
  conferenceId: string;
};

const RegistrationsWorkspaceContext = createContext<RegistrationsWorkspaceContextValue | null>(
  null,
);

export function RegistrationsWorkspaceProvider({
  conferenceId,
  children,
}: {
  conferenceId: string;
  children: React.ReactNode;
}) {
  const value = useMemo(() => ({ conferenceId }), [conferenceId]);
  return (
    <RegistrationsWorkspaceContext.Provider value={value}>
      {children}
    </RegistrationsWorkspaceContext.Provider>
  );
}

export function useRegistrationsWorkspace() {
  const ctx = useContext(RegistrationsWorkspaceContext);
  if (!ctx) {
    throw new Error('useRegistrationsWorkspace must be used within RegistrationsWorkspaceProvider');
  }
  return ctx;
}
