'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  fetchDecisions,
  fetchAllPapers,
  fetchReviewProgress,
  fetchReviewRounds,
} from '@/lib/api-client';
import { currentCycleDecisions } from '@/lib/review-rounds';
import { useSession } from '@/lib/auth-client';
import type { PaperDto } from '@/lib/submission-types';
import type { DecisionDto, DecisionOutcome, ReviewRoundDto } from '@/lib/review-types';

type PaperRow = {
  id: string;
  title: string;
  submissionNumber?: string | null;
  status: PaperDto['status'];
  version: number;
  cycleId: string | null;
  warning: string | null;
  submittedReviews: number | null;
  requiredReviews: number | null;
  roundNumber: number | null;
};

export type PendingDecision = {
  outcome: DecisionOutcome | '';
  rationale: string;
  cycleId?: string | null;
};

type DecisionsWorkspaceValue = {
  conferenceId: string;
  rounds: ReviewRoundDto[];
  papers: PaperRow[];
  decisions: (DecisionDto & {
    paperTitle?: string;
    paperSubmittedAt?: string | null;
    submissionNumber?: string | null;
    roundNumber?: number;
  })[];
  undecidedPapers: PaperRow[];
  search: string;
  setSearch: (value: string) => void;
  filteredUndecidedPapers: PaperRow[];
  filteredDecisions: DecisionsWorkspaceValue['decisions'];
  decisionByPaper: Map<
    string,
    DecisionDto & {
      paperTitle?: string;
      paperSubmittedAt?: string | null;
      submissionNumber?: string | null;
      roundNumber?: number;
    }
  >;
  selected: Set<string>;
  setSelected: React.Dispatch<React.SetStateAction<Set<string>>>;
  pending: Record<string, PendingDecision>;
  setPending: React.Dispatch<React.SetStateAction<Record<string, PendingDecision>>>;
  draftStatus: 'saving' | 'saved' | 'unavailable';
  bulkOutcome: DecisionOutcome | '';
  setBulkOutcome: React.Dispatch<React.SetStateAction<DecisionOutcome | ''>>;
  loading: boolean;
  error: string | null;
  message: string | null;
  setError: (error: string | null) => void;
  setMessage: (message: string | null) => void;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  refresh: () => Promise<void>;
};

const DecisionsWorkspaceContext = createContext<DecisionsWorkspaceValue | null>(null);

export function useDecisionsWorkspace() {
  const context = useContext(DecisionsWorkspaceContext);
  if (!context) {
    throw new Error('useDecisionsWorkspace must be used within DecisionsWorkspaceProvider');
  }
  return context;
}

