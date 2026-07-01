'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { fetchConference, updateConferenceSettings } from '@/lib/api-client';

export type SettingsForm = {
  blindingMode: string;
  cfpOpensAt: string;
  cfpClosesAt: string;
  reviewDueAt: string;
  decisionDueAt: string;
  currency: string;
  regularEarly: string;
  regularRegular: string;
  studentEarly: string;
  studentRegular: string;
};

type SettingsWorkspaceValue = {
  conferenceId: string;
  form: SettingsForm;
  setForm: React.Dispatch<React.SetStateAction<SettingsForm>>;
  loading: boolean;
  error: string | null;
  saved: boolean;
  setError: (error: string | null) => void;
  save: () => Promise<void>;
};

const SettingsWorkspaceContext = createContext<SettingsWorkspaceValue | null>(null);

export function useSettingsWorkspace() {
  const context = useContext(SettingsWorkspaceContext);
  if (!context) {
    throw new Error('useSettingsWorkspace must be used within SettingsWorkspaceProvider');
  }
  return context;
}

export function SettingsWorkspaceProvider({
  conferenceId,
  children,
}: {
  conferenceId: string;
  children: React.ReactNode;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState<SettingsForm>({
    blindingMode: 'DOUBLE',
    cfpOpensAt: '',
    cfpClosesAt: '',
    reviewDueAt: '',
    decisionDueAt: '',
    currency: 'INR',
    regularEarly: '500000',
    regularRegular: '750000',
    studentEarly: '250000',
    studentRegular: '400000',
  });

  const load = useCallback(async () => {
    const conference = await fetchConference(conferenceId);
    setForm({
      blindingMode: conference.blindingMode,
      cfpOpensAt: conference.cfpOpensAt?.slice(0, 16) ?? '',
      cfpClosesAt: conference.cfpClosesAt?.slice(0, 16) ?? '',
      reviewDueAt: conference.reviewDueAt?.slice(0, 16) ?? '',
      decisionDueAt: conference.decisionDueAt?.slice(0, 16) ?? '',
      currency: conference.feeSchedule.currency,
      regularEarly: String(conference.feeSchedule.matrix.REGULAR?.EARLY ?? 0),
      regularRegular: String(conference.feeSchedule.matrix.REGULAR?.REGULAR ?? 0),
      studentEarly: String(conference.feeSchedule.matrix.STUDENT?.EARLY ?? 0),
      studentRegular: String(conference.feeSchedule.matrix.STUDENT?.REGULAR ?? 0),
    });
    setError(null);
  }, [conferenceId]);

  useEffect(() => {
    load()
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [load]);

  async function save() {
    setError(null);
    setSaved(false);
    try {
      await updateConferenceSettings(conferenceId, {
        blindingMode: form.blindingMode as 'SINGLE' | 'DOUBLE' | 'OPEN',
        cfpOpensAt: form.cfpOpensAt ? new Date(form.cfpOpensAt).toISOString() : null,
        cfpClosesAt: form.cfpClosesAt ? new Date(form.cfpClosesAt).toISOString() : null,
        reviewDueAt: form.reviewDueAt ? new Date(form.reviewDueAt).toISOString() : null,
        decisionDueAt: form.decisionDueAt ? new Date(form.decisionDueAt).toISOString() : null,
        feeSchedule: {
          currency: form.currency,
          matrix: {
            REGULAR: {
              EARLY: Number(form.regularEarly),
              REGULAR: Number(form.regularRegular),
            },
            STUDENT: {
              EARLY: Number(form.studentEarly),
              REGULAR: Number(form.studentRegular),
            },
          },
        },
      });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    }
  }

  return (
    <SettingsWorkspaceContext.Provider
      value={{ conferenceId, form, setForm, loading, error, saved, setError, save }}
    >
      {children}
    </SettingsWorkspaceContext.Provider>
  );
}
