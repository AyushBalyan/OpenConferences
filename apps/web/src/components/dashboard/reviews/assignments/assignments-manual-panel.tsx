'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { reviewerAssignmentDueAt } from '@openconferences/schemas';
import { localDateTimeInput } from '@/lib/review-ledger';
import { createAssignment } from '@/lib/api-client';
import { bidValueLabel } from '@/lib/review-types';
import { BID_RANK, useAssignmentsWorkspace } from './assignments-workspace';

export function AssignmentsManualPanel() {
  const searchParams = useSearchParams();
  const {
    conferenceId,
    conferenceReviewDueAt,
    rounds,
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

  const [deadline, setDeadline] = useState('');
  useEffect(() => {
    const cycle = [...rounds]
      .filter((round) => round.paperId === selectedPaper)
      .sort((a, b) => b.roundNumber - a.roundNumber)[0];
    const cutoff = cycle?.reviewDueAt ?? conferenceReviewDueAt;
    setDeadline(
      localDateTimeInput(
        reviewerAssignmentDueAt(new Date(), cutoff ? new Date(cutoff) : null).toISOString(),
      ),
    );
  }, [selectedPaper, rounds, conferenceReviewDueAt]);

  useEffect(() => {
    const paper = searchParams.get('paper');
    const reviewer = searchParams.get('reviewer');
    if (paper) setSelectedPaper(paper);
    if (reviewer) setSelectedReviewer(reviewer);
  }, [searchParams, setSelectedPaper, setSelectedReviewer]);

  async function handleAssign() {
    if (!selectedPaper || !selectedReviewer || !deadline) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await createAssignment(conferenceId, selectedPaper, {
        reviewerUserId: selectedReviewer,
        dueAt: new Date(deadline).toISOString(),
      });
      setMessage(
        `${result.message}. Deadline: ${new Date(result.assignment.dueAt ?? deadline).toLocaleString()}.`,
      );
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
        <CardDescription>Choose a paper, reviewer and individual review deadline.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void handleAssign();
          }}
        >
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
                    {p.submissionNumber ? `${p.submissionNumber} · ${p.title}` : p.title}
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
          <div className="space-y-2">
            <Label htmlFor="assignment-deadline">Individual review deadline (local time)</Label>
            <input
              id="assignment-deadline"
              type="datetime-local"
              required
              className="flex h-10 w-full max-w-sm rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={deadline}
              min={localDateTimeInput(new Date(Date.now() + 60_000).toISOString())}
              disabled={busy}
              onChange={(event) => setDeadline(event.target.value)}
              aria-describedby="assignment-deadline-help"
            />
            <p id="assignment-deadline-help" className="max-w-2xl text-xs text-slate-600">
              This date is saved for this reviewer and included in their assignment email. You can
              choose a date beyond the conference deadline. The starting suggestion uses the normal
              seven-day window and the paper cycle deadline.
            </p>
          </div>
          <Button type="submit" disabled={busy || !selectedPaper || !selectedReviewer || !deadline}>
            Assign reviewer
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