export function DecisionsWorkspaceProvider({
  conferenceId,
  children,
}: {
  conferenceId: string;
  children: React.ReactNode;
}) {
  const { data: session } = useSession();
  const [rounds, setRounds] = useState<ReviewRoundDto[]>([]);
  const [papers, setPapers] = useState<PaperRow[]>([]);
  const [decisions, setDecisions] = useState<DecisionsWorkspaceValue['decisions']>([]);
  const [allDecisions, setAllDecisions] = useState<DecisionsWorkspaceValue['decisions']>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<Record<string, PendingDecision>>({});
  const [loadedDraftKey, setLoadedDraftKey] = useState('');
  const [savedDrafts, setSavedDrafts] = useState('');
  const [storageFailed, setStorageFailed] = useState(false);
  const draftKey = session?.user.id ? `decision-drafts:${session.user.id}:${conferenceId}` : '';
  const serializedDrafts = JSON.stringify(pending);
  const draftStatus = storageFailed
    ? 'unavailable'
    : savedDrafts === serializedDrafts
      ? 'saved'
      : 'saving';
  const [bulkOutcome, setBulkOutcome] = useState<DecisionOutcome | ''>('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearchText] = useState('');

  const decisionByPaper = useMemo(
    () => currentCycleDecisions(papers, allDecisions),
    [papers, allDecisions],
  );

  const undecidedPapers = useMemo(
    () => papers.filter((p) => !decisionByPaper.has(p.id) && p.status === 'UNDER_REVIEW'),
    [papers, decisionByPaper],
  );

  const query = search.trim().toLocaleLowerCase();
  const filteredUndecidedPapers = useMemo(
    () =>
      undecidedPapers.filter(
        (p) =>
          p.title.toLocaleLowerCase().includes(query) ||
          (p.submissionNumber ?? '').toLocaleLowerCase().includes(query),
      ),
    [undecidedPapers, query],
  );
  const filteredDecisions = useMemo(
    () =>
      decisions.filter(
        (d) =>
          (d.paperTitle ?? '').toLocaleLowerCase().includes(query) ||
          (d.submissionNumber ?? '').toLocaleLowerCase().includes(query),
      ),
    [decisions, query],
  );
  function setSearch(value: string) {
    setSearchText(value);
    setSelected(new Set());
  }

  const refresh = useCallback(async () => {
    const [roundList, paperList, progress, decisionList] = await Promise.all([
      fetchReviewRounds(conferenceId),
      fetchAllPapers(conferenceId),
      fetchReviewProgress(conferenceId),
      fetchDecisions(conferenceId),
    ]);

    setRounds(roundList);
    const progressByPaper = new Map(progress.data.map((row) => [row.paperId, row]));
    setPapers(
      paperList
        .filter((p) => p.status !== 'DRAFT')
        .map((p) => ({
          id: p.id,
          title: p.title,
          submissionNumber: p.submissionNumber,
          status: p.status,
          version: p.version,
          cycleId: progressByPaper.get(p.id)?.cycleId ?? null,
          warning: progressByPaper.get(p.id)?.warning ?? null,
          submittedReviews: progressByPaper.get(p.id)?.submittedReviewCount ?? null,
          requiredReviews: progress.minimumReviews ?? null,
          roundNumber: progressByPaper.get(p.id)?.roundNumber ?? null,
        })),
    );

    setAllDecisions(decisionList.data);
    setDecisions(decisionList.data);
    setError(null);
  }, [conferenceId]);

  useEffect(() => {
    if (!draftKey) return;
    let restored: Record<string, PendingDecision> = {};
    try {
      const parsed: unknown = JSON.parse(sessionStorage.getItem(draftKey) ?? '{}');
      if (parsed && typeof parsed === 'object') {
        restored = Object.fromEntries(
          Object.entries(parsed).filter(
            ([, value]) =>
              value &&
              typeof value === 'object' &&
              ['', 'ACCEPT', 'REJECT', 'MINOR_REVISION', 'MAJOR_REVISION'].includes(
                value.outcome,
              ) &&
              typeof value.rationale === 'string',
          ),
        );
      }
    } catch {
      setStorageFailed(true);
    }
    setPending(restored);
    setLoadedDraftKey(draftKey);
    setSavedDrafts(JSON.stringify(restored));
  }, [draftKey]);

  useEffect(() => {
    if (!draftKey || loadedDraftKey !== draftKey) return;
    try {
      sessionStorage.setItem(draftKey, serializedDrafts);
      setSavedDrafts(serializedDrafts);
      setStorageFailed(false);
    } catch {
      setStorageFailed(true);
    }
  }, [draftKey, loadedDraftKey, serializedDrafts]);

  useEffect(() => {
    if (loading || loadedDraftKey !== draftKey) return;
    setSelected(
      (previous) =>
        new Set(
          [...previous].filter((paperId) => undecidedPapers.some((paper) => paper.id === paperId)),
        ),
    );
    setPending((previous) =>
      Object.fromEntries(
        Object.entries(previous).filter(([paperId, draft]) => {
          const paper = undecidedPapers.find((item) => item.id === paperId);
          return paper && draft.cycleId === paper.cycleId;
        }),
      ),
    );
  }, [undecidedPapers, loading, loadedDraftKey, draftKey]);

  useEffect(() => {
    function guard(event: BeforeUnloadEvent) {
      if (Object.keys(pending).length && draftStatus !== 'saved') event.preventDefault();
    }
    function guardNavigation(event: MouseEvent) {
      if (
        !Object.keys(pending).length ||
        draftStatus === 'saved' ||
        !(event.target instanceof Element)
      )
        return;
      const link = event.target.closest('a');
      if (
        !link ||
        new URL(link.href).pathname.startsWith(
          `/dashboard/conferences/${conferenceId}/reviews/decisions`,
        )
      )
        return;
      if (
        !window.confirm(
          'Your draft could not be saved in this browser. Leaving this page will discard it. Leave anyway?',
        )
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    }
    window.addEventListener('beforeunload', guard);
    document.addEventListener('click', guardNavigation, true);
    return () => {
      window.removeEventListener('beforeunload', guard);
      document.removeEventListener('click', guardNavigation, true);
    };
  }, [pending, draftStatus, conferenceId]);

  useEffect(() => {
    setLoading(true);
    refresh()
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [refresh]);

  const value: DecisionsWorkspaceValue = {
    conferenceId,
    rounds,
    papers,
    decisions,
    undecidedPapers,
    search,
    setSearch,
    filteredUndecidedPapers,
    filteredDecisions,
    decisionByPaper,
    selected,
    setSelected,
    pending,
    setPending,
    draftStatus,
    bulkOutcome,
    setBulkOutcome,
    loading: loading || !draftKey || loadedDraftKey !== draftKey,
    error,
    message,
    setError,
    setMessage,
    busy,
    setBusy,
    refresh,
  };

  return (
    <DecisionsWorkspaceContext.Provider value={value}>
      {children}
    </DecisionsWorkspaceContext.Provider>
  );
}

export type { PaperRow };
