'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { StudentVerificationListDto } from '@openconferences/schemas';
import { fetchStudentVerifications } from '@/lib/api-client';
import { isReviewableVerification } from '@/lib/registrations';

export type VerificationRow = StudentVerificationListDto['data'][number];

type RegistrationsWorkspaceContextValue = {
  conferenceId: string;
  verifications: VerificationRow[];
  /** True until the first load settles, so an empty list is never shown early. */
  verificationsLoading: boolean;
  verificationsError: string | null;
  pendingVerifications: number;
  reloadVerifications: () => Promise<void>;
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
  const [verifications, setVerifications] = useState<VerificationRow[]>([]);
  const [verificationsLoading, setLoading] = useState(true);
  const [verificationsError, setError] = useState<string | null>(null);

  const reloadVerifications = useCallback(async () => {
    try {
      const result = await fetchStudentVerifications(conferenceId);
      setVerifications(result.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load student verifications');
    } finally {
      setLoading(false);
    }
  }, [conferenceId]);

  useEffect(() => {
    setLoading(true);
    void reloadVerifications();
  }, [reloadVerifications]);

  // A document cannot be approved until its file check finishes, so keep checking.
  useEffect(() => {
    if (!verifications.some((row) => row.scanStatus === 'PENDING_SCAN')) return;
    const timer = window.setInterval(() => void reloadVerifications(), 5000);
    return () => window.clearInterval(timer);
  }, [verifications, reloadVerifications]);

  const value = useMemo(
    () => ({
      conferenceId,
      verifications,
      verificationsLoading,
      verificationsError,
      pendingVerifications: verifications.filter((row) => isReviewableVerification(row.status))
        .length,
      reloadVerifications,
    }),
    [conferenceId, verifications, verificationsLoading, verificationsError, reloadVerifications],
  );
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
