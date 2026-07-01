'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  fetchAssignments,
  fetchBids,
  fetchConference,
  fetchMembers,
  fetchPapers,
  fetchReviewRounds,
} from '@/lib/api-client';
import { resolveActiveReviewRound } from '@/lib/review-rounds';
import type { BidValue, ReviewerAssignmentDto, ReviewRoundDto } from '@/lib/review-types';

export type BidRow = {
  paperId: string;
  paperTitle: string;
  reviewerUserId: string;
  reviewerName: string;
  reviewerEmail: string;
  value: BidValue;
};

export const BID_RANK: Record<BidValue, number> = {
  EAGER: 0,
  YES: 1,
  MAYBE: 2,
  NO: 3,
  CONFLICT: 4,
};

type AssignmentsWorkspaceValue = {
  conferenceId: string;
  conferenceName: string;
  rounds: ReviewRoundDto[];
  roundId: string;
  setRoundId: (roundId: string) => void;
  selectedRound: ReviewRoundDto | undefined;
  assignments: (ReviewerAssignmentDto & {
    paperTitle?: string;
    reviewerName?: string;
    reviewerEmail?: string;
    bidValue?: string | null;
  })[];
  bids: BidRow[];
  papers: { id: string; title: string }[];
  reviewers: { userId: string; name: string; email: string }[];
  assignmentKeys: Set<string>;
  bidsByPaper: { title: string; paperId: string; bids: BidRow[] }[];
  papersWithoutBids: { id: string; title: string }[];
  canCopyFromPrevious: boolean;
  loading: boolean;
  error: string | null;
  message: string | null;
  setError: (error: string | null) => void;
  setMessage: (message: string | null) => void;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  refresh: () => Promise<void>;
  onRoundChange: (roundId: string) => Promise<void>;
  prefillAssignment: (paperId: string, reviewerUserId: string) => void;
  selectedPaper: string;
  setSelectedPaper: (paperId: string) => void;
  selectedReviewer: string;
  setSelectedReviewer: (reviewerUserId: string) => void;
  bidForReviewer: (paperId: string, reviewerUserId: string) => BidValue | undefined;
};

const AssignmentsWorkspaceContext = createContext<AssignmentsWorkspaceValue | null>(null);

export function useAssignmentsWorkspace() {
  const context = useContext(AssignmentsWorkspaceContext);
  if (!context) {
    throw new Error('useAssignmentsWorkspace must be used within AssignmentsWorkspaceProvider');
  }
  return context;
}

export function AssignmentsWorkspaceProvider({
  conferenceId,
  children,
}: {
  conferenceId: string;
  children: React.ReactNode;
}) {
  const [conferenceName, setConferenceName] = useState('');
  const [rounds, setRounds] = useState<ReviewRoundDto[]>([]);
  const [roundId, setRoundId] = useState('');
  const [assignments, setAssignments] = useState<AssignmentsWorkspaceValue['assignments']>([]);
  const [bids, setBids] = useState<BidRow[]>([]);
  const [papers, setPapers] = useState<{ id: string; title: string }[]>([]);
  const [reviewers, setReviewers] = useState<{ userId: string; name: string; email: string }[]>([]);
  const [selectedPaper, setSelectedPaper] = useState('');
  const [selectedReviewer, setSelectedReviewer] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const assignmentKeys = useMemo(
    () => new Set(assignments.map((a) => `${a.paperId}:${a.reviewerUserId}`)),
    [assignments],
  );

  const bidsByPaper = useMemo(() => {
    const grouped = new Map<string, { title: string; bids: BidRow[] }>();
    for (const bid of bids) {
      const entry = grouped.get(bid.paperId);
      if (entry) {
        entry.bids.push(bid);
      } else {
        grouped.set(bid.paperId, { title: bid.paperTitle, bids: [bid] });
      }
    }

    return [...grouped.values()]
      .map(({ title, bids: paperBids }) => ({
        title,
        paperId: paperBids[0]?.paperId ?? '',
        bids: [...paperBids].sort((a, b) => BID_RANK[a.value] - BID_RANK[b.value]),
      }))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [bids]);

  const papersWithoutBids = useMemo(() => {
    const paperIdsWithBids = new Set(bids.map((b) => b.paperId));
    return papers.filter((p) => !paperIdsWithBids.has(p.id));
  }, [bids, papers]);

  const selectedRound = rounds.find((round) => round.id === roundId);
  const canCopyFromPrevious =
    selectedRound != null && selectedRound.roundNumber > 1 && selectedRound.status !== 'CLOSED';

  const refresh = useCallback(async () => {
    const [conference, roundList, paperList, members, bidList] = await Promise.all([
      fetchConference(conferenceId),
      fetchReviewRounds(conferenceId),
      fetchPapers(conferenceId),
      fetchMembers(conferenceId),
      fetchBids(conferenceId, { limit: 100 }),
    ]);

    setConferenceName(conference.name);
    setPapers(
      paperList.data.filter((p) => p.status !== 'DRAFT').map((p) => ({ id: p.id, title: p.title })),
    );
    setReviewers(
      members
        .filter((m) => m.roles.includes('REVIEWER'))
        .map((m) => ({ userId: m.userId, name: m.name, email: m.email })),
    );
    setBids(
      bidList.map((b) => ({
        paperId: b.paperId,
        paperTitle: b.paperTitle ?? b.paperId,
        reviewerUserId: b.reviewerUserId,
        reviewerName: b.reviewerName ?? 'Unknown reviewer',
        reviewerEmail: b.reviewerEmail ?? '',
        value: b.value,
      })),
    );
    setRounds(roundList);

    const activeRound = resolveActiveReviewRound(roundList);
    if (activeRound) {
      setRoundId(activeRound.id);
      const data = await fetchAssignments(conferenceId, activeRound.id);
      setAssignments(data);
    } else {
      setRoundId('');
      setAssignments([]);
    }
    setError(null);
  }, [conferenceId]);

  const onRoundChange = useCallback(
    async (nextRoundId: string) => {
      setRoundId(nextRoundId);
      if (!nextRoundId) {
        setAssignments([]);
        return;
      }
      const data = await fetchAssignments(conferenceId, nextRoundId);
      setAssignments(data);
    },
    [conferenceId],
  );

  useEffect(() => {
    setLoading(true);
    refresh()
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [refresh]);

  function bidForReviewer(paperId: string, reviewerUserId: string) {
    return bids.find((b) => b.paperId === paperId && b.reviewerUserId === reviewerUserId)?.value;
  }

  function prefillAssignment(paperId: string, reviewerUserId: string) {
    setSelectedPaper(paperId);
    setSelectedReviewer(reviewerUserId);
  }

  const value: AssignmentsWorkspaceValue = {
    conferenceId,
    conferenceName,
    rounds,
    roundId,
    setRoundId,
    selectedRound,
    assignments,
    bids,
    papers,
    reviewers,
    assignmentKeys,
    bidsByPaper,
    papersWithoutBids,
    canCopyFromPrevious,
    loading,
    error,
    message,
    setError,
    setMessage,
    busy,
    setBusy,
    refresh,
    onRoundChange,
    prefillAssignment,
    selectedPaper,
    setSelectedPaper,
    selectedReviewer,
    setSelectedReviewer,
    bidForReviewer,
  };

  return (
    <AssignmentsWorkspaceContext.Provider value={value}>
      {children}
    </AssignmentsWorkspaceContext.Provider>
  );
}
