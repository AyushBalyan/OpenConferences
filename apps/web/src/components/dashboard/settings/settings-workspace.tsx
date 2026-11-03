'use client';

import { useConferenceWorkspace } from '../conference-workspace';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { fetchConference, updateConferenceSettings } from '@/lib/api-client';
import { fromUtcDatetimeLocalValue, toUtcDatetimeLocalValue } from '@/lib/datetime-utc';

export type SettingsForm = {
  blindingMode: string;
  cfpOpensAt: string;
  cfpClosesAt: string;
  biddingOpensAt: string;
  biddingClosesAt: string;
  reviewDueAt: string;
  rebuttalDueAt: string;
  decisionDueAt: string;
  cameraReadyDueAt: string;
  registrationDueAt: string;
  currency: string;
  earlyBirdEndsAt: string;
  registrationDeadlineAt: string;
  additionalPaperMinor: string;
  domesticInrPerUsd: string;
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

const EMPTY_FORM: SettingsForm = {
  blindingMode: 'DOUBLE',
  cfpOpensAt: '',
  cfpClosesAt: '',
  biddingOpensAt: '',
  biddingClosesAt: '',
  reviewDueAt: '',
  rebuttalDueAt: '',
  decisionDueAt: '',
  cameraReadyDueAt: '',
  registrationDueAt: '',
  currency: 'USD',
  earlyBirdEndsAt: '2026-11-19T18:30',
  registrationDeadlineAt: '',
  additionalPaperMinor: '5000',
  domesticInrPerUsd: '',
  regularEarly: '12500',
  regularRegular: '15000',
  studentEarly: '7500',
  studentRegular: '10000',
};

export function SettingsWorkspaceProvider({
  conferenceId,
  children,
}: {
  conferenceId: string;
  children: React.ReactNode;
}) {
  const { refresh: refreshConference } = useConferenceWorkspace();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState<SettingsForm>(EMPTY_FORM);

  const load = useCallback(async () => {
    const conference = await fetchConference(conferenceId);
    setForm({
      blindingMode: conference.blindingMode,
      cfpOpensAt: toUtcDatetimeLocalValue(conference.cfpOpensAt),
      cfpClosesAt: toUtcDatetimeLocalValue(conference.cfpClosesAt),
      biddingOpensAt: toUtcDatetimeLocalValue(conference.biddingOpensAt),
      biddingClosesAt: toUtcDatetimeLocalValue(conference.biddingClosesAt),
      reviewDueAt: toUtcDatetimeLocalValue(conference.reviewDueAt),
      rebuttalDueAt: toUtcDatetimeLocalValue(conference.rebuttalDueAt),
      decisionDueAt: toUtcDatetimeLocalValue(conference.decisionDueAt),
      cameraReadyDueAt: toUtcDatetimeLocalValue(conference.cameraReadyDueAt),
      registrationDueAt: toUtcDatetimeLocalValue(conference.registrationDueAt),
      currency: conference.feeSchedule.currency,
      earlyBirdEndsAt: toUtcDatetimeLocalValue(conference.feeSchedule.earlyBirdEndsAt),
      registrationDeadlineAt: toUtcDatetimeLocalValue(
        conference.feeSchedule.registrationDeadlineAt,
      ),
      additionalPaperMinor: String(conference.feeSchedule.additionalPaperMinor ?? ''),
      domesticInrPerUsd: String(conference.feeSchedule.domesticInrPerUsd ?? ''),
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
        cfpOpensAt: fromUtcDatetimeLocalValue(form.cfpOpensAt),
        cfpClosesAt: fromUtcDatetimeLocalValue(form.cfpClosesAt),
        biddingOpensAt: fromUtcDatetimeLocalValue(form.biddingOpensAt),
        biddingClosesAt: fromUtcDatetimeLocalValue(form.biddingClosesAt),
        reviewDueAt: fromUtcDatetimeLocalValue(form.reviewDueAt),
        rebuttalDueAt: fromUtcDatetimeLocalValue(form.rebuttalDueAt),
        decisionDueAt: fromUtcDatetimeLocalValue(form.decisionDueAt),
        cameraReadyDueAt: fromUtcDatetimeLocalValue(form.cameraReadyDueAt),
        registrationDueAt: fromUtcDatetimeLocalValue(form.registrationDueAt),
        feeSchedule: {
          currency: form.currency,
          earlyBirdEndsAt: fromUtcDatetimeLocalValue(form.earlyBirdEndsAt),
          registrationDeadlineAt: fromUtcDatetimeLocalValue(form.registrationDeadlineAt),
          ...(form.additionalPaperMinor
            ? { additionalPaperMinor: Number(form.additionalPaperMinor) }
            : {}),
          ...(form.domesticInrPerUsd ? { domesticInrPerUsd: Number(form.domesticInrPerUsd) } : {}),
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
      await load();
      await refreshConference();
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
