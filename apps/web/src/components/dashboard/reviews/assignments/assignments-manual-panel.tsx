'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { createAssignment } from '@/lib/api-client';
import { bidValueLabel } from '@/lib/review-types';
import { BID_RANK, useAssignmentsWorkspace } from './assignments-workspace';

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
