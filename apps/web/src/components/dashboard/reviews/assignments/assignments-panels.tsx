'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { createAssignment, deleteAssignment, issueReviewerInvitation } from '@/lib/api-client';
import { bidValueLabel, type BidValue } from '@/lib/review-types';
import { BID_RANK, useAssignmentsWorkspace } from './assignments-workspace';

export function AssignmentsBidsPanel() {
  const {
    bidsByPaper,
    papersWithoutBids,
    assignmentKeys,
    roundId,
    busy,
    prefillAssignment,
    loading,
    conferenceId,
  } = useAssignmentsWorkspace();

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((key) => (
          <Skeleton key={key} className="h-32 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (bidsByPaper.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-slate-500">
          No reviewer bids yet. Reviewers can bid from the Bidding tab once bidding is open.
        </CardContent>
      </Card>
    );
  }

  const manualBase = `/dashboard/conferences/${conferenceId}/reviews/assignments/manual`;

  return (
    <div className="space-y-3">
      {bidsByPaper.map(({ paperId, title, bids: paperBids }) => (
        <Card key={paperId}>
          <CardHeader>
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription>
              {paperBids.length} bid{paperBids.length === 1 ? '' : 's'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {paperBids.map((bid) => {
              const assigned = assignmentKeys.has(`${bid.paperId}:${bid.reviewerUserId}`);
              return (
                <div
                  key={`${bid.paperId}:${bid.reviewerUserId}`}
                  className="flex flex-col gap-2 rounded-md border border-slate-200 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900">{bid.reviewerName}</p>
                    <p className="text-xs text-slate-500">{bid.reviewerEmail}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                      {bidValueLabel(bid.value)}
                    </span>
                    {assigned ? (
                      <span className="text-xs text-emerald-700">Assigned</span>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy || !roundId || bid.value === 'CONFLICT'}
                        asChild
                      >
                        <Link
                          href={`${manualBase}?paper=${bid.paperId}&reviewer=${bid.reviewerUserId}`}
                          onClick={() => prefillAssignment(bid.paperId, bid.reviewerUserId)}
                        >
                          Assign
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}

      {papersWithoutBids.length > 0 ? (
        <p className="text-xs text-slate-500">
          {papersWithoutBids.length} paper{papersWithoutBids.length === 1 ? '' : 's'} with no bids
          yet.
        </p>
      ) : null}
    </div>
  );
}

export function AssignmentsCurrentPanel() {
  const { assignments, busy, setBusy, setError, refresh, conferenceId, loading } =
    useAssignmentsWorkspace();

  async function handleUnassign(assignmentId: string) {
    setBusy(true);
    setError(null);
    try {
      await deleteAssignment(conferenceId, assignmentId);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove assignment');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <Skeleton className="h-40 w-full rounded-xl" />;
  }

  if (assignments.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-slate-500">
          No assignments yet. Use Reviewer bids or Manual assignment to assign reviewers.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {assignments.map((assignment) => (
        <Card key={assignment.id}>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="text-base">
                {assignment.paperTitle ?? assignment.paperId}
              </CardTitle>
              <CardDescription>
                {assignment.reviewerName ?? assignment.reviewerUserId}
                {assignment.reviewerEmail ? ` (${assignment.reviewerEmail})` : ''}
                {assignment.bidValue
                  ? ` · Bid: ${bidValueLabel(assignment.bidValue as BidValue)}`
                  : ''}
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => void handleUnassign(assignment.id)}
            >
              Remove
            </Button>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}

export function AssignmentsInvitesPanel() {
  const { conferenceId, busy, setBusy, setError, setMessage } = useAssignmentsWorkspace();
  const [inviteEmail, setInviteEmail] = useState('');

  async function handleInvite() {
    if (!inviteEmail.trim()) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await issueReviewerInvitation(conferenceId, { email: inviteEmail.trim() });
      setMessage(`Invitation sent to ${inviteEmail}`);
      setInviteEmail('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invitation');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Invite reviewer</CardTitle>
        <CardDescription>
          Send a token-based email invitation to join as a reviewer.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-2">
          <Label htmlFor="invite-email">Email</Label>
          <Input
            id="invite-email"
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="reviewer@university.edu"
          />
        </div>
        <Button onClick={() => void handleInvite()} disabled={busy}>
          Send invitation
        </Button>
      </CardContent>
    </Card>
  );
}

export function AssignmentsManualPanel() {
  const searchParams = useSearchParams();
  const {
    conferenceId,
    roundId,
    papers,
    reviewers,
    selectedPaper,
    setSelectedPaper,
    selectedReviewer,
    setSelectedReviewer,
    bidForReviewer,
    busy,
    setBusy,
    setError,
    setMessage,
    refresh,
  } = useAssignmentsWorkspace();

  useEffect(() => {
    const paper = searchParams.get('paper');
    const reviewer = searchParams.get('reviewer');
    if (paper) setSelectedPaper(paper);
    if (reviewer) setSelectedReviewer(reviewer);
  }, [searchParams, setSelectedPaper, setSelectedReviewer]);

  async function handleAssign() {
    if (!roundId || !selectedPaper || !selectedReviewer) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await createAssignment(conferenceId, selectedPaper, {
        roundId,
        reviewerUserId: selectedReviewer,
      });
      setMessage(result.message);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Assignment failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Manual assignment</CardTitle>
        <CardDescription>Assign a reviewer to a paper (COI-checked server-side).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="paper">Paper</Label>
            <select
              id="paper"
              className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
              value={selectedPaper}
              onChange={(e) => setSelectedPaper(e.target.value)}
            >
              <option value="">Select paper…</option>
              {papers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="reviewer">Reviewer</Label>
            <select
              id="reviewer"
              className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
              value={selectedReviewer}
              onChange={(e) => setSelectedReviewer(e.target.value)}
            >
              <option value="">Select reviewer…</option>
              {[...reviewers]
                .sort((a, b) => {
                  if (!selectedPaper) return a.name.localeCompare(b.name);
                  const aBid = bidForReviewer(selectedPaper, a.userId);
                  const bBid = bidForReviewer(selectedPaper, b.userId);
                  if (aBid && bBid) return BID_RANK[aBid] - BID_RANK[bBid];
                  if (aBid) return -1;
                  if (bBid) return 1;
                  return a.name.localeCompare(b.name);
                })
                .map((r) => {
                  const bid = selectedPaper ? bidForReviewer(selectedPaper, r.userId) : undefined;
                  return (
                    <option key={r.userId} value={r.userId}>
                      {r.name} ({r.email}){bid ? ` — ${bidValueLabel(bid)}` : ''}
                    </option>
                  );
                })}
            </select>
          </div>
        </div>
        <Button onClick={() => void handleAssign()} disabled={busy || !roundId}>
          Assign reviewer
        </Button>
      </CardContent>
    </Card>
  );
}
