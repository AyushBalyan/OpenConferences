'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { fetchDecisions, fetchPapers, fetchReviewRounds } from '@/lib/api-client';
import { resolveDecisionRound } from '@/lib/review-rounds';
import type { DecisionDto, DecisionOutcome, ReviewRoundDto } from '@/lib/review-types';

type PaperRow = {
  id: string;
  title: string;
  status: string;
  version: number;
};

export type PendingDecision = {
  outcome: DecisionOutcome;
  rationale: string;
};

type DecisionsWorkspaceValue = {
  conferenceId: string;
  roundId: string;
  rounds: ReviewRoundDto[];
  papers: PaperRow[];
  decisions: (DecisionDto & { paperTitle?: string; roundNumber?: number })[];
  undecidedPapers: PaperRow[];
  decisionByPaper: Map<string, DecisionDto & { paperTitle?: string; roundNumber?: number }>;
  selected: Set<string>;
  setSelected: React.Dispatch<React.SetStateAction<Set<string>>>;
  pending: Record<string, PendingDecision>;
  setPending: React.Dispatch<React.SetStateAction<Record<string, PendingDecision>>>;
  bulkOutcome: DecisionOutcome;
  setBulkOutcome: React.Dispatch<React.SetStateAction<DecisionOutcome>>;
  loading: boolean;
  error: string | null;
  message: string | null;
  setError: (error: string | null) => void;
  setMessage: (message: string | null) => void;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  refresh: () => Promise<void>;
  onRoundChange: (roundId: string) => Promise<void>;
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
  const [roundId, setRoundId] = useState('');
  const [rounds, setRounds] = useState<ReviewRoundDto[]>([]);
  const [papers, setPapers] = useState<PaperRow[]>([]);
  const [decisions, setDecisions] = useState<
    (DecisionDto & { paperTitle?: string; roundNumber?: number })[]
  >([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<Record<string, PendingDecision>>({});
  const [bulkOutcome, setBulkOutcome] = useState<DecisionOutcome>('ACCEPT');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const decisionByPaper = useMemo(() => new Map(decisions.map((d) => [d.paperId, d])), [decisions]);

  const undecidedPapers = useMemo(
    () => papers.filter((p) => !decisionByPaper.has(p.id) && p.status === 'UNDER_REVIEW'),
    [papers, decisionByPaper],
  );

  const refresh = useCallback(async () => {
    const [roundList, paperList] = await Promise.all([
      fetchReviewRounds(conferenceId),
      fetchPapers(conferenceId),
    ]);

    setRounds(roundList);
    setPapers(
      paperList.data
        .filter((p) => p.status !== 'DRAFT')
        .map((p) => ({ id: p.id, title: p.title, status: p.status, version: p.version })),
    );

    const activeRound = resolveDecisionRound(roundList);
    if (activeRound) {
      setRoundId(activeRound.id);
      const decisionList = await fetchDecisions(conferenceId, activeRound.id);
      setDecisions(decisionList.data);
    } else {
      setRoundId('');
      setDecisions([]);
    }
    setError(null);
  }, [conferenceId]);

  const onRoundChange = useCallback(
    async (nextRoundId: string) => {
      setRoundId(nextRoundId);
      setSelected(new Set());
      setPending({});
      if (!nextRoundId) {
        setDecisions([]);
        return;
      }
      const decisionList = await fetchDecisions(conferenceId, nextRoundId);
      setDecisions(decisionList.data);
    },
    [conferenceId],
  );

  useEffect(() => {
    setLoading(true);
    refresh()
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [refresh]);

  const value: DecisionsWorkspaceValue = {
    conferenceId,
    roundId,
    rounds,
    papers,
    decisions,
    undecidedPapers,
    decisionByPaper,
    selected,
    setSelected,
    pending,
    setPending,
    bulkOutcome,
    setBulkOutcome,
    loading,
    error,
    message,
    setError,
    setMessage,
    busy,
    setBusy,
    refresh,
    onRoundChange,
  };

  return (
    <DecisionsWorkspaceContext.Provider value={value}>
      {children}
    </DecisionsWorkspaceContext.Provider>
  );
}

export type { PaperRow };
