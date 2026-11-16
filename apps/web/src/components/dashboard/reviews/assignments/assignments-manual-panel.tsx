'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
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
    assignments,
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

  const paperOptions = useMemo(
    () =>
      papers.map((paper) => ({
        value: paper.id,
        label: paper.submissionNumber ? `${paper.submissionNumber} · ${paper.title}` : paper.title,
      })),
    [papers],
  );

  // Reviewers who bid on the selected paper come first; each row shows the bid
  // and current load so the chair can balance work without leaving the form.
  const reviewerOptions = useMemo(() => {
    const load = new Map<string, number>();
    for (const assignment of assignments) {
      load.set(assignment.reviewerUserId, (load.get(assignment.reviewerUserId) ?? 0) + 1);
    }
    return [...reviewers]
      .sort((a, b) => {
        if (!selectedPaper) return a.name.localeCompare(b.name);
        const aBid = bidForReviewer(selectedPaper, a.userId);
        const bBid = bidForReviewer(selectedPaper, b.userId);
        if (aBid && bBid) return BID_RANK[aBid] - BID_RANK[bBid];
        if (aBid) return -1;
        if (bBid) return 1;
        return a.name.localeCompare(b.name);
      })
      .map((reviewer) => {
        const bid = selectedPaper ? bidForReviewer(selectedPaper, reviewer.userId) : undefined;
        const assigned = load.get(reviewer.userId) ?? 0;
        return {
          value: reviewer.userId,
          label: reviewer.name,
          hint: [
            reviewer.email,
            `${assigned} assigned in this round`,
            bid ? `Bid: ${bidValueLabel(bid)}` : null,
          ]
            .filter(Boolean)
            .join(' · '),
        };
      });
  }, [reviewers, assignments, selectedPaper, bidForReviewer]);

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
              <Combobox
                id="paper"
                value={selectedPaper}
                onChange={setSelectedPaper}
                options={paperOptions}
                placeholder="Search by number or title…"
                emptyText="No papers match"
                disabled={busy}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reviewer">Reviewer</Label>
              <Combobox
                id="reviewer"
                value={selectedReviewer}
                onChange={setSelectedReviewer}
                options={reviewerOptions}
                placeholder="Search by name or email…"
                emptyText="No reviewers match"
                disabled={busy}
              />
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
